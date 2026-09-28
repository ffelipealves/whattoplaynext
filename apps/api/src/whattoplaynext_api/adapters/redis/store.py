"""Redis implementation of the cache-store and counter-store ports."""

import asyncio
from collections.abc import AsyncIterator, Awaitable
from contextlib import asynccontextmanager
from typing import Any, Protocol, Self

from redis.asyncio import Redis
from redis.asyncio.retry import Retry
from redis.backoff import NoBackoff
from redis.exceptions import RedisError

from whattoplaynext_api.cache.store import CacheUnavailableError


class RedisCommands(Protocol):
    """The subset of the asyncio Redis client the store uses."""

    def get(self, name: str) -> Awaitable[Any]: ...

    def set(self, name: str, value: bytes, *, ex: int) -> Awaitable[Any]: ...

    def delete(self, *names: str) -> Awaitable[Any]: ...

    def ping(self) -> Awaitable[Any]: ...

    def memory_usage(self, key: str) -> Awaitable[Any]: ...

    def pipeline(self, transaction: bool = True) -> Any: ...

    def aclose(self) -> Awaitable[None]: ...


class RedisCacheStore:
    """Bounded Redis access that reports any failure as an unavailable store.

    Each operation has one deadline covering pool checkout, connection, and the
    command itself. The client never retries: the cache layer decides what an
    outage means, and a retry would only double the time a request waits.
    """

    def __init__(self, client: RedisCommands, *, operation_timeout_seconds: float):
        self._client = client
        self._timeout = operation_timeout_seconds

    @classmethod
    def from_url(
        cls,
        url: str,
        *,
        operation_timeout_seconds: float,
        max_connections: int,
    ) -> Self:
        """Create a store with a lazily connecting, bounded connection pool."""
        client = Redis.from_url(
            url,
            max_connections=max_connections,
            socket_connect_timeout=operation_timeout_seconds,
            socket_timeout=operation_timeout_seconds,
            retry=Retry(NoBackoff(), 0),
        )
        return cls(client, operation_timeout_seconds=operation_timeout_seconds)

    async def get(self, key: str) -> bytes | None:
        async with self._bounded():
            value = await self._client.get(key)
        return value if isinstance(value, bytes) else None

    async def set(self, key: str, value: bytes, ttl_seconds: int) -> None:
        async with self._bounded():
            await self._client.set(key, value, ex=ttl_seconds)

    async def delete(self, key: str) -> None:
        async with self._bounded():
            await self._client.delete(key)

    async def ping(self) -> None:
        async with self._bounded():
            await self._client.ping()

    async def memory_usage(self, key: str) -> int | None:
        """Return Redis's own byte accounting for one key when it exists.

        This is intentionally an adapter-specific diagnostic, used by the
        opt-in capacity measurement rather than the cache request path.
        """
        async with self._bounded():
            size = await self._client.memory_usage(key)
        return size if isinstance(size, int) else None

    async def hit(
        self, current_key: str, previous_key: str, ttl_seconds: int
    ) -> tuple[int, int]:
        """Count one request and read the previous window, in one round trip."""
        async with self._bounded():
            pipe = self._client.pipeline(transaction=False)
            pipe.incr(current_key)
            pipe.expire(current_key, ttl_seconds)
            pipe.get(previous_key)
            current, _, previous = await pipe.execute()
        return int(current), int(previous or 0)

    async def aclose(self) -> None:
        """Release the connection pool."""
        await self._client.aclose()

    @asynccontextmanager
    async def _bounded(self) -> AsyncIterator[None]:
        try:
            async with asyncio.timeout(self._timeout):
                yield
        except RedisError, OSError, TimeoutError:
            # Suppress the cause: Redis errors can name hosts and ports.
            raise CacheUnavailableError from None

"""Application-owned port for a byte-oriented cache store."""

from typing import Protocol


class CacheUnavailableError(Exception):
    """The store could not complete an operation in time.

    Carries no connection details: callers only need to know the cache is
    unusable right now.
    """

    def __init__(self) -> None:
        super().__init__("cache store unavailable")


class CacheStore(Protocol):
    """Minimal key-value operations the cache needs from Redis.

    Every operation either completes within the store's bounded timeout or
    raises ``CacheUnavailableError``.
    """

    async def get(self, key: str) -> bytes | None:
        """Return the stored bytes, or ``None`` when the key is absent."""
        ...

    async def set(self, key: str, value: bytes, ttl_seconds: int) -> None:
        """Store bytes that expire after ``ttl_seconds``."""
        ...

    async def delete(self, key: str) -> None:
        """Remove a key if it exists."""
        ...

    async def ping(self) -> None:
        """Confirm the store is reachable."""
        ...

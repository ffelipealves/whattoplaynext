"""Deterministic cache-store fakes shared by the API tests.

They implement the application-owned ``CacheStore`` port, so tests exercise
the same seam as the Redis adapter without a running Redis.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from whattoplaynext_api.cache.store import CacheUnavailableError


@dataclass
class ManualClock:
    """A clock that moves only when a test advances it."""

    now: datetime = field(default_factory=lambda: datetime(2026, 9, 27, tzinfo=UTC))

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


class InMemoryCacheStore:
    """A cache store that honors TTLs against an injected clock."""

    def __init__(self, clock: ManualClock) -> None:
        self._clock = clock
        self._entries: dict[str, tuple[bytes, datetime]] = {}
        self.calls: list[str] = []
        self.available = True

    def _record(self, operation: str) -> None:
        self.calls.append(operation)
        if not self.available:
            raise CacheUnavailableError

    async def get(self, key: str) -> bytes | None:
        self._record("get")
        entry = self._entries.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if self._clock() >= expires_at:
            del self._entries[key]
            return None
        return value

    async def set(self, key: str, value: bytes, ttl_seconds: int) -> None:
        self._record("set")
        self._entries[key] = (value, self._clock() + timedelta(seconds=ttl_seconds))

    async def delete(self, key: str) -> None:
        self._record("delete")
        self._entries.pop(key, None)

    async def ping(self) -> None:
        self._record("ping")

    def ttl_seconds(self, key: str) -> float:
        """Report the remaining lifetime the store was asked to keep."""
        _, expires_at = self._entries[key]
        return (expires_at - self._clock()).total_seconds()

    def put_raw(self, key: str, value: bytes) -> None:
        """Store bytes that did not come from the cache codec."""
        self._entries[key] = (value, self._clock() + timedelta(days=1))

    def stored_keys(self) -> frozenset[str]:
        return frozenset(self._entries)


class FailingCacheStore:
    """A cache store whose every operation reports Redis as unavailable."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    async def get(self, key: str) -> bytes | None:
        self.calls.append("get")
        raise CacheUnavailableError

    async def set(self, key: str, value: bytes, ttl_seconds: int) -> None:
        self.calls.append("set")
        raise CacheUnavailableError

    async def delete(self, key: str) -> None:
        self.calls.append("delete")
        raise CacheUnavailableError

    async def ping(self) -> None:
        self.calls.append("ping")
        raise CacheUnavailableError

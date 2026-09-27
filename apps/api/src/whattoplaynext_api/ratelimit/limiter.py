"""Sliding-window request budgets."""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from math import ceil, floor
from time import time
from typing import Protocol

from whattoplaynext_api.cache.store import CacheUnavailableError

logger = logging.getLogger("whattoplaynext_api.ratelimit")


class CounterStore(Protocol):
    """Window counters, incremented and read in one round trip."""

    async def hit(
        self, current_key: str, previous_key: str, ttl_seconds: int
    ) -> tuple[int, int]:
        """Increment ``current_key`` and return it with ``previous_key``'s count.

        Raises ``CacheUnavailableError`` when the store cannot answer in time.
        """
        ...


class InMemoryCounterStore:
    """Process-local counters, used while Redis is unavailable."""

    PRUNE_EVERY = 1_000

    def __init__(self, clock: Callable[[], float] = time) -> None:
        self._clock = clock
        self._counters: dict[str, tuple[int, float]] = {}
        self._operations = 0

    async def hit(
        self, current_key: str, previous_key: str, ttl_seconds: int
    ) -> tuple[int, int]:
        return self.increment(current_key, ttl_seconds), self.count(previous_key)

    def increment(self, key: str, ttl_seconds: int) -> int:
        self._operations += 1
        if self._operations % self.PRUNE_EVERY == 0:
            self._prune()
        count = self.count(key)
        if count == 0:
            self._counters[key] = (1, self._clock() + ttl_seconds)
            return 1
        _, expires_at = self._counters[key]
        self._counters[key] = (count + 1, expires_at)
        return count + 1

    def count(self, key: str) -> int:
        entry = self._counters.get(key)
        if entry is None:
            return 0
        count, expires_at = entry
        if self._clock() >= expires_at:
            del self._counters[key]
            return 0
        return count

    def _prune(self) -> None:
        now = self._clock()
        for key in [key for key, (_, at) in self._counters.items() if now >= at]:
            del self._counters[key]


@dataclass(frozen=True)
class Decision:
    """Whether one request fits the budget, and when to retry if not."""

    allowed: bool
    retry_after_seconds: int | None = None


class SlidingWindowLimiter:
    """Approximate a sliding window from two fixed-window counters.

    The previous window's count is weighted by how much of it still overlaps
    the sliding window. Rejected requests count too, so a client that keeps
    hammering stays limited instead of slipping through as the window slides.
    """

    def __init__(
        self,
        store: CounterStore,
        *,
        fallback: CounterStore,
        name: str,
        limit: int,
        window_seconds: int,
        clock: Callable[[], float] = time,
    ) -> None:
        self._store = store
        self._fallback = fallback
        self._name = name
        self._limit = limit
        self._window = window_seconds
        self._clock = clock

    def keys(self, identity: str) -> tuple[str, str]:
        window = floor(self._clock() / self._window)
        prefix = f"wtpn:ratelimit:v1:{self._name}:{identity}"
        return f"{prefix}:{window}", f"{prefix}:{window - 1}"

    async def acquire(self, identity: str) -> Decision:
        now = self._clock()
        elapsed = now - floor(now / self._window) * self._window
        current_key, previous_key = self.keys(identity)
        ttl = 2 * self._window
        try:
            current, previous = await self._store.hit(current_key, previous_key, ttl)
        except CacheUnavailableError:
            logger.warning("ratelimit.store_unavailable")
            current, previous = await self._fallback.hit(current_key, previous_key, ttl)
        weight = 1 - elapsed / self._window
        if previous * weight + current <= self._limit:
            return Decision(allowed=True)
        return Decision(
            allowed=False,
            retry_after_seconds=self._retry_after(elapsed, current, previous),
        )

    def _retry_after(self, elapsed: float, current: int, previous: int) -> int:
        """Seconds until one more request would fit the sliding estimate."""
        window, limit = self._window, self._limit
        headroom = limit - current - 1
        if headroom >= 0 and previous > 0:
            # It may fit later in this window, once enough of the previous fades.
            wait = window * (1 - headroom / previous) - elapsed
            if elapsed + wait < window:
                return max(1, ceil(wait))
        # Otherwise it fits only in the next window, where this one is previous.
        wait = (window - elapsed) + max(0.0, window * (1 - (limit - 1) / current))
        return max(1, ceil(wait))

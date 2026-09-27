"""Process-wide ceiling on requests sent to IGDB."""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from math import ceil
from time import monotonic

from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransportError,
)
from whattoplaynext_api.core.telemetry import (
    record_provider_attempt,
    record_provider_wait,
)


class ProviderThrottle:
    """Keep every IGDB request from this process within the provider's limits.

    IGDB allows four requests per second and eight open requests. Starts are
    spaced evenly, and a request that could not start before its deadline is
    refused as unavailable: the visitor did not cause that pressure, and the
    cache may still answer with stale data.
    """

    def __init__(
        self,
        *,
        per_second: float,
        max_in_flight: int,
        clock: Callable[[], float] = monotonic,
        sleeper: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._interval = 1 / per_second
        self._in_flight = asyncio.Semaphore(max_in_flight)
        self._clock = clock
        self._sleeper = sleeper
        self._next_start = float("-inf")

    @asynccontextmanager
    async def slot(self, max_wait: float) -> AsyncIterator[None]:
        """Wait at most ``max_wait`` seconds for a turn, then hold it."""
        started = self._clock()
        start_at = max(started, self._next_start)
        delay = start_at - started
        if delay > max_wait:
            record_provider_attempt("throttled")
            raise IgdbTransportError(
                IgdbErrorReason.UNAVAILABLE,
                retry_after_seconds=max(1, ceil(delay)),
            )
        self._next_start = start_at + self._interval
        if delay > 0:
            await self._sleeper(delay)
        if self._in_flight.locked():
            remaining = max_wait - (self._clock() - started)
            try:
                async with asyncio.timeout(max(remaining, 0)):
                    await self._in_flight.acquire()
            except TimeoutError:
                record_provider_attempt("throttled")
                raise IgdbTransportError(
                    IgdbErrorReason.UNAVAILABLE, retry_after_seconds=1
                ) from None
        else:
            await self._in_flight.acquire()
        record_provider_wait(self._clock() - started)
        try:
            yield
        finally:
            self._in_flight.release()

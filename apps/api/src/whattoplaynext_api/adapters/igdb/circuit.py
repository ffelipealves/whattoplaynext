"""Circuit breaker around IGDB access."""

import logging
from collections.abc import Awaitable, Callable
from enum import StrEnum
from math import ceil
from time import monotonic

from whattoplaynext_api.adapters.igdb.catalog import IgdbQueryTransport
from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransportError,
)

logger = logging.getLogger("whattoplaynext_api.provider")

# Failures that mean IGDB could not answer. Opening the circuit gives it room
# to recover; for anything else it would only hide a defect or bad credentials.
COUNTED_REASONS = frozenset(
    {
        IgdbErrorReason.RATE_LIMITED,
        IgdbErrorReason.TIMEOUT,
        IgdbErrorReason.UNAVAILABLE,
    }
)


class CircuitState(StrEnum):
    """Provider circuit state, safe to report to monitoring."""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half-open"


class ProviderCircuit:
    """Stop calling IGDB after repeated failures, then probe it once.

    ``failure_threshold`` consecutive counted failures open the circuit for
    ``open_seconds``. Afterwards one caller probes while the rest keep failing
    fast; success closes the circuit, and failure reopens it for twice as long,
    up to ``max_open_seconds``. Process-local by design (technical debt 17).
    """

    def __init__(
        self,
        *,
        failure_threshold: int,
        open_seconds: float,
        max_open_seconds: float,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        if failure_threshold < 1:
            msg = "The failure threshold must be at least one"
            raise ValueError(msg)
        if max_open_seconds < open_seconds:
            msg = "The maximum open duration cannot be shorter than the first"
            raise ValueError(msg)
        self._threshold = failure_threshold
        self._base_open = open_seconds
        self._max_open = max_open_seconds
        self._clock = clock
        self._failures = 0
        self._open_for = open_seconds
        self._open_until: float | None = None
        self._probing = False

    @property
    def state(self) -> CircuitState:
        if self._open_until is None:
            return CircuitState.CLOSED
        if self._probing or self._clock() >= self._open_until:
            return CircuitState.HALF_OPEN
        return CircuitState.OPEN

    async def call[T](self, operation: Callable[[], Awaitable[T]]) -> T:
        """Run one provider operation unless the circuit forbids it."""
        probe = self._admit()
        try:
            result = await operation()
        except IgdbTransportError as error:
            if error.reason in COUNTED_REASONS:
                self._record_failure(probe)
            else:
                logger.error(
                    "provider.failure_not_counted",
                    extra={"reason": error.reason.value},
                )
                # IGDB answered, so it is reachable again.
                self._record_success(probe)
            raise
        except BaseException:
            if probe:
                self._probing = False
            raise
        self._record_success(probe)
        return result

    def _admit(self) -> bool:
        """Return whether this call is the half-open probe; refuse if open."""
        if self._open_until is None:
            return False
        now = self._clock()
        if now < self._open_until:
            raise IgdbTransportError(
                IgdbErrorReason.UNAVAILABLE,
                retry_after_seconds=max(1, ceil(self._open_until - now)),
            )
        if self._probing:
            raise IgdbTransportError(IgdbErrorReason.UNAVAILABLE, retry_after_seconds=1)
        self._probing = True
        logger.info("circuit.half_open")
        return True

    def _record_failure(self, probe: bool) -> None:
        if probe:
            self._probing = False
            self._open_for = min(self._open_for * 2, self._max_open)
            self._open(self._open_for)
            return
        if self._open_until is not None:
            # A call admitted before the circuit opened finished late.
            return
        self._failures += 1
        if self._failures >= self._threshold:
            self._open(self._open_for)

    def _record_success(self, probe: bool) -> None:
        if probe:
            self._probing = False
            self._open_until = None
            self._open_for = self._base_open
            logger.info("circuit.closed")
        if self._open_until is None:
            self._failures = 0

    def _open(self, seconds: float) -> None:
        self._failures = 0
        self._open_until = self._clock() + seconds
        logger.warning("circuit.opened", extra={"open_seconds": seconds})


class CircuitBreakingTransport:
    """An IGDB transport whose every operation passes through the circuit."""

    def __init__(self, inner: IgdbQueryTransport, circuit: ProviderCircuit) -> None:
        self._inner = inner
        self._circuit = circuit

    async def query(self, endpoint: str, query: str) -> list[dict[str, object]]:
        return await self._circuit.call(lambda: self._inner.query(endpoint, query))

    async def count(self, endpoint: str, query: str) -> int:
        return await self._circuit.call(lambda: self._inner.count(endpoint, query))

"""Tests for the circuit breaker around IGDB access."""

import asyncio
import logging

import pytest
from cache_fakes import InMemoryCacheStore, ManualClock

from whattoplaynext_api.adapters.igdb.catalog import IgdbCatalog
from whattoplaynext_api.adapters.igdb.circuit import (
    CircuitBreakingTransport,
    CircuitState,
    ProviderCircuit,
)
from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransportError,
)
from whattoplaynext_api.cache.cache import Cache
from whattoplaynext_api.cache.catalog import CachingCatalog
from whattoplaynext_api.catalog.models import BrowseCriteria, SortOption
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode


class Clock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now


class ScriptedTransport:
    """Answers each call with the next scripted outcome, then keeps the last."""

    def __init__(self, *outcomes: IgdbErrorReason | None) -> None:
        self.outcomes = list(outcomes) or [None]
        self.calls = 0
        self.release = asyncio.Event()
        self.release.set()

    async def _answer(self) -> None:
        index = min(self.calls, len(self.outcomes) - 1)
        self.calls += 1
        await self.release.wait()
        reason = self.outcomes[index]
        if reason is not None:
            raise IgdbTransportError(reason)

    async def query(self, endpoint: str, query: str) -> list[dict[str, object]]:
        await self._answer()
        return []

    async def count(self, endpoint: str, query: str) -> int:
        await self._answer()
        return 0


def build(
    *outcomes: IgdbErrorReason | None,
) -> tuple[CircuitBreakingTransport, ScriptedTransport, ProviderCircuit, Clock]:
    clock = Clock()
    circuit = ProviderCircuit(
        failure_threshold=5, open_seconds=30, max_open_seconds=300, clock=clock
    )
    inner = ScriptedTransport(*outcomes)
    return CircuitBreakingTransport(inner, circuit), inner, circuit, clock


async def fail_times(transport: CircuitBreakingTransport, times: int) -> None:
    for _ in range(times):
        with pytest.raises(IgdbTransportError):
            await transport.query("games", "fields id;")


TIMEOUT = IgdbErrorReason.TIMEOUT


def state_of(circuit: ProviderCircuit) -> CircuitState:
    """Read the state afresh; the property changes between assertions."""
    return circuit.state


@pytest.mark.anyio
@pytest.mark.parametrize(
    "reason",
    [
        IgdbErrorReason.TIMEOUT,
        IgdbErrorReason.UNAVAILABLE,
        IgdbErrorReason.RATE_LIMITED,
    ],
)
async def test_five_consecutive_counted_failures_open_the_circuit(
    reason: IgdbErrorReason,
) -> None:
    transport, inner, circuit, _ = build(reason)

    await fail_times(transport, 5)

    assert circuit.state is CircuitState.OPEN
    with pytest.raises(IgdbTransportError) as raised:
        await transport.count("games", "where id = 1;")
    assert raised.value.reason is IgdbErrorReason.UNAVAILABLE
    assert raised.value.retry_after_seconds == 30
    assert inner.calls == 5


@pytest.mark.anyio
async def test_a_success_resets_the_consecutive_count() -> None:
    transport, _, circuit, _ = build(TIMEOUT, TIMEOUT, TIMEOUT, TIMEOUT, None, TIMEOUT)

    await fail_times(transport, 4)
    await transport.query("games", "fields id;")
    await fail_times(transport, 4)

    assert circuit.state is CircuitState.CLOSED


@pytest.mark.anyio
@pytest.mark.parametrize(
    "reason",
    [
        IgdbErrorReason.INVALID_REQUEST,
        IgdbErrorReason.INVALID_RESPONSE,
        IgdbErrorReason.AUTHENTICATION_REJECTED,
    ],
)
async def test_failures_that_opening_cannot_fix_never_open_it(
    reason: IgdbErrorReason, caplog: pytest.LogCaptureFixture
) -> None:
    transport, _, circuit, _ = build(reason)

    with caplog.at_level(logging.ERROR, logger="whattoplaynext_api.provider"):
        await fail_times(transport, 10)

    assert circuit.state is CircuitState.CLOSED
    assert {record.message for record in caplog.records} == {
        "provider.failure_not_counted"
    }
    assert {record.__dict__["reason"] for record in caplog.records} == {reason.value}


@pytest.mark.anyio
async def test_the_retry_delay_counts_down_while_open() -> None:
    transport, _, _, clock = build(TIMEOUT)
    await fail_times(transport, 5)

    clock.now += 21.5
    with pytest.raises(IgdbTransportError) as raised:
        await transport.query("games", "fields id;")

    assert raised.value.retry_after_seconds == 9


@pytest.mark.anyio
async def test_a_successful_half_open_probe_closes_the_circuit(
    caplog: pytest.LogCaptureFixture,
) -> None:
    transport, inner, circuit, clock = build(*[TIMEOUT] * 5, None)
    with caplog.at_level(logging.INFO, logger="whattoplaynext_api.provider"):
        await fail_times(transport, 5)
        clock.now += 30

        assert state_of(circuit) is CircuitState.HALF_OPEN
        await transport.query("games", "fields id;")

    assert state_of(circuit) is CircuitState.CLOSED
    assert inner.calls == 6
    assert [record.message for record in caplog.records] == [
        "circuit.opened",
        "circuit.half_open",
        "circuit.closed",
    ]


@pytest.mark.anyio
async def test_only_one_probe_runs_while_half_open() -> None:
    transport, inner, _, clock = build(*[TIMEOUT] * 5, None)
    await fail_times(transport, 5)
    clock.now += 30
    inner.release.clear()

    probe = asyncio.ensure_future(transport.query("games", "fields id;"))
    await asyncio.sleep(0)
    with pytest.raises(IgdbTransportError) as raised:
        await transport.query("games", "fields id;")
    inner.release.set()
    await probe

    assert raised.value.reason is IgdbErrorReason.UNAVAILABLE
    assert raised.value.retry_after_seconds == 1
    assert inner.calls == 6


@pytest.mark.anyio
async def test_a_failed_probe_reopens_for_twice_as_long_up_to_the_cap() -> None:
    transport, _, circuit, clock = build(TIMEOUT)
    await fail_times(transport, 5)

    expected = [60, 120, 240, 300, 300]
    for open_seconds in expected:
        clock.now += 1_000
        await fail_times(transport, 1)
        assert circuit.state is CircuitState.OPEN
        with pytest.raises(IgdbTransportError) as raised:
            await transport.query("games", "fields id;")
        assert raised.value.retry_after_seconds == open_seconds


@pytest.mark.anyio
async def test_closing_resets_the_open_duration() -> None:
    transport, inner, _, clock = build(TIMEOUT)
    await fail_times(transport, 5)
    clock.now += 30
    await fail_times(transport, 1)  # reopened for 60 s
    clock.now += 60
    inner.outcomes = [None]
    await transport.query("games", "fields id;")

    inner.outcomes = [TIMEOUT]
    await fail_times(transport, 5)
    with pytest.raises(IgdbTransportError) as raised:
        await transport.query("games", "fields id;")

    assert raised.value.retry_after_seconds == 30


@pytest.mark.anyio
async def test_a_probe_answered_with_a_non_counted_failure_closes_the_circuit() -> None:
    transport, _, circuit, clock = build(
        *[TIMEOUT] * 5, IgdbErrorReason.INVALID_RESPONSE
    )
    await fail_times(transport, 5)
    clock.now += 30

    await fail_times(transport, 1)

    # IGDB answered, so it is reachable; the invalid payload is another problem.
    assert circuit.state is CircuitState.CLOSED


@pytest.mark.anyio
async def test_a_cancelled_probe_lets_the_next_caller_probe() -> None:
    transport, inner, circuit, clock = build(*[TIMEOUT] * 5, None)
    await fail_times(transport, 5)
    clock.now += 30
    inner.release.clear()

    probe = asyncio.ensure_future(transport.query("games", "fields id;"))
    await asyncio.sleep(0)
    probe.cancel()
    with pytest.raises(asyncio.CancelledError):
        await probe
    inner.release.set()

    await transport.query("games", "fields id;")
    assert circuit.state is CircuitState.CLOSED


@pytest.mark.anyio
async def test_an_open_circuit_reaches_the_visitor_as_a_retryable_outage() -> None:
    transport, inner, _, _ = build(TIMEOUT)
    catalog = IgdbCatalog(transport)
    for _ in range(5):
        with pytest.raises(ApplicationError):
            await catalog.browse_games(BrowseCriteria())
    calls_before = inner.calls

    with pytest.raises(ApplicationError) as raised:
        await catalog.browse_games(BrowseCriteria())

    assert raised.value.code is ErrorCode.UPSTREAM_UNAVAILABLE
    assert raised.value.retry_after_seconds == 30
    assert inner.calls == calls_before


def test_rejects_invalid_thresholds() -> None:
    with pytest.raises(ValueError):
        ProviderCircuit(failure_threshold=0, open_seconds=30, max_open_seconds=300)
    with pytest.raises(ValueError):
        ProviderCircuit(failure_threshold=5, open_seconds=30, max_open_seconds=10)


@pytest.mark.anyio
async def test_calls_admitted_before_opening_that_fail_late_change_nothing() -> None:
    transport, inner, circuit, _ = build(TIMEOUT)
    inner.release.clear()

    pending = [
        asyncio.ensure_future(transport.query("games", "fields id;")) for _ in range(7)
    ]
    await asyncio.sleep(0)
    inner.release.set()
    await asyncio.gather(*pending, return_exceptions=True)

    assert circuit.state is CircuitState.OPEN
    with pytest.raises(IgdbTransportError) as raised:
        await transport.query("games", "fields id;")
    assert raised.value.retry_after_seconds == 30


@pytest.mark.anyio
async def test_while_open_the_cache_still_answers_fresh_and_stale() -> None:
    # A healthy IGDB fills the cache, then fails until the circuit opens.
    cache_clock = ManualClock()
    transport, inner, circuit, _ = build(None)
    catalog = CachingCatalog(
        IgdbCatalog(transport),
        Cache(InMemoryCacheStore(cache_clock), clock=cache_clock),
        environment="test",
        api_version="v1",
        clock=cache_clock,
    )
    cached_rating = BrowseCriteria(sort=SortOption.RATING)
    stale_title = BrowseCriteria(sort=SortOption.TITLE)
    await catalog.browse_games(stale_title)
    cache_clock.advance(hours=2)
    await catalog.browse_games(cached_rating)

    inner.outcomes = [TIMEOUT]
    for page in range(2, 7):
        with pytest.raises(ApplicationError):
            await catalog.browse_games(BrowseCriteria(page=page))
    assert circuit.state is CircuitState.OPEN
    calls_when_opened = inner.calls

    fresh = await catalog.browse_games(cached_rating)
    stale = await catalog.browse_games(stale_title)
    with pytest.raises(ApplicationError) as raised:
        await catalog.browse_games(BrowseCriteria(page=9))

    assert fresh.meta.data_may_be_stale is False
    assert stale.meta.data_may_be_stale is True
    assert raised.value.code is ErrorCode.UPSTREAM_UNAVAILABLE
    assert raised.value.retry_after_seconds == 30
    assert inner.calls == calls_when_opened

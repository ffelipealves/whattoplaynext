"""Tests for the process-wide IGDB request throttle."""

import asyncio

import httpx
import pytest

from whattoplaynext_api.adapters.igdb.throttle import ProviderThrottle
from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransport,
    IgdbTransportError,
)


class VirtualTime:
    """A monotonic clock whose sleeps advance it instantly."""

    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.now += seconds
        await asyncio.sleep(0)


def throttle(
    time: VirtualTime, *, per_second: float = 4, in_flight: int = 8
) -> ProviderThrottle:
    return ProviderThrottle(
        per_second=per_second,
        max_in_flight=in_flight,
        clock=time,
        sleeper=time.sleep,
    )


@pytest.mark.anyio
async def test_spaces_request_starts_to_the_per_second_ceiling() -> None:
    time = VirtualTime()
    gate = throttle(time)
    starts: list[float] = []

    for _ in range(5):
        async with gate.slot(max_wait=10):
            starts.append(time.now)

    assert starts == [0.0, 0.25, 0.5, 0.75, 1.0]


@pytest.mark.anyio
async def test_an_idle_throttle_starts_immediately() -> None:
    time = VirtualTime()
    gate = throttle(time)
    async with gate.slot(max_wait=10):
        pass

    time.now = 30.0
    async with gate.slot(max_wait=0):
        assert time.now == 30.0


@pytest.mark.anyio
async def test_a_slot_further_away_than_the_deadline_is_refused_unreserved() -> None:
    time = VirtualTime()
    gate = throttle(time, per_second=1)
    async with gate.slot(max_wait=10):
        pass

    with pytest.raises(IgdbTransportError) as raised:
        async with gate.slot(max_wait=0.5):
            pass

    assert raised.value.reason is IgdbErrorReason.UNAVAILABLE
    assert raised.value.retry_after_seconds == 1
    # The refused request did not push later callers back.
    async with gate.slot(max_wait=10):
        assert time.now == 1.0


@pytest.mark.anyio
async def test_holds_at_most_the_in_flight_ceiling() -> None:
    time = VirtualTime()
    gate = throttle(time, per_second=1_000, in_flight=2)
    release = asyncio.Event()
    active = 0
    peak = 0

    async def request() -> None:
        nonlocal active, peak
        async with gate.slot(max_wait=60):
            active += 1
            peak = max(peak, active)
            await release.wait()
            active -= 1

    pending = [asyncio.ensure_future(request()) for _ in range(5)]
    for _ in range(20):
        await asyncio.sleep(0)
    assert peak == 2

    release.set()
    await asyncio.gather(*pending)
    assert peak == 2


@pytest.mark.anyio
async def test_a_full_house_past_the_deadline_is_refused() -> None:
    gate = ProviderThrottle(per_second=1_000, max_in_flight=1)
    release = asyncio.Event()

    async def holder() -> None:
        async with gate.slot(max_wait=5):
            await release.wait()

    held = asyncio.ensure_future(holder())
    await asyncio.sleep(0)

    with pytest.raises(IgdbTransportError) as raised:
        async with gate.slot(max_wait=0.05):
            pass

    assert raised.value.reason is IgdbErrorReason.UNAVAILABLE
    release.set()
    await held


class FakeTokenProvider:
    async def get_access_token(self) -> str:
        return "token"


class RecordingThrottle(ProviderThrottle):
    def __init__(self) -> None:
        super().__init__(per_second=1_000, max_in_flight=8)
        self.slots: list[float] = []

    def slot(self, max_wait: float):  # type: ignore[no-untyped-def]
        self.slots.append(max_wait)
        return super().slot(max_wait)


@pytest.mark.anyio
async def test_the_transport_takes_a_slot_for_every_attempt_including_retries() -> None:
    responses = iter([httpx.Response(503), httpx.Response(200, json=[{"id": 1}])])

    async def handler(request: httpx.Request) -> httpx.Response:
        return next(responses)

    recording = RecordingThrottle()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="client",
            token_provider=FakeTokenProvider(),
            jitter=lambda delay: 0,
            throttle=recording,
        )

        assert await transport.query("games", "fields id;") == [{"id": 1}]

    assert len(recording.slots) == 2
    assert all(0 < wait <= 10 for wait in recording.slots)


@pytest.mark.anyio
async def test_a_refused_slot_is_not_retried_by_the_transport() -> None:
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=[])

    class Refusing(ProviderThrottle):
        def slot(self, max_wait: float):  # type: ignore[no-untyped-def]
            raise IgdbTransportError(IgdbErrorReason.UNAVAILABLE, retry_after_seconds=2)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="client",
            token_provider=FakeTokenProvider(),
            throttle=Refusing(per_second=1, max_in_flight=1),
        )

        with pytest.raises(IgdbTransportError) as raised:
            await transport.query("games", "fields id;")

    assert raised.value.retry_after_seconds == 2
    assert calls == 0

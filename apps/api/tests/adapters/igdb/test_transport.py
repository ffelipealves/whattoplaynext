"""Behavior tests for the authenticated IGDB transport."""

import httpx
import pytest

from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransport,
    IgdbTransportError,
)


class FakeTokenProvider:
    async def get_access_token(self) -> str:
        return "test-access-token"


class MutableClock:
    def __init__(self, now: float = 0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


@pytest.mark.anyio
async def test_queries_igdb_with_server_side_authentication() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url == httpx.URL("https://api.igdb.com/v4/games")
        assert request.headers["client-id"] == "test-client-id"
        assert request.headers["authorization"] == "Bearer test-access-token"
        assert request.headers["accept"] == "application/json"
        assert request.content == b"fields id,name; limit 1;"
        assert set(request.extensions["timeout"].values()) == {2.0}
        return httpx.Response(200, json=[{"id": 1942, "name": "The Witcher 3"}])

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="test-client-id",
            token_provider=FakeTokenProvider(),
            request_timeout_seconds=2,
        )

        result = await transport.query("games", "fields id,name; limit 1;")

    assert result == [{"id": 1942, "name": "The Witcher 3"}]


@pytest.mark.anyio
async def test_retries_one_timeout_then_reports_exhaustion() -> None:
    attempts = 0
    waits: list[float] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.ReadTimeout("provider timeout details", request=request)

    async def sleep(delay: float) -> None:
        waits.append(delay)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="test-client-id",
            token_provider=FakeTokenProvider(),
            retry_delay_seconds=0.25,
            jitter=lambda delay: delay / 2,
            sleeper=sleep,
        )

        with pytest.raises(IgdbTransportError) as error:
            await transport.query("games", "fields id; limit 1;")

    assert error.value.reason is IgdbErrorReason.TIMEOUT
    assert "provider timeout details" not in str(error.value)
    assert attempts == 2
    assert waits == [0.125]


@pytest.mark.anyio
async def test_bounds_retry_after_before_retrying_a_rate_limit() -> None:
    attempts = 0
    waits: list[float] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"Retry-After": "30"})
        return httpx.Response(200, json=[{"id": 1942}])

    async def sleep(delay: float) -> None:
        waits.append(delay)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="test-client-id",
            token_provider=FakeTokenProvider(),
            max_retry_delay_seconds=2,
            sleeper=sleep,
        )

        result = await transport.query("games", "fields id; limit 1;")

    assert result == [{"id": 1942}]
    assert attempts == 2
    assert waits == [2]


@pytest.mark.anyio
async def test_retries_one_transient_server_failure_with_jitter() -> None:
    attempts = 0
    waits: list[float] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, text="provider details")
        return httpx.Response(200, json=[])

    async def sleep(delay: float) -> None:
        waits.append(delay)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="test-client-id",
            token_provider=FakeTokenProvider(),
            retry_delay_seconds=0.2,
            jitter=lambda delay: delay / 2,
            sleeper=sleep,
        )

        result = await transport.query("games", "fields id; limit 1;")

    assert result == []
    assert attempts == 2
    assert waits == [0.1]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("status_code", "reason"),
    [
        (400, IgdbErrorReason.INVALID_REQUEST),
        (401, IgdbErrorReason.AUTHENTICATION_REJECTED),
        (403, IgdbErrorReason.AUTHENTICATION_REJECTED),
    ],
)
async def test_does_not_retry_permanent_client_failures(
    status_code: int,
    reason: IgdbErrorReason,
) -> None:
    attempts = 0
    waits: list[float] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(status_code, text="private provider payload")

    async def sleep(delay: float) -> None:
        waits.append(delay)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="test-client-id",
            token_provider=FakeTokenProvider(),
            sleeper=sleep,
        )

        with pytest.raises(IgdbTransportError) as error:
            await transport.query("games", "fields id; limit 1;")

    assert error.value.reason is reason
    assert "private provider payload" not in str(error.value)
    assert attempts == 1
    assert waits == []


@pytest.mark.anyio
async def test_rejects_a_malformed_success_payload() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": "object"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="test-client-id",
            token_provider=FakeTokenProvider(),
        )

        with pytest.raises(IgdbTransportError) as error:
            await transport.query("games", "fields id; limit 1;")

    assert error.value.reason is IgdbErrorReason.INVALID_RESPONSE


@pytest.mark.anyio
async def test_does_not_retry_beyond_the_total_deadline() -> None:
    attempts = 0
    waits: list[float] = []
    clock = MutableClock()

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        clock.now = 0.8
        return httpx.Response(503)

    async def sleep(delay: float) -> None:
        waits.append(delay)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="test-client-id",
            token_provider=FakeTokenProvider(),
            retry_delay_seconds=0.4,
            retry_deadline_seconds=1,
            jitter=lambda delay: delay,
            sleeper=sleep,
            clock=clock,
        )

        with pytest.raises(IgdbTransportError) as error:
            await transport.query("games", "fields id; limit 1;")

    assert error.value.reason is IgdbErrorReason.UNAVAILABLE
    assert attempts == 1
    assert waits == []


@pytest.mark.anyio
async def test_classifies_network_failure_after_one_retry() -> None:
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.ConnectError("private network details", request=request)

    async def sleep(delay: float) -> None:
        return None

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="test-client-id",
            token_provider=FakeTokenProvider(),
            sleeper=sleep,
        )

        with pytest.raises(IgdbTransportError) as error:
            await transport.query("games", "fields id; limit 1;")

    assert error.value.reason is IgdbErrorReason.UNAVAILABLE
    assert "private network details" not in str(error.value)
    assert attempts == 2


@pytest.mark.anyio
async def test_reports_a_bounded_retry_after_when_rate_limit_is_exhausted() -> None:
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(
            429,
            headers={"Retry-After": "30"},
            text="private quota details",
        )

    async def sleep(delay: float) -> None:
        return None

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        transport = IgdbTransport(
            client=client,
            client_id="test-client-id",
            token_provider=FakeTokenProvider(),
            max_retry_delay_seconds=2,
            sleeper=sleep,
        )

        with pytest.raises(IgdbTransportError) as error:
            await transport.query("games", "fields id; limit 1;")

    assert error.value.reason is IgdbErrorReason.RATE_LIMITED
    assert error.value.retry_after_seconds == 2
    assert "private quota details" not in str(error.value)
    assert attempts == 2

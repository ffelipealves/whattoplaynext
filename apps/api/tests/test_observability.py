"""Structured logs, request telemetry, redaction, and readiness."""

import io
import json
import logging
import sys
from collections.abc import Iterator

import httpx
import pytest
from cache_fakes import FailingCacheStore, InMemoryCacheStore, ManualClock
from fixture_catalog import FixtureCatalog
from httpx2 import ASGITransport, AsyncClient
from pydantic import SecretStr

from whattoplaynext_api.adapters.igdb.circuit import ProviderCircuit
from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransport,
    IgdbTransportError,
)
from whattoplaynext_api.catalog.models import BrowseCriteria, GamePage
from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.core.structured_logging import (
    JsonFormatter,
    configure_logging,
)
from whattoplaynext_api.core.telemetry import request_scope
from whattoplaynext_api.main import build_rate_limiting, create_app
from whattoplaynext_api.ratelimit.identity import (
    CLIENT_ADDRESS_HEADER,
    EDGE_TOKEN_HEADER,
)

EDGE_TOKEN = "edge-token-value-9f2c"
VISITOR_ADDRESS = "203.0.113.77"
SEARCH_TEXT = "Unmistakable Search Phrase"


@pytest.fixture
def json_log() -> Iterator[io.StringIO]:
    """Capture everything the application logs, as the served process would."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    app_logger = logging.getLogger("whattoplaynext_api")
    previous_level = app_logger.level
    app_logger.addHandler(handler)
    app_logger.setLevel(logging.DEBUG)
    yield stream
    app_logger.removeHandler(handler)
    app_logger.setLevel(previous_level)


def lines(stream: io.StringIO) -> list[dict[str, object]]:
    return [json.loads(line) for line in stream.getvalue().splitlines()]


def record(**extra: object) -> logging.LogRecord:
    entry = logging.LogRecord(
        "whattoplaynext_api.test", logging.INFO, __file__, 1, "test.event", None, None
    )
    entry.__dict__.update(extra)
    return entry


def test_formats_one_json_object_with_allow_listed_fields_only() -> None:
    line = json.loads(
        JsonFormatter().format(
            record(resource="search", error_code="UPSTREAM_TIMEOUT", query="zelda")
        )
    )

    assert line["event"] == "test.event"
    assert line["level"] == "info"
    assert line["logger"] == "whattoplaynext_api.test"
    assert line["resource"] == "search"
    assert line["errorCode"] == "UPSTREAM_TIMEOUT"
    assert "query" not in line
    assert "zelda" not in json.dumps(line)


def test_includes_the_request_id_of_the_current_request() -> None:
    with request_scope("req-123"):
        line = json.loads(JsonFormatter().format(record()))

    assert line["requestId"] == "req-123"


def test_keeps_an_exceptions_type_and_stack_but_never_its_message() -> None:
    try:
        raise ValueError("provider said: secret payload")
    except ValueError:
        entry = record()
        entry.exc_info = sys.exc_info()

    line = json.loads(JsonFormatter().format(entry))

    assert line["exceptionType"] == "ValueError"
    assert any("test_observability.py" in frame for frame in line["stack"])
    assert "secret payload" not in json.dumps(line)


def test_configuring_twice_keeps_one_handler_and_silences_noisy_loggers() -> None:
    root = logging.getLogger()
    before = list(root.handlers)
    try:
        configure_logging(io.StringIO())
        configure_logging(io.StringIO())
        ours = [h for h in root.handlers if isinstance(h.formatter, JsonFormatter)]

        assert len(ours) == 1
        assert logging.getLogger("uvicorn.access").disabled
        assert logging.getLogger("httpx").level == logging.WARNING
        assert logging.getLogger("uvicorn.error").handlers == []
    finally:
        for handler in list(root.handlers):
            if handler not in before:
                root.removeHandler(handler)
        for handler in before:
            if handler not in root.handlers:
                root.addHandler(handler)


def served_app(catalog: FixtureCatalog | None = None) -> AsyncClient:
    """The application behind a client that, like a browser, sees a 500."""
    application = create_app(
        Settings(environment="test"),
        catalog=catalog or FixtureCatalog(),
        cache_store=InMemoryCacheStore(ManualClock()),
        rate_limiting=build_rate_limiting(
            Settings(environment="test", edge_token=SecretStr(EDGE_TOKEN))
        ),
    )
    return AsyncClient(
        transport=ASGITransport(app=application, raise_app_exceptions=False),
        base_url="http://testserver",
    )


@pytest.mark.anyio
async def test_logs_one_request_line_with_what_the_request_did(
    json_log: io.StringIO,
) -> None:
    async with served_app() as client:
        await client.get("/api/v1/games", params={"platform": "pc"})
        response = await client.get(
            "/api/v1/games",
            params={"platform": "pc"},
            headers={"X-Request-ID": "web-req-1"},
        )

    request_lines = [
        line for line in lines(json_log) if line["event"] == "http.request"
    ]
    assert len(request_lines) == 2
    second = request_lines[1]
    assert second["requestId"] == "web-req-1" == response.headers["x-request-id"]
    assert second["method"] == "GET"
    assert second["route"] == "/api/v1/games"
    assert second["status"] == 200
    assert isinstance(second["durationMs"], float)
    assert second["cache"] == ["hit"]
    assert second["providerAttempts"] == []
    assert second["rateLimit"] == "allowed"
    assert second["circuit"] == "not-configured"
    assert request_lines[0]["cache"] == ["miss"]


@pytest.mark.anyio
async def test_logs_the_route_template_not_the_path(json_log: io.StringIO) -> None:
    async with served_app() as client:
        await client.get("/api/v1/games/1942")
        await client.get("/api/v1/no-such-route")

    routes = [
        line["route"] for line in lines(json_log) if line["event"] == "http.request"
    ]
    assert routes == ["/api/v1/games/{gameId}", "unmatched"]


@pytest.mark.anyio
async def test_no_log_line_carries_query_text_addresses_or_secrets(
    json_log: io.StringIO,
) -> None:
    async with served_app() as client:
        await client.get(
            "/api/v1/games",
            params={"name": SEARCH_TEXT},
            headers={
                CLIENT_ADDRESS_HEADER: VISITOR_ADDRESS,
                EDGE_TOKEN_HEADER: EDGE_TOKEN,
                "X-Forwarded-For": "198.51.100.200",
            },
        )
        await client.get(
            "/api/v1/games/autocomplete",
            params={"q": SEARCH_TEXT},
            headers={CLIENT_ADDRESS_HEADER: VISITOR_ADDRESS, EDGE_TOKEN_HEADER: "bad"},
        )

    output = json_log.getvalue()
    assert output
    for forbidden in (
        SEARCH_TEXT,
        SEARCH_TEXT.replace(" ", "+"),
        SEARCH_TEXT.replace(" ", "%20"),
        VISITOR_ADDRESS,
        "198.51.100.200",
        "127.0.0.1",
        EDGE_TOKEN,
        "?",
    ):
        assert forbidden not in output


@pytest.mark.anyio
async def test_an_unexpected_error_is_logged_with_its_type_only(
    json_log: io.StringIO,
) -> None:
    class ExplodingCatalog(FixtureCatalog):
        async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
            raise RuntimeError("leaked detail from the provider payload")

    async with served_app(catalog=ExplodingCatalog()) as client:
        response = await client.get("/api/v1/games")

    assert response.status_code == 500
    (error,) = [
        line for line in lines(json_log) if line["event"] == "http.unhandled_error"
    ]
    (request_line,) = [
        line for line in lines(json_log) if line["event"] == "http.request"
    ]
    assert error["exceptionType"] == "RuntimeError"
    assert error["requestId"] == response.json()["error"]["requestId"]
    assert request_line["status"] == 500
    assert request_line["requestId"] == error["requestId"]
    assert "leaked detail" not in json_log.getvalue()


class FailingOnceHandler:
    def __init__(self) -> None:
        self.responses = iter([httpx.Response(503), httpx.Response(200, json=[])])

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        return next(self.responses)


class Token:
    async def get_access_token(self) -> str:
        return "token"


@pytest.mark.anyio
async def test_provider_attempts_are_recorded_for_the_request() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(FailingOnceHandler())
    ) as client:
        transport = IgdbTransport(
            client=client,
            client_id="client",
            token_provider=Token(),
            jitter=lambda delay: 0,
        )
        with request_scope("req") as telemetry:
            await transport.query("games", "fields id;")

    assert telemetry.provider_attempts == ["server-error", "ok"]


@pytest.mark.anyio
async def test_an_open_circuit_is_recorded_as_a_refused_attempt() -> None:
    circuit = ProviderCircuit(failure_threshold=1, open_seconds=30, max_open_seconds=30)

    async def fail() -> None:
        raise IgdbTransportError(IgdbErrorReason.TIMEOUT)

    with request_scope("req") as telemetry:
        with pytest.raises(IgdbTransportError):
            await circuit.call(fail)
        with pytest.raises(IgdbTransportError):
            await circuit.call(fail)

    assert telemetry.provider_attempts == ["circuit-open"]


def readiness_app(*, store: object, circuit: ProviderCircuit | None) -> AsyncClient:
    application = create_app(
        Settings(environment="test"),
        catalog=FixtureCatalog(),
        cache_store=store,  # type: ignore[arg-type]
    )
    application.state.provider_circuit = circuit
    return AsyncClient(
        transport=ASGITransport(app=application), base_url="http://testserver"
    )


def closed_circuit() -> ProviderCircuit:
    return ProviderCircuit(failure_threshold=5, open_seconds=30, max_open_seconds=300)


@pytest.mark.anyio
async def test_readiness_is_ready_with_the_cache_up_and_the_circuit_closed() -> None:
    async with readiness_app(
        store=InMemoryCacheStore(ManualClock()), circuit=closed_circuit()
    ) as client:
        response = await client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "cache": "up", "provider": "closed"}


@pytest.mark.anyio
async def test_readiness_is_degraded_but_serving_when_the_cache_is_down() -> None:
    async with readiness_app(
        store=FailingCacheStore(), circuit=closed_circuit()
    ) as client:
        response = await client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "degraded",
        "cache": "down",
        "provider": "closed",
    }


@pytest.mark.anyio
async def test_readiness_is_unavailable_without_a_configured_provider() -> None:
    async with readiness_app(
        store=InMemoryCacheStore(ManualClock()), circuit=None
    ) as client:
        response = await client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "cache": "up",
        "provider": "not-configured",
    }
    assert "error" not in response.json()


@pytest.mark.anyio
async def test_readiness_is_never_rate_limited() -> None:
    async with served_app() as client:
        statuses = {
            (await client.get("/api/v1/health/ready")).status_code for _ in range(70)
        }

    assert 429 not in statuses

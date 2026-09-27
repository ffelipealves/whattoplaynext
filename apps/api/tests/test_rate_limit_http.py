"""Per-visitor rate limiting through the public HTTP routes."""

from collections.abc import AsyncIterator
from typing import Protocol

import pytest
from cache_fakes import InMemoryCacheStore, ManualClock
from fixture_catalog import FixtureCatalog
from httpx2 import ASGITransport, AsyncClient
from pydantic import SecretStr

from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import build_rate_limiting, create_app
from whattoplaynext_api.ratelimit.identity import (
    CLIENT_ADDRESS_HEADER,
    EDGE_TOKEN_HEADER,
    IdentityDigester,
)
from whattoplaynext_api.ratelimit.limiter import (
    InMemoryCounterStore,
    SlidingWindowLimiter,
)
from whattoplaynext_api.ratelimit.policy import RateLimiting

TOKEN = "edge-secret"


class ClientFactory(Protocol):
    def __call__(
        self,
        *,
        public: int = 60,
        provider: int = 20,
        cache_clock: ManualClock | None = None,
    ) -> AsyncClient: ...


class Clock:
    def __init__(self) -> None:
        self.now = 1_790_000_000.0

    def __call__(self) -> float:
        return self.now


def limits(clock: Clock, *, public: int, provider: int) -> RateLimiting:
    store = InMemoryCounterStore(clock)
    return RateLimiting(
        public=SlidingWindowLimiter(
            store,
            fallback=store,
            name="public",
            limit=public,
            window_seconds=60,
            clock=clock,
        ),
        provider=SlidingWindowLimiter(
            store,
            fallback=store,
            name="provider",
            limit=provider,
            window_seconds=60,
            clock=clock,
        ),
        digester=IdentityDigester(b"test-key"),
        edge_token=TOKEN,
        trusted_proxy_hops=0,
    )


@pytest.fixture
async def client_for() -> AsyncIterator[ClientFactory]:
    clients: list[AsyncClient] = []

    def build(
        *, public: int = 60, provider: int = 20, cache_clock: ManualClock | None = None
    ) -> AsyncClient:
        application = create_app(
            Settings(environment="test"),
            catalog=FixtureCatalog(),
            cache_store=InMemoryCacheStore(cache_clock or ManualClock()),
            rate_limiting=limits(Clock(), public=public, provider=provider),
        )
        client = AsyncClient(
            transport=ASGITransport(app=application), base_url="http://testserver"
        )
        clients.append(client)
        return client

    yield build
    for client in clients:
        await client.aclose()


def visitor(address: str) -> dict[str, str]:
    return {CLIENT_ADDRESS_HEADER: address, EDGE_TOKEN_HEADER: TOKEN}


@pytest.mark.anyio
async def test_the_request_over_the_public_ceiling_is_rate_limited(
    client_for: ClientFactory,
) -> None:
    client = client_for(public=3)

    statuses = [
        (await client.get("/api/v1/filters", headers={"X-Request-ID": "r"})).status_code
        for _ in range(3)
    ]
    rejected = await client.get("/api/v1/filters", headers={"X-Request-ID": "limited"})

    assert statuses == [200, 200, 200]
    assert rejected.status_code == 429
    body = rejected.json()["error"]
    assert body["code"] == "RATE_LIMITED"
    assert body["requestId"] == "limited"
    assert body["retryAfterSeconds"] >= 1
    assert rejected.headers["retry-after"] == str(body["retryAfterSeconds"])


@pytest.mark.anyio
async def test_health_checks_are_never_limited(client_for: ClientFactory) -> None:
    client = client_for(public=1)
    await client.get("/api/v1/filters")

    responses = [await client.get("/api/v1/health") for _ in range(5)]

    assert all(response.status_code == 200 for response in responses)


@pytest.mark.anyio
async def test_a_forged_address_without_the_token_counts_against_the_caller(
    client_for: ClientFactory,
) -> None:
    client = client_for(public=2)

    for address in ("198.51.100.1", "198.51.100.2"):
        await client.get("/api/v1/filters", headers={CLIENT_ADDRESS_HEADER: address})
    forged = await client.get(
        "/api/v1/filters", headers={CLIENT_ADDRESS_HEADER: "198.51.100.3"}
    )

    assert forged.status_code == 429


@pytest.mark.anyio
async def test_visitors_forwarded_by_the_web_server_have_separate_budgets(
    client_for: ClientFactory,
) -> None:
    client = client_for(public=1)

    first = await client.get("/api/v1/filters", headers=visitor("203.0.113.1"))
    second = await client.get("/api/v1/filters", headers=visitor("203.0.113.2"))
    again = await client.get("/api/v1/filters", headers=visitor("203.0.113.1"))

    assert (first.status_code, second.status_code, again.status_code) == (
        200,
        200,
        429,
    )


@pytest.mark.anyio
async def test_cache_hits_do_not_draw_on_the_provider_budget(
    client_for: ClientFactory,
) -> None:
    client = client_for(provider=1)

    responses = [
        await client.get("/api/v1/games", params={"platform": "pc"}) for _ in range(10)
    ]

    assert all(response.status_code == 200 for response in responses)


@pytest.mark.anyio
async def test_the_miss_over_the_provider_budget_is_rate_limited(
    client_for: ClientFactory,
) -> None:
    client = client_for(provider=2)

    statuses = [
        (await client.get("/api/v1/games", params={"page": page})).status_code
        for page in (1, 2, 3)
    ]

    assert statuses == [200, 200, 429]


def test_the_production_budgets_come_from_settings() -> None:
    limits = build_rate_limiting(
        Settings(
            environment="test",
            edge_token=SecretStr("from-settings"),
            identity_hmac_key=SecretStr("digest-key"),
            trusted_proxy_hops=1,
        )
    )

    assert limits.edge_token == "from-settings"
    assert limits.trusted_proxy_hops == 1
    assert limits.digester.digest("203.0.113.1") == IdentityDigester(
        b"digest-key"
    ).digest("203.0.113.1")


def test_without_a_configured_key_digests_use_a_random_process_key() -> None:
    settings = Settings(environment="test", identity_hmac_key=None, edge_token=None)

    first = build_rate_limiting(settings)
    second = build_rate_limiting(settings)

    assert first.edge_token is None
    assert first.digester.digest("203.0.113.1") != second.digester.digest("203.0.113.1")


def test_an_injected_catalog_without_injected_limits_is_not_rate_limited() -> None:
    application = create_app(Settings(environment="test"), catalog=FixtureCatalog())

    assert application.state.rate_limiting is None

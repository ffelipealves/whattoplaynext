"""Tests for production catalog composition."""

import pytest
from cache_fakes import InMemoryCacheStore, ManualClock
from fixture_catalog import FixtureCatalog
from httpx2 import ASGITransport, AsyncClient
from pydantic import RedisDsn, SecretStr

from whattoplaynext_api.adapters.igdb.catalog import IgdbCatalog
from whattoplaynext_api.adapters.igdb.circuit import CircuitState, ProviderCircuit
from whattoplaynext_api.adapters.redis.store import RedisCacheStore
from whattoplaynext_api.cache.cache import Cache, CacheHealth
from whattoplaynext_api.cache.catalog import CachingCatalog
from whattoplaynext_api.catalog.unavailable import UnavailableCatalog
from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import build_cache, build_catalog, create_app


def test_reports_unavailable_without_configured_credentials() -> None:
    catalog, client = build_catalog(
        Settings(
            environment="test",
            twitch_client_id=None,
            twitch_client_secret=None,
        )
    )

    assert isinstance(catalog, UnavailableCatalog)
    assert client is None


@pytest.mark.anyio
async def test_composes_the_production_catalog_with_configured_credentials() -> None:
    settings = Settings(
        environment="test",
        twitch_client_id="test-client-id",
        twitch_client_secret=SecretStr("test-client-secret"),
    )

    catalog, client = build_catalog(settings)

    try:
        assert isinstance(catalog, IgdbCatalog)
        assert client is not None
    finally:
        if client is not None:
            await client.aclose()


@pytest.mark.anyio
async def test_reports_the_catalog_unavailable_over_http_without_credentials() -> None:
    application = create_app(
        Settings(
            environment="test",
            twitch_client_id=None,
            twitch_client_secret=None,
        )
    )
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/filters",
            headers={"X-Request-ID": "composition-unavailable"},
        )

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "UPSTREAM_UNAVAILABLE",
            "message": "Game data is temporarily unavailable.",
            "requestId": "composition-unavailable",
        }
    }


@pytest.mark.anyio
async def test_composes_a_redis_backed_cache_from_the_configured_url() -> None:
    cache, store = build_cache(
        Settings(environment="test", redis_url=RedisDsn("redis://localhost:6379/0"))
    )

    try:
        assert isinstance(cache, Cache)
        assert isinstance(store, RedisCacheStore)
    finally:
        if store is not None:
            await store.aclose()


@pytest.mark.anyio
async def test_composes_a_disabled_cache_without_a_redis_url() -> None:
    cache, store = build_cache(Settings(environment="test", redis_url=None))

    assert store is None
    assert await cache.health() is CacheHealth.DISABLED


@pytest.mark.anyio
async def test_the_application_starts_and_serves_without_a_reachable_redis() -> None:
    application = create_app(
        Settings(
            environment="test",
            redis_url=RedisDsn("redis://127.0.0.1:1/0"),
            twitch_client_id=None,
            twitch_client_secret=None,
        )
    )

    async with (
        application.router.lifespan_context(application),
        AsyncClient(
            transport=ASGITransport(app=application), base_url="http://testserver"
        ) as client,
    ):
        health = await client.get("/api/v1/health")
        cache_health = await application.state.cache.health()

    assert health.status_code == 200
    assert cache_health is CacheHealth.DOWN


@pytest.mark.anyio
async def test_an_injected_catalog_is_not_given_a_cache_from_settings() -> None:
    # Tests and the browser fixture server inject their catalog; they must never
    # reach whatever Redis the developer's environment happens to configure.
    application = create_app(Settings(environment="test"), catalog=UnavailableCatalog())

    assert await application.state.cache.health() is CacheHealth.DISABLED


@pytest.mark.anyio
async def test_an_injected_cache_store_is_used_as_given() -> None:
    store = InMemoryCacheStore(ManualClock())
    application = create_app(
        Settings(environment="test"),
        catalog=UnavailableCatalog(),
        cache_store=store,
    )

    assert await application.state.cache.health() is CacheHealth.UP
    assert store.calls == ["ping"]


def test_the_production_catalog_is_wrapped_in_the_response_cache() -> None:
    application = create_app(
        Settings(
            environment="test",
            redis_url=None,
            twitch_client_id=None,
            twitch_client_secret=None,
        )
    )

    assert isinstance(application.state.catalog, CachingCatalog)


@pytest.mark.anyio
async def test_a_repeated_http_request_is_answered_from_the_cache() -> None:
    application = create_app(
        Settings(environment="test"),
        catalog=FixtureCatalog(),
        cache_store=InMemoryCacheStore(ManualClock()),
    )

    async with AsyncClient(
        transport=ASGITransport(app=application), base_url="http://testserver"
    ) as client:
        first = await client.get("/api/v1/games", params={"platform": "pc"})
        second = await client.get("/api/v1/games", params={"platform": "pc"})

    assert first.status_code == second.status_code == 200
    assert first.json()["meta"]["servedFrom"] == "provider"
    assert second.json()["meta"]["servedFrom"] == "cache"
    assert second.json()["meta"]["dataAsOf"] == first.json()["meta"]["dataAsOf"]
    assert second.json()["meta"]["requestId"] == second.headers["x-request-id"]
    assert second.json()["items"] == first.json()["items"]


def test_cache_lifetimes_are_read_from_nested_environment_variables(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WTPN_CACHE_TTL__SEARCH_FRESH_SECONDS", "120")

    assert Settings().cache_ttl.search_fresh_seconds == 120


def test_settings_cannot_raise_the_provider_ceiling_above_igdbs() -> None:
    with pytest.raises(ValueError):
        Settings(provider_requests_per_second=5)
    with pytest.raises(ValueError):
        Settings(provider_max_in_flight=9)


@pytest.mark.anyio
async def test_the_production_provider_is_protected_by_a_circuit() -> None:
    application = create_app(
        Settings(
            environment="test",
            redis_url=None,
            twitch_client_id="test-client-id",
            twitch_client_secret=SecretStr("test-client-secret"),
            circuit_failure_threshold=3,
        )
    )

    async with application.router.lifespan_context(application):
        circuit = application.state.provider_circuit

    assert isinstance(circuit, ProviderCircuit)
    assert circuit.state is CircuitState.CLOSED


def test_no_circuit_is_reported_without_a_configured_provider() -> None:
    application = create_app(
        Settings(
            environment="test",
            redis_url=None,
            twitch_client_id=None,
            twitch_client_secret=None,
        )
    )

    assert application.state.provider_circuit is None


def test_an_injected_catalog_has_no_provider_circuit() -> None:
    application = create_app(Settings(environment="test"), catalog=FixtureCatalog())

    assert application.state.provider_circuit is None

"""Tests for production catalog composition."""

import pytest
from cache_fakes import InMemoryCacheStore, ManualClock
from httpx2 import ASGITransport, AsyncClient
from pydantic import RedisDsn, SecretStr

from whattoplaynext_api.adapters.igdb.catalog import IgdbCatalog
from whattoplaynext_api.adapters.redis.store import RedisCacheStore
from whattoplaynext_api.cache.cache import Cache, CacheHealth
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

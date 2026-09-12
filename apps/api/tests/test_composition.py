"""Tests for production catalog composition."""

import pytest
from httpx2 import ASGITransport, AsyncClient
from pydantic import SecretStr

from whattoplaynext_api.adapters.igdb.catalog import IgdbCatalog
from whattoplaynext_api.catalog.unavailable import UnavailableCatalog
from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import build_catalog, create_app


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

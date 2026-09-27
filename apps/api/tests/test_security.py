"""Security boundary of the public HTTP API."""

import pytest
from fixture_catalog import FixtureCatalog
from httpx2 import ASGITransport, AsyncClient
from pydantic import SecretStr, ValidationError

from whattoplaynext_api.catalog.models import FilterMetadata
from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import create_app

STRICT_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "cross-origin-resource-policy": "same-origin",
}


def client_for(environment: str = "test") -> AsyncClient:
    application = create_app(
        Settings(environment=environment),  # type: ignore[arg-type]
        catalog=FixtureCatalog(),
    )
    return AsyncClient(
        transport=ASGITransport(app=application, raise_app_exceptions=False),
        base_url="http://testserver",
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/health",
        "/api/v1/filters",
        "/api/v1/games",
        "/api/v1/games/1942",
        "/api/v1/games/4242",
        "/api/v1/games?page=0",
        "/api/v1/no-such-route",
    ],
)
async def test_every_api_response_carries_the_security_headers(path: str) -> None:
    async with client_for() as client:
        response = await client.get(path)

    for name, value in STRICT_HEADERS.items():
        assert response.headers.get(name) == value, name
    assert "strict-transport-security" not in response.headers


@pytest.mark.anyio
async def test_responses_are_not_cached_unless_a_route_says_so() -> None:
    async with client_for() as client:
        search = await client.get("/api/v1/games")
        popular = await client.get("/api/v1/games/popular")

    assert search.headers["cache-control"] == "no-store"
    assert popular.headers["cache-control"] == "public, max-age=86400, s-maxage=86400"


@pytest.mark.anyio
async def test_production_adds_strict_transport_security() -> None:
    async with client_for("production") as client:
        response = await client.get("/api/v1/health")

    assert (
        response.headers["strict-transport-security"]
        == "max-age=31536000; includeSubDomains"
    )


@pytest.mark.anyio
async def test_a_cross_origin_preflight_is_refused_without_any_cors_allowance() -> None:
    async with client_for() as client:
        response = await client.options(
            "/api/v1/games",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 405
    assert not any(name.startswith("access-control-") for name in response.headers)


@pytest.mark.anyio
async def test_a_cross_origin_read_gets_no_cors_allowance() -> None:
    async with client_for() as client:
        response = await client.get(
            "/api/v1/filters", headers={"Origin": "https://evil.example"}
        )

    assert not any(name.startswith("access-control-") for name in response.headers)


@pytest.mark.anyio
@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
async def test_only_get_is_accepted(method: str) -> None:
    async with client_for() as client:
        response = await client.request(method, "/api/v1/games")

    assert response.status_code == 405
    assert response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "path",
    ["/api/v1/games", "/api/v1/games/autocomplete?q=ho"],
)
async def test_a_repeated_filter_is_bounded(path: str) -> None:
    separator = "&" if "?" in path else "?"
    flood = "&".join(["platform=pc"] * 51)

    async with client_for() as client:
        accepted = await client.get(
            f"{path}{separator}{'&'.join(['platform=pc'] * 50)}"
        )
        rejected = await client.get(f"{path}{separator}{flood}")

    assert accepted.status_code == 200
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.anyio
@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
async def test_production_serves_no_interactive_documentation(path: str) -> None:
    async with client_for("production") as client:
        response = await client.get(path)

    assert response.status_code == 404


@pytest.mark.anyio
async def test_local_development_keeps_the_interactive_documentation() -> None:
    async with client_for("local") as client:
        response = await client.get("/docs")

    assert response.status_code == 200


def test_production_refuses_debug_mode() -> None:
    # Starlette's debug mode answers an unexpected error with its traceback.
    with pytest.raises(ValidationError, match="debug"):
        Settings(environment="production", debug=True)


def test_settings_never_print_their_secrets() -> None:
    settings = Settings(
        environment="test",
        twitch_client_id="client-id",
        twitch_client_secret=SecretStr("twitch-secret-value"),
        edge_token=SecretStr("edge-token-value"),
        identity_hmac_key=SecretStr("hmac-key-value"),
    )

    for rendered in (repr(settings), str(settings), settings.model_dump_json()):
        for secret in ("twitch-secret-value", "edge-token-value", "hmac-key-value"):
            assert secret not in rendered


@pytest.mark.anyio
async def test_an_unexpected_error_response_carries_the_security_headers() -> None:
    class ExplodingCatalog(FixtureCatalog):
        async def get_filter_metadata(self) -> FilterMetadata:
            raise RuntimeError("boom")

    application = create_app(Settings(environment="test"), catalog=ExplodingCatalog())
    async with AsyncClient(
        transport=ASGITransport(app=application, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/api/v1/filters")

    assert response.status_code == 500
    for name, value in STRICT_HEADERS.items():
        assert response.headers.get(name) == value, name
    assert response.headers["cache-control"] == "no-store"

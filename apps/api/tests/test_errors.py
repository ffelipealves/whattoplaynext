"""Behavioral tests for the public HTTP error contract."""

import pytest
from fastapi import FastAPI
from httpx2 import ASGITransport, AsyncClient

from whattoplaynext_api.core.errors import ApplicationError, ErrorCode
from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.http.errors import install_http_boundary
from whattoplaynext_api.main import create_app


@pytest.mark.parametrize(
    ("code", "status_code", "message"),
    [
        (ErrorCode.INVALID_QUERY, 400, "Query combination is invalid."),
        (ErrorCode.RATE_LIMITED, 429, "Too many requests."),
        (
            ErrorCode.UPSTREAM_INVALID_RESPONSE,
            502,
            "Game data provider returned an invalid response.",
        ),
        (
            ErrorCode.UPSTREAM_UNAVAILABLE,
            503,
            "Game data is temporarily unavailable.",
        ),
        (ErrorCode.UPSTREAM_TIMEOUT, 504, "Game data provider timed out."),
    ],
)
@pytest.mark.anyio
async def test_classified_errors_keep_their_public_semantics(
    code: ErrorCode,
    status_code: int,
    message: str,
) -> None:
    application = FastAPI()
    install_http_boundary(application)

    @application.get("/failure")
    async def fail() -> None:
        raise ApplicationError(code)

    transport = ASGITransport(app=application)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get(
            "/failure",
            headers={"X-Request-ID": "web-classified-error"},
        )

    assert response.status_code == status_code
    assert response.json() == {
        "error": {
            "code": code.value,
            "message": message,
            "requestId": "web-classified-error",
        }
    }


@pytest.mark.anyio
async def test_retryable_error_tells_the_client_when_to_try_again() -> None:
    application = FastAPI()
    install_http_boundary(application)

    @application.get("/failure")
    async def fail() -> None:
        raise ApplicationError(ErrorCode.RATE_LIMITED, retry_after_seconds=30)

    transport = ASGITransport(app=application)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get("/failure")

    assert response.status_code == 429
    assert response.headers["retry-after"] == "30"
    assert response.json()["error"]["retryAfterSeconds"] == 30


@pytest.mark.anyio
async def test_unknown_route_uses_the_public_error_envelope() -> None:
    application = create_app(Settings(environment="test"))
    transport = ASGITransport(app=application)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get(
            "/api/v1/does-not-exist",
            headers={"X-Request-ID": "web-unknown-route"},
        )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "NOT_FOUND",
            "message": "Resource not found.",
            "requestId": "web-unknown-route",
        }
    }


@pytest.mark.anyio
async def test_unsupported_method_uses_the_public_error_envelope() -> None:
    application = create_app(Settings(environment="test"))
    transport = ASGITransport(app=application)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/v1/health",
            headers={"X-Request-ID": "web-wrong-method"},
        )

    assert response.status_code == 405
    assert response.json() == {
        "error": {
            "code": "METHOD_NOT_ALLOWED",
            "message": "Method not allowed.",
            "requestId": "web-wrong-method",
        }
    }


def test_error_contract_is_exposed_in_openapi() -> None:
    application = create_app(Settings(environment="test"))

    responses = application.openapi()["paths"]["/api/v1/health"]["get"]["responses"]

    assert responses["200"]["headers"]["X-Request-ID"] == {
        "description": "Identifier used to correlate this response.",
        "schema": {"type": "string"},
    }
    assert responses["405"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorResponse"
    }
    assert responses["500"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorResponse"
    }


@pytest.mark.anyio
async def test_application_error_uses_the_public_envelope() -> None:
    application = FastAPI()
    install_http_boundary(application)

    @application.get("/failure")
    async def fail() -> None:
        raise ApplicationError(ErrorCode.GAME_NOT_FOUND)

    transport = ASGITransport(app=application)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get(
            "/failure",
            headers={"X-Request-ID": "web-game-detail"},
        )

    assert response.status_code == 404
    assert response.headers["x-request-id"] == "web-game-detail"
    assert response.json() == {
        "error": {
            "code": "GAME_NOT_FOUND",
            "message": "Game not found.",
            "requestId": "web-game-detail",
        }
    }


@pytest.mark.anyio
async def test_validation_error_hides_framework_details() -> None:
    application = FastAPI()
    install_http_boundary(application)

    @application.get("/items")
    async def list_items(page: int) -> dict[str, int]:
        return {"page": page}

    transport = ASGITransport(app=application)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get(
            "/items?page=not-an-integer",
            headers={"X-Request-ID": "web-invalid-query"},
        )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "One or more parameter values are invalid.",
            "requestId": "web-invalid-query",
        }
    }


@pytest.mark.anyio
async def test_unexpected_error_returns_a_safe_fallback() -> None:
    application = FastAPI()
    install_http_boundary(application)

    @application.get("/failure")
    async def fail() -> None:
        raise RuntimeError("provider payload with secret details")

    transport = ASGITransport(app=application, raise_app_exceptions=False)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get(
            "/failure",
            headers={"X-Request-ID": "web-unexpected-error"},
        )

    assert response.status_code == 500
    assert response.headers["x-request-id"] == "web-unexpected-error"
    assert response.json() == {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred.",
            "requestId": "web-unexpected-error",
        }
    }
    assert "secret details" not in response.text

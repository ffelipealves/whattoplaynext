"""Tests for the process-health HTTP adapter."""

from uuid import UUID

import pytest
from httpx2 import ASGITransport, AsyncClient

from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import create_app


@pytest.mark.anyio
async def test_health_reports_process_liveness() -> None:
    application = create_app(Settings(environment="test"))
    transport = ASGITransport(app=application)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    UUID(response.headers["x-request-id"])


@pytest.mark.anyio
async def test_health_propagates_a_valid_request_id() -> None:
    application = create_app(Settings(environment="test"))
    transport = ASGITransport(app=application)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get(
            "/api/v1/health",
            headers={"X-Request-ID": "web_01-valid.trace"},
        )

    assert response.headers["x-request-id"] == "web_01-valid.trace"


@pytest.mark.anyio
async def test_health_replaces_an_unsafe_request_id() -> None:
    application = create_app(Settings(environment="test"))
    transport = ASGITransport(app=application)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get(
            "/api/v1/health",
            headers={"X-Request-ID": "unsafe request identifier"},
        )

    assert response.headers["x-request-id"] != "unsafe request identifier"
    UUID(response.headers["x-request-id"])


def test_health_is_exposed_in_the_openapi_contract() -> None:
    application = create_app(Settings(environment="test"))

    schema = application.openapi()

    assert "/api/v1/health" in schema["paths"]
    assert schema["paths"]["/api/v1/health"]["get"]["operationId"] == "getHealth"

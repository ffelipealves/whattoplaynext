"""Tests for the process-health HTTP adapter."""

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


def test_health_is_exposed_in_the_openapi_contract() -> None:
    application = create_app(Settings(environment="test"))

    schema = application.openapi()

    assert "/api/v1/health" in schema["paths"]

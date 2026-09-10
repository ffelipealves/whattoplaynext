"""Tests for deterministic OpenAPI artifact generation."""

import pytest

from whattoplaynext_api.openapi import build_openapi_schema


def test_openapi_export_ignores_local_process_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WTPN_APP_NAME", "Local override")
    monkeypatch.setenv("WTPN_API_PREFIX", "/internal")
    monkeypatch.setenv("WTPN_DEBUG", "true")

    schema = build_openapi_schema()

    assert schema["info"]["title"] == "What To Play Next API"
    assert "/api/v1/health" in schema["paths"]
    assert "/internal/health" not in schema["paths"]

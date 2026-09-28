"""Tests for deterministic OpenAPI artifact generation."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from whattoplaynext_api.openapi import build_openapi_schema


def test_openapi_export_writes_only_parseable_json() -> None:
    result = subprocess.run(
        [sys.executable, "scripts/export_openapi.py"],
        cwd=Path(__file__).parents[1],
        capture_output=True,
        check=True,
        text=True,
    )

    schema = json.loads(result.stdout)

    assert schema["info"]["title"] == "What To Play Next API"


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


def test_filter_metadata_contract_requires_its_complete_public_shape() -> None:
    schema = build_openapi_schema()
    components = schema["components"]["schemas"]

    assert set(components["FilterMetadata"]["required"]) == {
        "platforms",
        "genres",
        "gameModes",
        "durationKinds",
        "sortOptions",
        "limits",
    }
    assert set(components["FilterLimits"]["required"]) == {
        "pageSize",
        "maximumPage",
        "minimumAutocompleteLength",
        "maximumNameLength",
        "minimumDurationHours",
        "maximumDurationHours",
    }

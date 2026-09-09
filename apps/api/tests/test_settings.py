"""Tests for typed process configuration."""

import pytest
from pydantic import ValidationError

from whattoplaynext_api.core.settings import Settings


def test_settings_reads_the_application_environment_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WTPN_ENVIRONMENT", "test")
    monkeypatch.setenv("WTPN_DEBUG", "true")

    settings = Settings()

    assert settings.environment == "test"
    assert settings.debug is True


def test_settings_rejects_an_invalid_api_prefix() -> None:
    with pytest.raises(ValidationError):
        Settings(api_prefix="api/v1")

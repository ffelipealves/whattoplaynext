"""Tests for typed process configuration."""

from pathlib import Path

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


def test_settings_reads_infrastructure_and_provider_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WTPN_REDIS_URL", "redis://cache.internal:6380/2")
    monkeypatch.setenv("WTPN_TWITCH_CLIENT_ID", "client-id")
    monkeypatch.setenv("WTPN_TWITCH_CLIENT_SECRET", "client-secret")

    settings = Settings()

    assert str(settings.redis_url) == "redis://cache.internal:6380/2"
    assert settings.twitch_client_id == "client-id"
    assert settings.twitch_client_secret is not None
    assert settings.twitch_client_secret.get_secret_value() == "client-secret"


@pytest.mark.parametrize(
    ("variable_name", "variable_value"),
    [
        ("WTPN_TWITCH_CLIENT_ID", "client-id"),
        ("WTPN_TWITCH_CLIENT_SECRET", "client-secret"),
    ],
)
def test_settings_requires_twitch_credentials_as_a_pair(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    variable_name: str,
    variable_value: str,
) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv(variable_name, variable_value)

    with pytest.raises(ValidationError, match="configured together"):
        Settings()


def test_settings_treats_blank_twitch_credentials_as_unconfigured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WTPN_TWITCH_CLIENT_ID", "")
    monkeypatch.setenv("WTPN_TWITCH_CLIENT_SECRET", "")

    settings = Settings()

    assert settings.twitch_client_id is None
    assert settings.twitch_client_secret is None


def test_settings_loads_the_local_dotenv_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    (tmp_path / ".env").write_text(
        "WTPN_ENVIRONMENT=test\nWTPN_REDIS_URL=redis://dotenv-cache:6379/3\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)

    settings = Settings()

    assert settings.environment == "test"
    assert str(settings.redis_url) == "redis://dotenv-cache:6379/3"

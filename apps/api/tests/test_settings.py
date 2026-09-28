"""Tests for typed process configuration."""

from pathlib import Path

import pytest
from pydantic import SecretStr, ValidationError

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


def test_settings_treats_a_blank_redis_url_as_a_disabled_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WTPN_REDIS_URL", "")

    settings = Settings()

    assert settings.redis_url is None


def test_settings_bound_the_cache_connection_by_default(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.chdir(tmp_path)

    settings = Settings()

    assert settings.cache_operation_timeout_seconds == 0.2
    assert settings.cache_max_connections == 10
    assert settings.cache_bypass_seconds == 30


@pytest.mark.parametrize(
    ("edge_token", "identity_hmac_key", "trusted_proxy_hops", "missing"),
    [
        (None, SecretStr("hmac-key"), 0, "WTPN_EDGE_TOKEN"),
        (SecretStr("edge-token"), None, 0, "WTPN_IDENTITY_HMAC_KEY"),
        (
            SecretStr("edge-token"),
            SecretStr("hmac-key"),
            None,
            "WTPN_TRUSTED_PROXY_HOPS",
        ),
    ],
)
def test_production_requires_complete_rate_limit_identity_configuration(
    edge_token: SecretStr | None,
    identity_hmac_key: SecretStr | None,
    trusted_proxy_hops: int | None,
    missing: str,
) -> None:
    with pytest.raises(ValidationError, match=missing):
        Settings(
            environment="production",
            edge_token=edge_token,
            identity_hmac_key=identity_hmac_key,
            trusted_proxy_hops=trusted_proxy_hops,
        )


def test_production_accepts_an_explicit_direct_connection_identity_configuration() -> (
    None
):
    settings = Settings(
        environment="production",
        edge_token=SecretStr("edge-token"),
        identity_hmac_key=SecretStr("hmac-key"),
        trusted_proxy_hops=0,
    )

    assert settings.trusted_proxy_hops == 0


def test_local_configuration_warns_when_rate_limit_identity_is_incomplete(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level("WARNING"):
        Settings(
            environment="local",
            edge_token=None,
            identity_hmac_key=None,
            trusted_proxy_hops=None,
        )

    assert "rate_limit_identity_configuration_incomplete" in caplog.messages


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("cache_operation_timeout_seconds", 0),
        ("cache_operation_timeout_seconds", 10),
        ("cache_max_connections", 0),
        ("cache_bypass_seconds", -1),
    ],
)
def test_settings_reject_unbounded_cache_values(field: str, value: float) -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate({field: value})

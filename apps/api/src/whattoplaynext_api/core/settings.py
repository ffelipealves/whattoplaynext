"""Typed application settings loaded from the environment."""

import logging
from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, RedisDsn, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from whattoplaynext_api.cache.catalog import CachePolicy

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Configuration shared by the application composition root."""

    model_config = SettingsConfigDict(
        case_sensitive=False,
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        env_prefix="WTPN_",
        extra="ignore",
    )

    app_name: str = "What To Play Next API"
    api_prefix: str = Field(default="/api/v1", pattern=r"^/[a-z0-9/-]+$")
    debug: bool = False
    environment: Literal["local", "test", "production"] = "local"
    redis_url: RedisDsn | None = RedisDsn("redis://localhost:6379/0")
    cache_operation_timeout_seconds: float = Field(default=0.2, gt=0, le=5)
    cache_max_connections: int = Field(default=10, ge=1, le=100)
    cache_bypass_seconds: float = Field(default=30, ge=0, le=3600)
    cache_ttl: CachePolicy = Field(default_factory=CachePolicy)
    rate_limit_public_per_minute: int = Field(default=60, ge=1, le=10_000)
    rate_limit_provider_per_minute: int = Field(default=20, ge=1, le=10_000)
    edge_token: SecretStr | None = None
    identity_hmac_key: SecretStr | None = None
    # None means the deployment has not stated whether the API is proxied;
    # production must choose an explicit count, including zero.
    trusted_proxy_hops: int | None = Field(default=None, ge=0, le=5)
    # IGDB's own ceiling; lower it if the provider starts answering 429.
    provider_requests_per_second: float = Field(default=4, gt=0, le=4)
    provider_max_in_flight: int = Field(default=8, ge=1, le=8)
    circuit_failure_threshold: int = Field(default=5, ge=1, le=100)
    circuit_open_seconds: float = Field(default=30, gt=0, le=3600)
    circuit_max_open_seconds: float = Field(default=300, gt=0, le=86_400)
    twitch_client_id: str | None = None
    twitch_client_secret: SecretStr | None = None

    @field_validator(
        "redis_url",
        "edge_token",
        "identity_hmac_key",
        "twitch_client_id",
        "twitch_client_secret",
        mode="before",
    )
    @classmethod
    def normalize_blank_values(cls, value: object) -> object:
        """Let example files leave optional infrastructure and credentials blank."""
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def refuse_debug_in_production(self) -> Self:
        """Starlette's debug mode answers an unexpected error with a traceback."""
        if self.debug and self.environment == "production":
            msg = "debug mode must stay off in production"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def require_complete_twitch_credentials(self) -> Self:
        """Reject partial provider credentials before the application starts."""
        if bool(self.twitch_client_id) != bool(self.twitch_client_secret):
            msg = "Twitch client ID and secret must be configured together"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def require_rate_limit_identity_configuration(self) -> Self:
        """Make a deployment choose how visitor requests are identified."""
        missing = [
            name
            for name, configured in (
                ("WTPN_EDGE_TOKEN", self.edge_token is not None),
                ("WTPN_IDENTITY_HMAC_KEY", self.identity_hmac_key is not None),
                ("WTPN_TRUSTED_PROXY_HOPS", self.trusted_proxy_hops is not None),
            )
            if not configured
        ]
        if not missing:
            return self

        if self.environment == "production":
            msg = "production requires " + ", ".join(missing)
            raise ValueError(msg)

        if self.environment == "local":
            logger.warning(
                "rate_limit_identity_configuration_incomplete",
                extra={"reason": ",".join(missing)},
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Load and cache process-level settings."""
    return Settings()

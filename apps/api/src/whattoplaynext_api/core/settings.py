"""Typed application settings loaded from the environment."""

from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, RedisDsn, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from whattoplaynext_api.cache.catalog import CachePolicy


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
    twitch_client_id: str | None = None
    twitch_client_secret: SecretStr | None = None

    @field_validator(
        "redis_url",
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
    def require_complete_twitch_credentials(self) -> Self:
        """Reject partial provider credentials before the application starts."""
        if bool(self.twitch_client_id) != bool(self.twitch_client_secret):
            msg = "Twitch client ID and secret must be configured together"
            raise ValueError(msg)
        return self


@lru_cache
def get_settings() -> Settings:
    """Load and cache process-level settings."""
    return Settings()

"""Typed application settings loaded from the environment."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration shared by the application composition root."""

    model_config = SettingsConfigDict(
        case_sensitive=False,
        env_prefix="WTPN_",
        extra="ignore",
    )

    app_name: str = "What To Play Next API"
    api_prefix: str = Field(default="/api/v1", pattern=r"^/[a-z0-9/-]+$")
    debug: bool = False
    environment: Literal["local", "test", "production"] = "local"


@lru_cache
def get_settings() -> Settings:
    """Load and cache process-level settings."""
    return Settings()

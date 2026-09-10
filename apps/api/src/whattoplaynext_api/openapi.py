"""Deterministic construction of the public OpenAPI contract."""

from typing import Any

from pydantic import RedisDsn

from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import create_app


def build_openapi_schema() -> dict[str, Any]:
    """Build the public schema independently of local configuration and services."""
    settings = Settings(
        app_name="What To Play Next API",
        api_prefix="/api/v1",
        debug=False,
        environment="test",
        redis_url=RedisDsn("redis://localhost:6379/0"),
        twitch_client_id=None,
        twitch_client_secret=None,
    )
    return create_app(settings).openapi()

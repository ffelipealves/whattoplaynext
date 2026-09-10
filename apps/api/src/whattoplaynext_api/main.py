"""FastAPI application composition root."""

from fastapi import FastAPI

from whattoplaynext_api import __version__
from whattoplaynext_api.core.settings import Settings, get_settings
from whattoplaynext_api.http.errors import install_http_boundary
from whattoplaynext_api.http.router import api_router


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the HTTP adapter with explicit, testable configuration."""
    resolved_settings = settings or get_settings()
    application = FastAPI(
        debug=resolved_settings.debug,
        description="Provider-neutral game discovery API.",
        title=resolved_settings.app_name,
        version=__version__,
    )
    install_http_boundary(application)
    application.include_router(api_router, prefix=resolved_settings.api_prefix)
    return application


app = create_app()

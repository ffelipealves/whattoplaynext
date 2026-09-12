"""FastAPI application composition root."""

from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

import httpx
from fastapi import FastAPI

from whattoplaynext_api import __version__
from whattoplaynext_api.adapters.igdb.catalog import IgdbCatalog
from whattoplaynext_api.adapters.igdb.token import (
    HttpxTwitchTokenEndpoint,
    TwitchTokenManager,
)
from whattoplaynext_api.adapters.igdb.transport import IgdbTransport
from whattoplaynext_api.catalog.ports import Catalog
from whattoplaynext_api.catalog.unavailable import UnavailableCatalog
from whattoplaynext_api.core.settings import Settings, get_settings
from whattoplaynext_api.http.errors import install_http_boundary
from whattoplaynext_api.http.router import api_router


def build_catalog(settings: Settings) -> tuple[Catalog, httpx.AsyncClient | None]:
    """Compose the production IGDB catalog, or report it unavailable.

    Returns the shared HTTP client alongside the catalog so its lifecycle can
    be tied to the application (or a standalone script's) shutdown; the
    client is ``None`` whenever no client was created.
    """
    if settings.twitch_client_id is None or settings.twitch_client_secret is None:
        return UnavailableCatalog(), None
    client = httpx.AsyncClient()
    token_manager = TwitchTokenManager(
        client_id=settings.twitch_client_id,
        client_secret=settings.twitch_client_secret.get_secret_value(),
        endpoint=HttpxTwitchTokenEndpoint(client),
    )
    transport = IgdbTransport(
        client=client,
        client_id=settings.twitch_client_id,
        token_provider=token_manager,
    )
    return IgdbCatalog(transport), client


def _lifespan(
    client: httpx.AsyncClient | None,
) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            if client is not None:
                await client.aclose()

    return lifespan


def create_app(
    settings: Settings | None = None,
    *,
    catalog: Catalog | None = None,
) -> FastAPI:
    """Build the HTTP adapter with explicit, testable configuration."""
    resolved_settings = settings or get_settings()
    client: httpx.AsyncClient | None = None
    resolved_catalog = catalog
    if resolved_catalog is None:
        resolved_catalog, client = build_catalog(resolved_settings)
    application = FastAPI(
        debug=resolved_settings.debug,
        description="Provider-neutral game discovery API.",
        title=resolved_settings.app_name,
        version=__version__,
        lifespan=_lifespan(client),
    )
    install_http_boundary(application)
    application.state.catalog = resolved_catalog
    application.include_router(api_router, prefix=resolved_settings.api_prefix)
    return application


app = create_app()

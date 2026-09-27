"""FastAPI application composition root."""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import timedelta

import httpx
from fastapi import FastAPI

from whattoplaynext_api import __version__
from whattoplaynext_api.adapters.igdb.catalog import IgdbCatalog
from whattoplaynext_api.adapters.igdb.token import (
    HttpxTwitchTokenEndpoint,
    TwitchTokenManager,
)
from whattoplaynext_api.adapters.igdb.transport import IgdbTransport
from whattoplaynext_api.adapters.redis.store import RedisCacheStore
from whattoplaynext_api.cache.cache import Cache
from whattoplaynext_api.cache.store import CacheStore
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


def build_cache(settings: Settings) -> tuple[Cache, RedisCacheStore | None]:
    """Compose the Redis-backed cache, or a disabled one without a Redis URL.

    Redis connects lazily, so an unreachable server never blocks startup; the
    cache reports it through ``health()`` and bypasses it while it is down.
    The store is returned so its pool can be closed with the application.
    """
    if settings.redis_url is None:
        return _cache(settings, None), None
    store = RedisCacheStore.from_url(
        str(settings.redis_url),
        operation_timeout_seconds=settings.cache_operation_timeout_seconds,
        max_connections=settings.cache_max_connections,
    )
    return _cache(settings, store), store


def _cache(settings: Settings, store: CacheStore | None) -> Cache:
    return Cache(store, bypass_for=timedelta(seconds=settings.cache_bypass_seconds))


def _lifespan(
    closers: list[Callable[[], Awaitable[None]]],
) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            for close in closers:
                await close()

    return lifespan


def create_app(
    settings: Settings | None = None,
    *,
    catalog: Catalog | None = None,
    cache_store: CacheStore | None = None,
) -> FastAPI:
    """Build the HTTP adapter with explicit, testable configuration.

    Without injected dependencies, the catalog and cache come from settings.
    An injected catalog gets only an injected cache store (or none), so tests
    and the browser fixture server never reach a developer's configured Redis.
    """
    resolved_settings = settings or get_settings()
    closers: list[Callable[[], Awaitable[None]]] = []
    resolved_catalog = catalog
    if resolved_catalog is None:
        resolved_catalog, client = build_catalog(resolved_settings)
        if client is not None:
            closers.append(client.aclose)
    if cache_store is not None or catalog is not None:
        cache = _cache(resolved_settings, cache_store)
    else:
        cache, redis_store = build_cache(resolved_settings)
        if redis_store is not None:
            closers.append(redis_store.aclose)
    application = FastAPI(
        debug=resolved_settings.debug,
        description="Provider-neutral game discovery API.",
        title=resolved_settings.app_name,
        version=__version__,
        lifespan=_lifespan(closers),
    )
    install_http_boundary(application)
    application.state.catalog = resolved_catalog
    application.state.cache = cache
    application.include_router(api_router, prefix=resolved_settings.api_prefix)
    return application


app = create_app()

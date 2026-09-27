"""The response cache wrapped around the catalog port."""

import asyncio
from collections.abc import Awaitable, Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from whattoplaynext_api.cache.cache import Cache
from whattoplaynext_api.cache.keys import cache_key
from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    AutocompleteResult,
    BrowseCriteria,
    FilterMetadata,
    GameDetail,
    GamePage,
    PopularGameSelection,
    ResponseMeta,
    ServedFrom,
)
from whattoplaynext_api.catalog.ports import Catalog
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode

# Bump a resource's version whenever its response shape or eligibility changes;
# entries written under the old version are then never read again.
SCHEMA_VERSIONS = {
    "filters": 1,
    "search": 1,
    "autocomplete": 1,
    "popular": 1,
    "detail": 1,
    "game-not-found": 1,
}


class CachePolicy(BaseModel):
    """Fresh lifetimes and stale-if-error windows, in seconds."""

    filters_fresh_seconds: int = Field(default=7 * 86_400, gt=0)
    filters_stale_seconds: int = Field(default=30 * 86_400, ge=0)
    detail_fresh_seconds: int = Field(default=86_400, gt=0)
    detail_stale_seconds: int = Field(default=7 * 86_400, ge=0)
    search_fresh_seconds: int = Field(default=3_600, gt=0)
    search_stale_seconds: int = Field(default=86_400, ge=0)
    autocomplete_fresh_seconds: int = Field(default=3_600, gt=0)
    popular_fresh_seconds: int = Field(default=86_400, gt=0)
    popular_stale_seconds: int = Field(default=7 * 86_400, ge=0)
    not_found_fresh_seconds: int = Field(default=600, gt=0)


class CacheOutcome(StrEnum):
    """How one catalog call was answered, for request telemetry."""

    HIT = "hit"
    MISS = "miss"
    COALESCED = "coalesced"


_outcomes: ContextVar[list[CacheOutcome] | None] = ContextVar(
    "cache_outcomes", default=None
)


@contextmanager
def record_cache_outcomes() -> Iterator[list[CacheOutcome]]:
    """Collect the cache outcomes of every catalog call made in this context."""
    outcomes: list[CacheOutcome] = []
    token = _outcomes.set(outcomes)
    try:
        yield outcomes
    finally:
        _outcomes.reset(token)


def _record(outcome: CacheOutcome) -> None:
    outcomes = _outcomes.get()
    if outcomes is not None:
        outcomes.append(outcome)


class _GameNotFound(BaseModel):
    """Negative-cache marker for a game detail answered with not found."""

    game_id: int


def _utc_now() -> datetime:
    return datetime.now(UTC)


class CachingCatalog:
    """Serve fresh cached responses and share identical in-flight misses.

    Provider failures are never cached and are shared by the callers of the
    miss that produced them. Stale-if-error fallback is Milestone 4.4.
    """

    def __init__(
        self,
        provider: Catalog,
        cache: Cache,
        *,
        environment: str,
        api_version: str,
        policy: CachePolicy | None = None,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._provider = provider
        self._cache = cache
        self._environment = environment
        self._api_version = api_version
        self._policy = policy or CachePolicy()
        self._clock = clock
        self._in_flight: dict[str, asyncio.Future[Any]] = {}

    async def get_filter_metadata(self) -> FilterMetadata:
        policy = self._policy
        return await self._cached(
            self._key("filters", None),
            FilterMetadata,
            self._provider.get_filter_metadata,
            fresh=policy.filters_fresh_seconds,
            stale=policy.filters_stale_seconds,
        )

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        policy = self._policy
        return await self._cached(
            self._key("search", criteria),
            GamePage,
            lambda: self._provider.browse_games(criteria),
            fresh=policy.search_fresh_seconds,
            stale=policy.search_stale_seconds,
        )

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        return await self._cached(
            self._key("autocomplete", criteria),
            AutocompleteResult,
            lambda: self._provider.autocomplete(criteria),
            fresh=self._policy.autocomplete_fresh_seconds,
            stale=0,
        )

    async def get_popular_games(self) -> PopularGameSelection:
        policy = self._policy
        return await self._cached(
            self._key("popular", None),
            PopularGameSelection,
            self._provider.get_popular_games,
            fresh=policy.popular_fresh_seconds,
            stale=policy.popular_stale_seconds,
        )

    async def get_game_detail(self, game_id: int) -> GameDetail:
        not_found_key = self._key("game-not-found", {"gameId": game_id})
        absent = await self._cache.read(not_found_key, _GameNotFound)
        if absent is not None and absent.is_fresh(self._clock()):
            _record(CacheOutcome.HIT)
            raise ApplicationError(ErrorCode.GAME_NOT_FOUND)

        async def fetch() -> GameDetail:
            try:
                return await self._provider.get_game_detail(game_id)
            except ApplicationError as error:
                if error.code is ErrorCode.GAME_NOT_FOUND:
                    await self._cache.write(
                        not_found_key,
                        _GameNotFound(game_id=game_id),
                        fresh_for=timedelta(
                            seconds=self._policy.not_found_fresh_seconds
                        ),
                    )
                raise

        policy = self._policy
        return await self._cached(
            self._key("detail", {"gameId": game_id}),
            GameDetail,
            fetch,
            fresh=policy.detail_fresh_seconds,
            stale=policy.detail_stale_seconds,
        )

    def _key(self, resource: str, criteria: object) -> str:
        return cache_key(
            environment=self._environment,
            api_version=self._api_version,
            resource=resource,
            schema_version=SCHEMA_VERSIONS[resource],
            criteria=criteria,
        )

    async def _cached[T: BaseModel](
        self,
        key: str,
        model: type[T],
        fetch: Callable[[], Awaitable[T]],
        *,
        fresh: int,
        stale: int,
    ) -> T:
        cached = await self._cache.read(key, model)
        if cached is not None and cached.is_fresh(self._clock()):
            _record(CacheOutcome.HIT)
            return _with_origin(cached.value, ServedFrom.CACHE)

        shared = self._in_flight.get(key)
        if shared is not None:
            _record(CacheOutcome.COALESCED)
        else:
            _record(CacheOutcome.MISS)
            shared = asyncio.ensure_future(
                self._fill(key, fetch, fresh=fresh, stale=stale)
            )
            self._in_flight[key] = shared
            shared.add_done_callback(lambda done: self._settle(key, done))
        # Shielded: a caller that disconnects must not cancel the provider call
        # the other callers are waiting for.
        value: T = await asyncio.shield(shared)
        return value

    async def _fill[T: BaseModel](
        self,
        key: str,
        fetch: Callable[[], Awaitable[T]],
        *,
        fresh: int,
        stale: int,
    ) -> T:
        fetched_at = self._clock()
        value = _with_origin(await fetch(), ServedFrom.PROVIDER, data_as_of=fetched_at)
        await self._cache.write(
            key,
            value,
            fresh_for=timedelta(seconds=fresh),
            stale_for=timedelta(seconds=stale),
        )
        return value

    def _settle(self, key: str, done: asyncio.Future[Any]) -> None:
        if self._in_flight.get(key) is done:
            del self._in_flight[key]
        if not done.cancelled():
            # Mark a failure retrieved even if every caller went away.
            done.exception()


def _with_origin[T: BaseModel](
    value: T,
    origin: ServedFrom,
    *,
    data_as_of: datetime | None = None,
) -> T:
    """Mark where a response came from; a cached one keeps its stored time."""
    meta = getattr(value, "meta", None)
    if not isinstance(meta, ResponseMeta):
        return value
    update: dict[str, object] = {"served_from": origin}
    if data_as_of is not None:
        update["data_as_of"] = data_as_of
    return value.model_copy(update={"meta": meta.model_copy(update=update)})

"""Tests for the cache wrapped around the catalog port."""

import asyncio
import logging
from collections import Counter
from collections.abc import Awaitable, Callable
from datetime import timedelta

import pytest
from cache_fakes import FailingCacheStore, InMemoryCacheStore, ManualClock
from fixture_catalog import (
    RATE_LIMIT_FAILURE_GAME_ID,
    UPSTREAM_FAILURE_NAME,
    FixtureCatalog,
)

from whattoplaynext_api.cache.cache import Cache
from whattoplaynext_api.cache.catalog import (
    CacheOutcome,
    CachePolicy,
    CachingCatalog,
    record_cache_outcomes,
)
from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    AutocompleteResult,
    BrowseCriteria,
    FilterMetadata,
    GameDetail,
    GamePage,
    PlatformId,
    PopularGameSelection,
    ServedFrom,
    SortDirection,
    SortOption,
)
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode

DETAIL_ID = 1942
MISSING_ID = 4242


class CountingCatalog(FixtureCatalog):
    """The fixture catalog, counting provider calls and optionally held open."""

    def __init__(self) -> None:
        self.calls: Counter[str] = Counter()
        self.release = asyncio.Event()
        self.release.set()
        self.failure: ApplicationError | None = None

    async def _answer(self, capability: str) -> None:
        self.calls[capability] += 1
        await self.release.wait()
        if self.failure is not None:
            raise self.failure

    async def get_filter_metadata(self) -> FilterMetadata:
        await self._answer("filters")
        return await super().get_filter_metadata()

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        await self._answer("search")
        return await super().browse_games(criteria)

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        await self._answer("autocomplete")
        return await super().autocomplete(criteria)

    async def get_popular_games(self) -> PopularGameSelection:
        await self._answer("popular")
        return await super().get_popular_games()

    async def get_game_detail(self, game_id: int) -> GameDetail:
        await self._answer("detail")
        return await super().get_game_detail(game_id)


def criteria(**overrides: object) -> BrowseCriteria:
    values: dict[str, object] = {
        "sort": SortOption.POPULARITY,
        "direction": SortDirection.DESCENDING,
    }
    values.update(overrides)
    return BrowseCriteria.model_validate(values)


def build(
    store: InMemoryCacheStore | FailingCacheStore | None = None,
    *,
    clock: ManualClock | None = None,
) -> tuple[CachingCatalog, CountingCatalog, ManualClock, InMemoryCacheStore | None]:
    resolved_clock = clock or ManualClock()
    resolved_store = store if store is not None else InMemoryCacheStore(resolved_clock)
    provider = CountingCatalog()
    catalog = CachingCatalog(
        provider,
        Cache(resolved_store, clock=resolved_clock),
        environment="test",
        api_version="v1",
        clock=resolved_clock,
    )
    memory = resolved_store if isinstance(resolved_store, InMemoryCacheStore) else None
    return catalog, provider, resolved_clock, memory


@pytest.mark.anyio
async def test_a_repeated_search_is_served_from_cache_without_the_provider() -> None:
    catalog, provider, clock, _ = build()
    fetched_at = clock.now

    first = await catalog.browse_games(criteria())
    clock.advance(minutes=5)
    second = await catalog.browse_games(criteria())

    assert provider.calls["search"] == 1
    assert first.meta.served_from is ServedFrom.PROVIDER
    assert second.meta.served_from is ServedFrom.CACHE
    assert first.meta.data_as_of == second.meta.data_as_of == fetched_at
    assert second.meta.data_may_be_stale is False
    assert second.items == first.items
    assert second.pagination == first.pagination


@pytest.mark.anyio
async def test_every_capability_is_cached() -> None:
    catalog, provider, _, _ = build()
    suggestion = AutocompleteCriteria(query="hollow")

    for _ in range(2):
        await catalog.get_filter_metadata()
        await catalog.browse_games(criteria())
        await catalog.autocomplete(suggestion)
        await catalog.get_popular_games()
        await catalog.get_game_detail(DETAIL_ID)

    assert provider.calls == Counter(
        filters=1, search=1, autocomplete=1, popular=1, detail=1
    )


@pytest.mark.anyio
async def test_cached_values_round_trip_unchanged_apart_from_their_origin() -> None:
    catalog, _, _, _ = build()

    fresh = await catalog.get_game_detail(DETAIL_ID)
    cached = await catalog.get_game_detail(DETAIL_ID)

    assert cached.model_dump(exclude={"meta"}) == fresh.model_dump(exclude={"meta"})
    assert cached.meta.excluded_unknown_duration == fresh.meta.excluded_unknown_duration


@pytest.mark.anyio
async def test_equivalent_criteria_share_an_entry_and_different_ones_do_not() -> None:
    catalog, provider, _, _ = build()

    await catalog.browse_games(
        criteria(platform_ids=[PlatformId.PC, PlatformId.PLAYSTATION_5])
    )
    await catalog.browse_games(
        criteria(platform_ids=[PlatformId.PLAYSTATION_5, PlatformId.PC])
    )
    await catalog.browse_games(criteria(platform_ids=[PlatformId.PC]))
    await catalog.browse_games(criteria(platform_ids=[PlatformId.PC], page=2))

    assert provider.calls["search"] == 3


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("capability", "fresh", "stored"),
    [
        ("filters", timedelta(days=7), timedelta(days=37)),
        ("search", timedelta(hours=1), timedelta(hours=25)),
        ("autocomplete", timedelta(hours=1), timedelta(hours=1)),
        ("popular", timedelta(hours=24), timedelta(days=8)),
        ("detail", timedelta(hours=24), timedelta(days=8)),
    ],
)
async def test_each_resource_uses_its_fresh_ttl_and_keeps_its_stale_window(
    capability: str, fresh: timedelta, stored: timedelta
) -> None:
    catalog, provider, clock, store = build()
    assert store is not None
    calls: dict[str, Callable[[], Awaitable[object]]] = {
        "filters": catalog.get_filter_metadata,
        "search": lambda: catalog.browse_games(criteria()),
        "autocomplete": lambda: catalog.autocomplete(
            AutocompleteCriteria(query="hollow")
        ),
        "popular": catalog.get_popular_games,
        "detail": lambda: catalog.get_game_detail(DETAIL_ID),
    }

    await calls[capability]()
    (key,) = store.stored_keys()
    assert store.ttl_seconds(key) == stored.total_seconds()

    clock.advance(seconds=fresh.total_seconds() - 1)
    await calls[capability]()
    assert provider.calls[capability] == 1

    clock.advance(seconds=1)
    await calls[capability]()
    assert provider.calls[capability] == 2


@pytest.mark.anyio
async def test_an_absent_game_is_remembered_briefly() -> None:
    catalog, provider, clock, _ = build()

    for _ in range(2):
        with pytest.raises(ApplicationError) as raised:
            await catalog.get_game_detail(MISSING_ID)
        assert raised.value.code is ErrorCode.GAME_NOT_FOUND
    assert provider.calls["detail"] == 1

    clock.advance(minutes=10)
    with pytest.raises(ApplicationError):
        await catalog.get_game_detail(MISSING_ID)
    assert provider.calls["detail"] == 2


@pytest.mark.anyio
async def test_provider_failures_are_never_cached() -> None:
    catalog, provider, _, store = build()
    assert store is not None

    for _ in range(2):
        with pytest.raises(ApplicationError) as raised:
            await catalog.browse_games(criteria(name=UPSTREAM_FAILURE_NAME))
        assert raised.value.code is ErrorCode.UPSTREAM_UNAVAILABLE
        with pytest.raises(ApplicationError) as raised:
            await catalog.get_game_detail(RATE_LIMIT_FAILURE_GAME_ID)
        assert raised.value.code is ErrorCode.RATE_LIMITED
        assert raised.value.retry_after_seconds == 30

    assert provider.calls == Counter(search=2, detail=2)
    assert store.stored_keys() == frozenset()


@pytest.mark.anyio
async def test_an_empty_result_is_a_successful_cached_response() -> None:
    catalog, provider, _, _ = build()

    first = await catalog.browse_games(criteria(name="no such game anywhere"))
    await catalog.browse_games(criteria(name="no such game anywhere"))

    assert first.items == []
    assert first.pagination.total_items == 0
    assert provider.calls["search"] == 1


@pytest.mark.anyio
async def test_concurrent_identical_misses_share_one_provider_call() -> None:
    catalog, provider, _, _ = build()
    provider.release.clear()

    pending = [
        asyncio.ensure_future(catalog.browse_games(criteria())) for _ in range(20)
    ]
    await asyncio.sleep(0)
    provider.release.set()
    pages = await asyncio.gather(*pending)

    assert provider.calls["search"] == 1
    assert all(page.items == pages[0].items for page in pages)
    assert sum(page.meta.served_from is ServedFrom.PROVIDER for page in pages) == 20


@pytest.mark.anyio
async def test_concurrent_misses_share_a_failure_and_do_not_retry_it() -> None:
    catalog, provider, _, _ = build()
    provider.release.clear()

    pending = [
        asyncio.ensure_future(
            catalog.browse_games(criteria(name=UPSTREAM_FAILURE_NAME))
        )
        for _ in range(5)
    ]
    await asyncio.sleep(0)
    provider.release.set()
    results = await asyncio.gather(*pending, return_exceptions=True)

    assert provider.calls["search"] == 1
    assert all(isinstance(result, ApplicationError) for result in results)


@pytest.mark.anyio
async def test_different_concurrent_misses_are_not_coalesced() -> None:
    catalog, provider, _, _ = build()
    provider.release.clear()

    pending = [
        asyncio.ensure_future(catalog.browse_games(criteria(page=page)))
        for page in (1, 2)
    ]
    await asyncio.sleep(0)
    provider.release.set()
    await asyncio.gather(*pending)

    assert provider.calls["search"] == 2


@pytest.mark.anyio
async def test_a_cancelled_caller_does_not_cancel_the_shared_provider_call() -> None:
    catalog, provider, _, _ = build()
    provider.release.clear()

    leader = asyncio.ensure_future(catalog.browse_games(criteria()))
    follower = asyncio.ensure_future(catalog.browse_games(criteria()))
    await asyncio.sleep(0)
    leader.cancel()
    provider.release.set()
    page = await follower

    assert provider.calls["search"] == 1
    assert page.meta.served_from is ServedFrom.PROVIDER
    assert (await catalog.browse_games(criteria())).meta.served_from is (
        ServedFrom.CACHE
    )


@pytest.mark.anyio
async def test_records_hit_miss_and_coalesced_outcomes_for_the_request() -> None:
    catalog, provider, _, _ = build()
    provider.release.clear()

    async def browse() -> list[CacheOutcome]:
        with record_cache_outcomes() as outcomes:
            await catalog.browse_games(criteria())
        return outcomes

    leader = asyncio.ensure_future(browse())
    follower = asyncio.ensure_future(browse())
    await asyncio.sleep(0)
    provider.release.set()

    assert await leader == [CacheOutcome.MISS]
    assert await follower == [CacheOutcome.COALESCED]
    assert await browse() == [CacheOutcome.HIT]


@pytest.mark.anyio
async def test_outcomes_are_ignored_when_nobody_records_them() -> None:
    catalog, _, _, _ = build()

    await catalog.browse_games(criteria())


@pytest.mark.anyio
async def test_an_unavailable_cache_still_serves_every_request_from_the_provider() -> (
    None
):
    catalog, provider, _, _ = build(FailingCacheStore())

    first = await catalog.browse_games(criteria())
    second = await catalog.browse_games(criteria())

    assert provider.calls["search"] == 2
    assert first.meta.served_from is second.meta.served_from is ServedFrom.PROVIDER


@pytest.mark.anyio
async def test_the_policy_is_configurable() -> None:
    clock = ManualClock()
    store = InMemoryCacheStore(clock)
    provider = CountingCatalog()
    catalog = CachingCatalog(
        provider,
        Cache(store, clock=clock),
        environment="test",
        api_version="v1",
        clock=clock,
        policy=CachePolicy(search_fresh_seconds=60, search_stale_seconds=0),
    )

    await catalog.browse_games(criteria())
    clock.advance(seconds=60)
    await catalog.browse_games(criteria())

    (key,) = store.stored_keys()
    assert store.ttl_seconds(key) == 60
    assert provider.calls["search"] == 2


def test_the_policy_rejects_a_non_positive_fresh_ttl() -> None:
    with pytest.raises(ValueError):
        CachePolicy(detail_fresh_seconds=0)


STALE_ELIGIBLE_FAILURES = [
    ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE),
    ApplicationError(ErrorCode.UPSTREAM_TIMEOUT),
    ApplicationError(ErrorCode.UPSTREAM_INVALID_RESPONSE),
    ApplicationError(ErrorCode.RATE_LIMITED, retry_after_seconds=30),
]


@pytest.mark.anyio
@pytest.mark.parametrize("failure", STALE_ELIGIBLE_FAILURES)
async def test_a_provider_failure_serves_the_expired_entry_marked_stale(
    failure: ApplicationError,
) -> None:
    catalog, provider, clock, _ = build()
    fresh = await catalog.browse_games(criteria())
    clock.advance(hours=2)
    provider.failure = failure

    stale = await catalog.browse_games(criteria())

    assert provider.calls["search"] == 2
    assert stale.items == fresh.items
    assert stale.meta.served_from is ServedFrom.CACHE
    assert stale.meta.data_may_be_stale is True
    assert stale.meta.data_as_of == fresh.meta.data_as_of


@pytest.mark.anyio
async def test_a_stale_game_detail_is_served_the_same_way() -> None:
    catalog, provider, clock, _ = build()
    await catalog.get_game_detail(DETAIL_ID)
    clock.advance(days=3)
    provider.failure = ApplicationError(ErrorCode.UPSTREAM_TIMEOUT)

    stale = await catalog.get_game_detail(DETAIL_ID)

    assert stale.meta.data_may_be_stale is True


@pytest.mark.anyio
async def test_the_provider_is_asked_again_after_serving_stale_data() -> None:
    catalog, provider, clock, _ = build()
    await catalog.browse_games(criteria())
    clock.advance(hours=2)
    provider.failure = ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)
    await catalog.browse_games(criteria())

    provider.failure = None
    recovered = await catalog.browse_games(criteria())

    assert provider.calls["search"] == 3
    assert recovered.meta.served_from is ServedFrom.PROVIDER
    assert recovered.meta.data_may_be_stale is False
    assert recovered.meta.data_as_of == clock.now


@pytest.mark.anyio
async def test_an_entry_past_its_stale_window_yields_the_classified_error() -> None:
    catalog, provider, clock, _ = build()
    await catalog.browse_games(criteria())
    clock.advance(hours=25)
    provider.failure = ApplicationError(ErrorCode.UPSTREAM_TIMEOUT)

    with pytest.raises(ApplicationError) as raised:
        await catalog.browse_games(criteria())

    assert raised.value.code is ErrorCode.UPSTREAM_TIMEOUT


@pytest.mark.anyio
async def test_autocomplete_has_no_stale_fallback() -> None:
    catalog, provider, clock, _ = build()
    suggestion = AutocompleteCriteria(query="hollow")
    await catalog.autocomplete(suggestion)
    clock.advance(hours=1)
    provider.failure = ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    with pytest.raises(ApplicationError):
        await catalog.autocomplete(suggestion)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "code",
    [ErrorCode.INVALID_QUERY, ErrorCode.VALIDATION_ERROR, ErrorCode.INTERNAL_ERROR],
)
async def test_failures_that_are_not_the_providers_never_fall_back(
    code: ErrorCode,
) -> None:
    catalog, provider, clock, _ = build()
    await catalog.browse_games(criteria())
    clock.advance(hours=2)
    provider.failure = ApplicationError(code)

    with pytest.raises(ApplicationError) as raised:
        await catalog.browse_games(criteria())

    assert raised.value.code is code


@pytest.mark.anyio
async def test_without_a_usable_cache_a_provider_failure_is_the_classified_error() -> (
    None
):
    catalog, provider, _, _ = build(FailingCacheStore())
    provider.failure = ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    with pytest.raises(ApplicationError) as raised:
        await catalog.browse_games(criteria())

    assert raised.value.code is ErrorCode.UPSTREAM_UNAVAILABLE


@pytest.mark.anyio
async def test_coalesced_callers_all_receive_the_stale_fallback() -> None:
    catalog, provider, clock, _ = build()
    await catalog.browse_games(criteria())
    clock.advance(hours=2)
    provider.failure = ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)
    provider.release.clear()

    async def browse() -> tuple[GamePage, list[CacheOutcome]]:
        with record_cache_outcomes() as outcomes:
            page = await catalog.browse_games(criteria())
        return page, outcomes

    pending = [asyncio.ensure_future(browse()) for _ in range(5)]
    await asyncio.sleep(0)
    provider.release.set()
    results = await asyncio.gather(*pending)

    assert provider.calls["search"] == 2
    assert all(page.meta.data_may_be_stale for page, _ in results)
    assert all(outcomes == [CacheOutcome.STALE] for _, outcomes in results)


@pytest.mark.anyio
async def test_serving_stale_data_is_logged_with_its_cause_only(
    caplog: pytest.LogCaptureFixture,
) -> None:
    catalog, provider, clock, _ = build()
    await catalog.browse_games(criteria(name="Hollow"))
    clock.advance(hours=2)
    provider.failure = ApplicationError(ErrorCode.UPSTREAM_TIMEOUT)

    with caplog.at_level(logging.WARNING, logger="whattoplaynext_api.cache"):
        await catalog.browse_games(criteria(name="Hollow"))

    (record,) = caplog.records
    assert record.message == "cache.stale_served"
    assert record.__dict__["resource"] == "search"
    assert record.__dict__["error_code"] == "UPSTREAM_TIMEOUT"
    assert "Hollow" not in caplog.text

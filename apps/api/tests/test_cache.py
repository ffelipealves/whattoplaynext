"""Tests for the typed cache facade over the cache-store port."""

import logging
from datetime import timedelta

import pytest
from cache_fakes import FailingCacheStore, InMemoryCacheStore, ManualClock
from pydantic import BaseModel

from whattoplaynext_api.cache.cache import Cache, CacheHealth

KEY = "wtpn:test:cache:v1:search:s1:" + "0" * 64


class Page(BaseModel):
    title: str
    total: int
    rating: float | None = None


PAGE = Page(title="Hollow Knight", total=240)


def build(clock: ManualClock) -> tuple[Cache, InMemoryCacheStore]:
    store = InMemoryCacheStore(clock)
    return Cache(store, clock=clock), store


@pytest.mark.anyio
async def test_a_written_value_reads_back_as_fresh_with_its_timestamps() -> None:
    clock = ManualClock()
    cache, _ = build(clock)
    stored_at = clock.now

    await cache.write(
        KEY, PAGE, fresh_for=timedelta(hours=1), stale_for=timedelta(hours=24)
    )
    cached = await cache.read(KEY, Page)

    assert cached is not None
    assert cached.value == PAGE
    assert cached.stored_at == stored_at
    assert cached.fresh_until == stored_at + timedelta(hours=1)
    assert cached.is_fresh(clock.now)


@pytest.mark.anyio
async def test_the_store_keeps_an_entry_for_its_fresh_and_stale_lifetimes() -> None:
    clock = ManualClock()
    cache, store = build(clock)

    await cache.write(
        KEY, PAGE, fresh_for=timedelta(hours=1), stale_for=timedelta(hours=24)
    )

    assert store.ttl_seconds(KEY) == 25 * 3600


@pytest.mark.anyio
async def test_an_entry_past_its_fresh_ttl_reads_back_as_expired() -> None:
    clock = ManualClock()
    cache, _ = build(clock)
    await cache.write(
        KEY, PAGE, fresh_for=timedelta(hours=1), stale_for=timedelta(hours=24)
    )

    clock.advance(hours=1)
    cached = await cache.read(KEY, Page)

    assert cached is not None
    assert not cached.is_fresh(clock.now)
    assert cached.value == PAGE


@pytest.mark.anyio
async def test_an_entry_past_its_stale_window_is_gone() -> None:
    clock = ManualClock()
    cache, _ = build(clock)
    await cache.write(
        KEY, PAGE, fresh_for=timedelta(hours=1), stale_for=timedelta(hours=24)
    )

    clock.advance(hours=25)

    assert await cache.read(KEY, Page) is None


@pytest.mark.anyio
async def test_a_missing_key_is_a_miss() -> None:
    cache, _ = build(ManualClock())

    assert await cache.read(KEY, Page) is None


@pytest.mark.anyio
async def test_an_entry_without_a_stale_window_expires_with_its_fresh_ttl() -> None:
    clock = ManualClock()
    cache, store = build(clock)

    await cache.write(KEY, PAGE, fresh_for=timedelta(minutes=10))

    assert store.ttl_seconds(KEY) == 600


@pytest.mark.anyio
async def test_a_sub_second_lifetime_is_stored_for_at_least_one_second() -> None:
    clock = ManualClock()
    cache, store = build(clock)

    await cache.write(KEY, PAGE, fresh_for=timedelta(milliseconds=200))

    assert store.ttl_seconds(KEY) == 1


@pytest.mark.anyio
async def test_rejects_a_non_positive_fresh_lifetime() -> None:
    cache, _ = build(ManualClock())

    with pytest.raises(ValueError, match="fresh"):
        await cache.write(KEY, PAGE, fresh_for=timedelta(0))


@pytest.mark.anyio
@pytest.mark.parametrize(
    "raw",
    [
        b"not json",
        b'{"v": 1}',
        b'{"v": 99, "storedAt": "2026-09-27T00:00:00Z",'
        b' "freshUntil": "2026-09-27T01:00:00Z", "payload": {}}',
        # A well-formed envelope whose payload no longer matches the model.
        b'{"v": 1, "storedAt": "2026-09-27T00:00:00Z",'
        b' "freshUntil": "2026-09-27T01:00:00Z", "payload": {"title": 3}}',
    ],
)
async def test_an_undecodable_entry_is_deleted_logged_and_treated_as_a_miss(
    raw: bytes, caplog: pytest.LogCaptureFixture
) -> None:
    clock = ManualClock()
    cache, store = build(clock)
    store.put_raw(KEY, raw)

    with caplog.at_level(logging.WARNING, logger="whattoplaynext_api.cache"):
        cached = await cache.read(KEY, Page)

    assert cached is None
    assert KEY not in store.stored_keys()
    assert [record.message for record in caplog.records] == ["cache.decode_failed"]
    assert raw.decode(errors="replace") not in caplog.text


@pytest.mark.anyio
async def test_rejects_a_negative_stale_window() -> None:
    cache, _ = build(ManualClock())

    with pytest.raises(ValueError, match="stale"):
        await cache.write(
            KEY, PAGE, fresh_for=timedelta(hours=1), stale_for=timedelta(hours=-1)
        )


@pytest.mark.anyio
async def test_a_failed_write_starts_the_bypass() -> None:
    cache, store = build(ManualClock())
    store.available = False

    await cache.write(KEY, PAGE, fresh_for=timedelta(hours=1))
    store.available = True
    await cache.read(KEY, Page)

    assert store.calls == ["set"]


@pytest.mark.anyio
async def test_a_failed_discard_of_an_undecodable_entry_starts_the_bypass() -> None:
    clock = ManualClock()

    class DeleteFails(InMemoryCacheStore):
        async def delete(self, key: str) -> None:
            self.available = False
            await super().delete(key)

    failing_delete = DeleteFails(clock)
    failing_delete.put_raw(KEY, b"not json")
    cache = Cache(failing_delete, clock=clock)

    assert await cache.read(KEY, Page) is None
    failing_delete.available = True
    assert await cache.read(KEY, Page) is None
    assert failing_delete.calls == ["get", "delete"]


@pytest.mark.anyio
async def test_an_unavailable_store_reads_as_a_miss_and_skips_writes() -> None:
    store = FailingCacheStore()
    cache = Cache(store, clock=ManualClock())

    assert await cache.read(KEY, Page) is None
    await cache.write(KEY, PAGE, fresh_for=timedelta(hours=1))


@pytest.mark.anyio
async def test_after_a_failure_the_store_is_bypassed_for_the_cooldown() -> None:
    clock = ManualClock()
    store = FailingCacheStore()
    cache = Cache(store, clock=clock, bypass_for=timedelta(seconds=30))

    await cache.read(KEY, Page)
    await cache.read(KEY, Page)
    await cache.write(KEY, PAGE, fresh_for=timedelta(hours=1))
    assert store.calls == ["get"]

    clock.advance(seconds=30)
    await cache.read(KEY, Page)
    assert store.calls == ["get", "get"]


@pytest.mark.anyio
async def test_an_unavailable_store_is_logged_without_connection_details(
    caplog: pytest.LogCaptureFixture,
) -> None:
    cache = Cache(FailingCacheStore(), clock=ManualClock())

    with caplog.at_level(logging.WARNING, logger="whattoplaynext_api.cache"):
        await cache.read(KEY, Page)

    assert [record.message for record in caplog.records] == ["cache.unavailable"]


@pytest.mark.anyio
async def test_a_disabled_cache_never_stores_anything() -> None:
    cache = Cache(None, clock=ManualClock())

    await cache.write(KEY, PAGE, fresh_for=timedelta(hours=1))

    assert await cache.read(KEY, Page) is None
    assert await cache.health() is CacheHealth.DISABLED


@pytest.mark.anyio
async def test_health_reports_a_reachable_store_as_up() -> None:
    cache, store = build(ManualClock())

    assert await cache.health() is CacheHealth.UP
    assert store.calls == ["ping"]


@pytest.mark.anyio
async def test_health_reports_an_unreachable_store_as_down() -> None:
    cache = Cache(FailingCacheStore(), clock=ManualClock())

    assert await cache.health() is CacheHealth.DOWN


@pytest.mark.anyio
async def test_a_successful_health_check_ends_the_bypass_early() -> None:
    clock = ManualClock()
    cache, store = build(clock)
    store.available = False
    await cache.read(KEY, Page)

    store.available = True
    assert await cache.health() is CacheHealth.UP
    await cache.write(KEY, PAGE, fresh_for=timedelta(hours=1))

    assert store.calls == ["get", "ping", "set"]

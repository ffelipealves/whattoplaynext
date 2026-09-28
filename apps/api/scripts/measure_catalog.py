"""Opt-in cold versus warm timings and Redis entry sizes against live IGDB.

Reproduces the Milestone 4 performance profile: each representative search
shape is requested once cold (a provider call) and then repeatedly warm (a
cache hit), and the warm p50/p95 are reported against NFR-001's 500 ms p95.

Never run by CI or ``pnpm quality``: it needs network access and Twitch
credentials in ``apps/api/.env``. By default the cache lives in memory; with
``--redis`` it goes through the configured Redis under a separate ``measure``
namespace, reports Redis's byte accounting by resource, and deletes every key
it wrote. Prints only shapes, totals, timings, and aggregate byte counts.
"""

import argparse
import asyncio
import sys
import time
from datetime import date

from whattoplaynext_api.adapters.redis.store import RedisCacheStore
from whattoplaynext_api.cache.cache import Cache
from whattoplaynext_api.cache.catalog import CachingCatalog
from whattoplaynext_api.catalog.models import (
    BrowseCriteria,
    GenreId,
    PlatformId,
    SortDirection,
    SortOption,
)
from whattoplaynext_api.core.settings import get_settings
from whattoplaynext_api.main import build_catalog, build_circuit

WARM_REQUESTS = 50

SHAPES = {
    "unfiltered, sorted by rating": BrowseCriteria(
        sort=SortOption.RATING, direction=SortDirection.DESCENDING
    ),
    "switch + indie + 2-10 h (debt 2)": BrowseCriteria(
        platform_ids=(PlatformId.NINTENDO_SWITCH,),
        genre_ids=(GenreId.INDIE,),
        minimum_duration_seconds=2 * 3600,
        maximum_duration_seconds=10 * 3600,
    ),
    "pc + all of 2020 (debt 2b)": BrowseCriteria(
        platform_ids=(PlatformId.PC,),
        release_from=date(2020, 1, 1),
        release_to=date(2020, 12, 31),
    ),
}


class MemoryStore:
    """A cache store without expiry; one measurement run is short."""

    def __init__(self) -> None:
        self.values: dict[str, bytes] = {}

    async def get(self, key: str) -> bytes | None:
        return self.values.get(key)

    async def set(self, key: str, value: bytes, ttl_seconds: int) -> None:
        self.values[key] = value

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)

    async def ping(self) -> None:
        return None


class TrackingRedisStore:
    """The Redis store, remembering every key it wrote so it can clean up."""

    def __init__(self, inner: RedisCacheStore) -> None:
        self.inner = inner
        self.written: set[str] = set()

    async def get(self, key: str) -> bytes | None:
        return await self.inner.get(key)

    async def set(self, key: str, value: bytes, ttl_seconds: int) -> None:
        self.written.add(key)
        await self.inner.set(key, value, ttl_seconds)

    async def delete(self, key: str) -> None:
        await self.inner.delete(key)

    async def ping(self) -> None:
        await self.inner.ping()

    async def memory_usage_by_resource(self) -> dict[str, list[int]]:
        """Measure written entries without exposing cache keys or payloads."""
        sizes: dict[str, list[int]] = {}
        for key in self.written:
            size = await self.inner.memory_usage(key)
            if size is not None:
                resource = key.split(":", maxsplit=5)[4]
                sizes.setdefault(resource, []).append(size)
        return sizes


def percentile(sorted_seconds: list[float], fraction: float) -> float:
    index = max(0, round(fraction * len(sorted_seconds)) - 1)
    return sorted_seconds[index] * 1000


def format_memory_sizes(sizes: dict[str, list[int]]) -> list[str]:
    """Render aggregates suitable for a runbook without leaking catalog data."""
    return [
        (
            f"redis {resource}: entries={len(entries)} total={sum(entries)}B "
            f"min={min(entries)}B average={sum(entries) / len(entries):.0f}B "
            f"max={max(entries)}B"
        )
        for resource, entries in sorted(sizes.items())
        if entries
    ]


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--redis", action="store_true", help="measure through the configured Redis"
    )
    arguments = parser.parse_args()

    settings = get_settings()
    if settings.twitch_client_id is None or settings.twitch_client_secret is None:
        print(
            "WTPN_TWITCH_CLIENT_ID and WTPN_TWITCH_CLIENT_SECRET are not set in "
            "apps/api/.env.",
            file=sys.stderr,
        )
        return 1
    if arguments.redis and settings.redis_url is None:
        print("--redis needs WTPN_REDIS_URL in apps/api/.env.", file=sys.stderr)
        return 1

    redis: TrackingRedisStore | None = None
    store: MemoryStore | TrackingRedisStore
    if arguments.redis:
        redis = TrackingRedisStore(
            RedisCacheStore.from_url(
                str(settings.redis_url),
                operation_timeout_seconds=settings.cache_operation_timeout_seconds,
                max_connections=settings.cache_max_connections,
            )
        )
        store = redis
    else:
        store = MemoryStore()

    provider, client = build_catalog(settings, build_circuit(settings))
    catalog = CachingCatalog(
        provider, Cache(store), environment="measure", api_version="v1"
    )
    print(f"cache: {'redis' if redis else 'memory'}; warm requests: {WARM_REQUESTS}")
    try:
        detail_game_id: int | None = None
        for label, criteria in SHAPES.items():
            started = time.perf_counter()
            page = await catalog.browse_games(criteria)
            cold = time.perf_counter() - started
            warm: list[float] = []
            for _ in range(WARM_REQUESTS):
                started = time.perf_counter()
                await catalog.browse_games(criteria)
                warm.append(time.perf_counter() - started)
            warm.sort()
            print(
                f"{label}: total={page.pagination.total_items} cold={cold:.2f}s "
                f"warm_p50={percentile(warm, 0.5):.2f}ms "
                f"warm_p95={percentile(warm, 0.95):.2f}ms"
            )
            if detail_game_id is None and page.items:
                detail_game_id = page.items[0].id
        if detail_game_id is not None:
            await catalog.get_game_detail(detail_game_id)
        if redis is not None:
            for measurement in format_memory_sizes(
                await redis.memory_usage_by_resource()
            ):
                print(measurement)
    finally:
        if redis is not None:
            for key in redis.written:
                await redis.delete(key)
            await redis.inner.aclose()
        if client is not None:
            await client.aclose()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

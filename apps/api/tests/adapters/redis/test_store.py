"""Tests for the Redis implementation of the cache-store port."""

import asyncio
import os
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from whattoplaynext_api.adapters.redis.store import RedisCacheStore
from whattoplaynext_api.cache.store import CacheUnavailableError

KEY = "wtpn:test:cache:v1:search:s1:digest"


class StubRedis:
    """Records the commands the store sends; optionally fails them."""

    def __init__(self, *, failure: BaseException | None = None) -> None:
        self.values: dict[str, bytes] = {}
        self.memory_sizes: dict[str, int] = {}
        self.commands: list[tuple[object, ...]] = []
        self.failure = failure

    def _run(self, *command: object) -> None:
        self.commands.append(command)
        if self.failure is not None:
            raise self.failure

    async def get(self, name: str) -> bytes | None:
        self._run("get", name)
        return self.values.get(name)

    async def set(self, name: str, value: bytes, *, ex: int) -> bool:
        self._run("set", name, value, ex)
        self.values[name] = value
        return True

    async def delete(self, *names: str) -> int:
        self._run("delete", *names)
        return sum(self.values.pop(name, None) is not None for name in names)

    async def ping(self) -> bool:
        self._run("ping")
        return True

    async def memory_usage(self, key: str) -> int | None:
        self._run("memory_usage", key)
        return self.memory_sizes.get(key)

    async def aclose(self) -> None:
        self._run("aclose")

    def pipeline(self, transaction: bool = True) -> StubPipeline:
        return StubPipeline(self, transaction)


class StubPipeline:
    def __init__(self, client: StubRedis, transaction: bool) -> None:
        self.client = client
        self.transaction = transaction
        self.queued: list[tuple[object, ...]] = []

    def incr(self, name: str) -> None:
        self.queued.append(("incr", name))

    def expire(self, name: str, seconds: int) -> None:
        self.queued.append(("expire", name, seconds))

    def get(self, name: str) -> None:
        self.queued.append(("get", name))

    async def execute(self) -> list[object]:
        self.client._run("pipeline", self.transaction, *self.queued)
        results: list[object] = []
        for command in self.queued:
            if command[0] == "incr":
                name = str(command[1])
                count = int(self.client.values.get(name, b"0")) + 1
                self.client.values[name] = str(count).encode()
                results.append(count)
            elif command[0] == "expire":
                results.append(True)
            else:
                results.append(self.client.values.get(str(command[1])))
        return results


@pytest.mark.anyio
async def test_writes_with_an_expiry_and_reads_the_bytes_back() -> None:
    client = StubRedis()
    store = RedisCacheStore(client, operation_timeout_seconds=0.2)

    await store.set(KEY, b"payload", 90)

    assert await store.get(KEY) == b"payload"
    assert client.commands[0] == ("set", KEY, b"payload", 90)


@pytest.mark.anyio
async def test_deletes_and_pings_through_the_client() -> None:
    client = StubRedis()
    store = RedisCacheStore(client, operation_timeout_seconds=0.2)
    await store.set(KEY, b"payload", 90)

    await store.delete(KEY)
    await store.ping()

    assert await store.get(KEY) is None
    assert ("ping",) in client.commands


@pytest.mark.anyio
async def test_reports_redis_byte_accounting_without_reading_the_entry() -> None:
    client = StubRedis()
    client.memory_sizes[KEY] = 512
    store = RedisCacheStore(client, operation_timeout_seconds=0.2)

    assert await store.memory_usage(KEY) == 512
    assert await store.memory_usage("missing") is None
    assert ("memory_usage", KEY) in client.commands


@pytest.mark.anyio
@pytest.mark.parametrize(
    "failure",
    [RedisConnectionError("secret-host:6379 refused"), OSError("unreachable")],
)
async def test_client_failures_become_an_unavailable_store_without_details(
    failure: BaseException,
) -> None:
    store = RedisCacheStore(StubRedis(failure=failure), operation_timeout_seconds=0.2)

    with pytest.raises(CacheUnavailableError) as raised:
        await store.get(KEY)

    assert "secret-host" not in str(raised.value)
    assert raised.value.__cause__ is None


@pytest.mark.anyio
async def test_closing_the_store_closes_its_client() -> None:
    client = StubRedis()
    store = RedisCacheStore(client, operation_timeout_seconds=0.2)

    await store.aclose()

    assert client.commands == [("aclose",)]


@pytest.mark.anyio
async def test_an_unreachable_server_is_reported_as_unavailable() -> None:
    # Port 1 on loopback refuses connections on any normal machine.
    store = RedisCacheStore.from_url(
        "redis://127.0.0.1:1/0",
        operation_timeout_seconds=0.2,
        max_connections=2,
    )
    try:
        with pytest.raises(CacheUnavailableError):
            await store.ping()
    finally:
        await store.aclose()


@pytest.fixture
async def silent_server() -> AsyncIterator[int]:
    """A TCP server that accepts connections and never answers."""
    connections: list[asyncio.StreamWriter] = []

    async def accept(_: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        connections.append(writer)

    server = await asyncio.start_server(accept, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    try:
        yield port
    finally:
        for writer in connections:
            writer.close()
        server.close()
        await server.wait_closed()


@pytest.mark.anyio
async def test_a_server_that_never_answers_times_out_within_the_bound(
    silent_server: int,
) -> None:
    store = RedisCacheStore.from_url(
        f"redis://127.0.0.1:{silent_server}/0",
        operation_timeout_seconds=0.2,
        max_connections=2,
    )
    loop = asyncio.get_running_loop()
    started = loop.time()
    try:
        with pytest.raises(CacheUnavailableError):
            await store.get(KEY)
    finally:
        await store.aclose()

    assert loop.time() - started < 1.0


@pytest.mark.anyio
async def test_counts_a_hit_and_reads_the_previous_window_in_one_pipeline() -> None:
    client = StubRedis()
    client.values["previous"] = b"7"
    store = RedisCacheStore(client, operation_timeout_seconds=0.2)

    first = await store.hit("current", "previous", 120)
    second = await store.hit("current", "previous", 120)

    assert (first, second) == ((1, 7), (2, 7))
    assert client.commands[0] == (
        "pipeline",
        False,
        ("incr", "current"),
        ("expire", "current", 120),
        ("get", "previous"),
    )


@pytest.mark.anyio
async def test_a_missing_previous_window_counts_as_zero() -> None:
    store = RedisCacheStore(StubRedis(), operation_timeout_seconds=0.2)

    assert await store.hit("current", "previous", 120) == (1, 0)


@pytest.mark.anyio
async def test_a_failed_hit_is_an_unavailable_store() -> None:
    store = RedisCacheStore(
        StubRedis(failure=RedisConnectionError("down")),
        operation_timeout_seconds=0.2,
    )

    with pytest.raises(CacheUnavailableError):
        await store.hit("current", "previous", 120)


REDIS_URL = os.environ.get("WTPN_TEST_REDIS_URL")


@pytest.mark.anyio
@pytest.mark.skipif(
    REDIS_URL is None,
    reason="opt-in: set WTPN_TEST_REDIS_URL to run against a real Redis",
)
async def test_round_trips_and_expires_against_a_real_redis() -> None:
    assert REDIS_URL is not None
    store = RedisCacheStore.from_url(
        REDIS_URL, operation_timeout_seconds=0.5, max_connections=2
    )
    key = f"wtpn:test:cache:v1:opt-in:s1:{uuid4().hex}"
    try:
        await store.ping()
        await store.set(key, b"payload", 1)
        assert await store.get(key) == b"payload"

        await asyncio.sleep(1.2)
        assert await store.get(key) is None

        await store.set(key, b"payload", 60)
        assert await store.memory_usage(key) is not None
        await store.delete(key)
        assert await store.get(key) is None

        counter = f"{key}:counter"
        assert await store.hit(counter, f"{key}:previous", 60) == (1, 0)
        assert await store.hit(counter, f"{key}:previous", 60) == (2, 0)
    finally:
        await store.delete(key)
        await store.delete(f"{key}:counter")
        await store.aclose()

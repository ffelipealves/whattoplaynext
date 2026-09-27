"""Tests for visitor identity and the sliding-window rate limiter."""

import pytest

from whattoplaynext_api.cache.store import CacheUnavailableError
from whattoplaynext_api.ratelimit.identity import (
    CLIENT_ADDRESS_HEADER,
    EDGE_TOKEN_HEADER,
    IdentityDigester,
    client_address,
)
from whattoplaynext_api.ratelimit.limiter import (
    InMemoryCounterStore,
    SlidingWindowLimiter,
)
from whattoplaynext_api.ratelimit.policy import ProviderAdmission

TOKEN = "edge-secret"


class Clock:
    def __init__(self, now: float = 1_790_000_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


class FailingCounterStore:
    def __init__(self) -> None:
        self.calls = 0

    async def hit(
        self, current_key: str, previous_key: str, ttl_seconds: int
    ) -> tuple[int, int]:
        self.calls += 1
        raise CacheUnavailableError


def limiter(
    clock: Clock,
    *,
    limit: int = 3,
    store: object | None = None,
) -> SlidingWindowLimiter:
    return SlidingWindowLimiter(
        store or InMemoryCounterStore(clock),  # type: ignore[arg-type]
        fallback=InMemoryCounterStore(clock),
        name="public",
        limit=limit,
        window_seconds=60,
        clock=clock,
    )


@pytest.mark.anyio
async def test_allows_requests_up_to_the_limit_and_rejects_the_next() -> None:
    clock = Clock(1_790_000_020.0)
    rate = limiter(clock)

    decisions = [await rate.acquire("client") for _ in range(4)]

    assert [decision.allowed for decision in decisions] == [True, True, True, False]
    assert decisions[-1].retry_after_seconds is not None
    assert decisions[-1].retry_after_seconds >= 1


@pytest.mark.anyio
async def test_clients_have_independent_budgets() -> None:
    clock = Clock()
    rate = limiter(clock, limit=1)

    assert (await rate.acquire("first")).allowed
    assert (await rate.acquire("second")).allowed
    assert not (await rate.acquire("first")).allowed


@pytest.mark.anyio
async def test_the_budget_recovers_as_the_previous_window_slides_away() -> None:
    clock = Clock(1_790_000_020.0)  # 40 s into a 60 s window
    rate = limiter(clock, limit=3)
    for _ in range(3):
        await rate.acquire("client")
    rejected = await rate.acquire("client")
    assert not rejected.allowed

    # Waiting as long as the rejection says is enough.
    assert rejected.retry_after_seconds is not None
    clock.now += rejected.retry_after_seconds
    assert (await rate.acquire("client")).allowed


@pytest.mark.anyio
async def test_a_retry_before_the_advertised_time_is_still_rejected() -> None:
    clock = Clock(1_790_000_020.0)
    rate = limiter(clock, limit=3)
    for _ in range(3):
        await rate.acquire("client")
    rejected = await rate.acquire("client")
    assert rejected.retry_after_seconds is not None

    clock.now += rejected.retry_after_seconds - 2
    assert not (await rate.acquire("client")).allowed


@pytest.mark.anyio
async def test_the_previous_window_weighs_on_the_current_one() -> None:
    clock = Clock(1_790_000_020.0)
    rate = limiter(clock, limit=4)
    for _ in range(4):
        await rate.acquire("client")

    # Five seconds into the next window, 11/12 of the previous four still count.
    clock.now = 1_790_000_045.0
    assert not (await rate.acquire("client")).allowed

    # Near the end of the next window the previous window has almost faded.
    clock.now = 1_790_000_095.0
    assert (await rate.acquire("client")).allowed


@pytest.mark.anyio
async def test_falls_back_to_a_process_local_budget_when_redis_is_down() -> None:
    clock = Clock()
    failing = FailingCounterStore()
    rate = limiter(clock, limit=2, store=failing)

    decisions = [await rate.acquire("client") for _ in range(3)]

    assert failing.calls == 3
    assert [decision.allowed for decision in decisions] == [True, True, False]


def test_counter_keys_hold_only_the_digest_and_window() -> None:
    clock = Clock(1_790_000_020.0)
    rate = limiter(clock)

    current, previous = rate.keys("abc123")

    assert current == "wtpn:ratelimit:v1:public:abc123:29833333"
    assert previous == "wtpn:ratelimit:v1:public:abc123:29833332"


def test_the_in_memory_store_forgets_expired_counters() -> None:
    clock = Clock()
    store = InMemoryCounterStore(clock)
    store.increment("key", ttl_seconds=10)

    clock.now += 10

    assert store.count("key") == 0


def headers(**values: str) -> dict[str, str]:
    return {key.lower(): value for key, value in values.items()}


def test_uses_the_forwarded_address_only_with_the_edge_token() -> None:
    forwarded = {
        CLIENT_ADDRESS_HEADER.lower(): "203.0.113.9",
        EDGE_TOKEN_HEADER.lower(): TOKEN,
    }

    assert (
        client_address(forwarded, "10.0.0.2", edge_token=TOKEN, trusted_proxy_hops=0)
        == "203.0.113.9"
    )


@pytest.mark.parametrize("token", [None, "wrong", ""])
def test_ignores_a_forwarded_address_without_a_valid_token(token: str | None) -> None:
    forwarded = {CLIENT_ADDRESS_HEADER.lower(): "203.0.113.9"}
    if token is not None:
        forwarded[EDGE_TOKEN_HEADER.lower()] = token

    assert (
        client_address(forwarded, "10.0.0.2", edge_token=TOKEN, trusted_proxy_hops=0)
        == "10.0.0.2"
    )


def test_ignores_every_forwarded_address_when_no_edge_token_is_configured() -> None:
    forwarded = {
        CLIENT_ADDRESS_HEADER.lower(): "203.0.113.9",
        EDGE_TOKEN_HEADER.lower(): "",
    }

    assert (
        client_address(forwarded, "10.0.0.2", edge_token=None, trusted_proxy_hops=0)
        == "10.0.0.2"
    )


def test_a_valid_token_with_an_unparseable_address_uses_the_peer() -> None:
    forwarded = {
        CLIENT_ADDRESS_HEADER.lower(): "not an address",
        EDGE_TOKEN_HEADER.lower(): TOKEN,
    }

    assert (
        client_address(forwarded, "10.0.0.2", edge_token=TOKEN, trusted_proxy_hops=0)
        == "10.0.0.2"
    )


@pytest.mark.parametrize(
    ("hops", "expected"),
    [(0, "10.0.0.2"), (1, "198.51.100.4"), (2, "192.0.2.1"), (5, "192.0.2.1")],
)
def test_reads_x_forwarded_for_from_the_right_by_trusted_hops(
    hops: int, expected: str
) -> None:
    forwarded = {"x-forwarded-for": "192.0.2.1, 198.51.100.4"}

    assert (
        client_address(forwarded, "10.0.0.2", edge_token=None, trusted_proxy_hops=hops)
        == expected
    )


def test_ipv6_addresses_are_reduced_to_their_64_bit_prefix() -> None:
    forwarded = {
        CLIENT_ADDRESS_HEADER.lower(): "2001:db8:1:2:aaaa:bbbb:cccc:dddd",
        EDGE_TOKEN_HEADER.lower(): TOKEN,
    }

    assert (
        client_address(forwarded, None, edge_token=TOKEN, trusted_proxy_hops=0)
        == "2001:db8:1:2::/64"
    )


def test_without_any_address_there_is_no_identity() -> None:
    assert client_address({}, None, edge_token=None, trusted_proxy_hops=0) is None


def test_digests_are_stable_keyed_and_hide_the_address() -> None:
    first = IdentityDigester(b"key-one")
    second = IdentityDigester(b"key-two")

    digest = first.digest("203.0.113.9")

    assert digest == first.digest("203.0.113.9")
    assert digest != second.digest("203.0.113.9")
    assert digest != first.digest("203.0.113.10")
    assert "203" not in digest
    assert len(digest) == 32


@pytest.mark.anyio
async def test_a_budget_held_back_only_by_the_previous_window_reopens_within_it() -> (
    None
):
    clock = Clock(1_790_000_020.0)  # 40 s into the window
    rate = limiter(clock, limit=4)
    for _ in range(4):
        await rate.acquire("client")

    clock.now = 1_790_000_040.0  # the next window, 0 s in: all four still weigh
    rejected = await rate.acquire("client")
    assert not rejected.allowed
    assert rejected.retry_after_seconds is not None
    assert rejected.retry_after_seconds < 60

    clock.now += rejected.retry_after_seconds
    assert (await rate.acquire("client")).allowed


def test_an_ipv4_mapped_ipv6_address_counts_as_its_ipv4_address() -> None:
    assert (
        client_address({}, "::ffff:203.0.113.9", edge_token=None, trusted_proxy_hops=0)
        == "203.0.113.9"
    )


def test_an_unparseable_forwarded_for_entry_falls_back_to_the_peer() -> None:
    forwarded = {"x-forwarded-for": "garbage"}

    assert (
        client_address(forwarded, "10.0.0.2", edge_token=None, trusted_proxy_hops=1)
        == "10.0.0.2"
    )


def test_the_in_memory_store_prunes_expired_counters_as_it_goes() -> None:
    clock = Clock()
    store = InMemoryCounterStore(clock)
    store.increment("old", ttl_seconds=1)
    clock.now += 2

    for index in range(InMemoryCounterStore.PRUNE_EVERY):
        store.increment(f"new-{index % 3}", ttl_seconds=60)

    assert "old" not in store._counters  # noqa: SLF001 - checks memory is bounded


@pytest.mark.anyio
async def test_provider_admission_lets_unidentified_calls_through() -> None:
    admission = ProviderAdmission(limiter(Clock(), limit=1))

    for _ in range(3):
        await admission()

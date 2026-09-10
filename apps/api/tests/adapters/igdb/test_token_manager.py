"""Behavior tests for the Twitch application-token manager."""

import asyncio

import pytest

from whattoplaynext_api.adapters.igdb.token import TokenGrant, TwitchTokenManager


class FakeTokenEndpoint:
    """Controllable stand-in for the true Twitch HTTP boundary."""

    def __init__(self, *grants: TokenGrant) -> None:
        self.grants = list(grants) or [
            TokenGrant(
                access_token="test-access-token",
                expires_in_seconds=3600,
            )
        ]
        self.calls = 0

    async def issue_token(self, client_id: str, client_secret: str) -> TokenGrant:
        grant = self.grants[self.calls]
        self.calls += 1
        return grant


class MutableClock:
    def __init__(self, now: float = 0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


class SlowTokenEndpoint:
    def __init__(self) -> None:
        self.calls = 0

    async def issue_token(self, client_id: str, client_secret: str) -> TokenGrant:
        self.calls += 1
        await asyncio.sleep(0.01)
        return TokenGrant("shared-token", expires_in_seconds=3600)


@pytest.mark.anyio
async def test_acquires_an_application_token_on_first_use() -> None:
    manager = TwitchTokenManager(
        client_id="test-client-id",
        client_secret="test-client-secret",
        endpoint=FakeTokenEndpoint(),
    )

    assert await manager.get_access_token() == "test-access-token"


@pytest.mark.anyio
async def test_reuses_a_token_before_its_refresh_deadline() -> None:
    endpoint = FakeTokenEndpoint()
    clock = MutableClock()
    manager = TwitchTokenManager(
        client_id="test-client-id",
        client_secret="test-client-secret",
        endpoint=endpoint,
        clock=clock,
        refresh_margin_seconds=60,
    )

    first_token = await manager.get_access_token()
    clock.now = 3539
    second_token = await manager.get_access_token()

    assert first_token == second_token == "test-access-token"
    assert endpoint.calls == 1


@pytest.mark.anyio
async def test_refreshes_a_token_at_the_safety_margin() -> None:
    endpoint = FakeTokenEndpoint(
        TokenGrant("first-token", expires_in_seconds=3600),
        TokenGrant("refreshed-token", expires_in_seconds=3600),
    )
    clock = MutableClock()
    manager = TwitchTokenManager(
        client_id="test-client-id",
        client_secret="test-client-secret",
        endpoint=endpoint,
        clock=clock,
        refresh_margin_seconds=60,
    )

    assert await manager.get_access_token() == "first-token"
    clock.now = 3540

    assert await manager.get_access_token() == "refreshed-token"
    assert endpoint.calls == 2


@pytest.mark.anyio
async def test_single_flights_concurrent_refreshes() -> None:
    endpoint = SlowTokenEndpoint()
    manager = TwitchTokenManager(
        client_id="test-client-id",
        client_secret="test-client-secret",
        endpoint=endpoint,
    )

    tokens = await asyncio.gather(*(manager.get_access_token() for _ in range(5)))

    assert tokens == ["shared-token"] * 5
    assert endpoint.calls == 1


@pytest.mark.anyio
async def test_does_not_expose_credentials_or_cached_token_in_its_representation() -> (
    None
):
    manager = TwitchTokenManager(
        client_id="test-client-id",
        client_secret="test-client-secret",
        endpoint=FakeTokenEndpoint(),
    )

    await manager.get_access_token()
    representation = repr(manager)

    assert "test-client-id" not in representation
    assert "test-client-secret" not in representation
    assert "test-access-token" not in representation

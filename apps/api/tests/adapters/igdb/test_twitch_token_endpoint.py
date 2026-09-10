"""Contract tests for the Twitch identity HTTP boundary."""

from urllib.parse import parse_qs

import httpx
import pytest

from whattoplaynext_api.adapters.igdb.token import (
    HttpxTwitchTokenEndpoint,
    TokenErrorReason,
    TwitchTokenError,
)


@pytest.mark.anyio
async def test_exchanges_credentials_using_the_official_form_contract() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url == httpx.URL("https://id.twitch.tv/oauth2/token")
        assert request.headers["content-type"].startswith(
            "application/x-www-form-urlencoded"
        )
        assert parse_qs(request.content.decode()) == {
            "client_id": ["test-client-id"],
            "client_secret": ["test-client-secret"],
            "grant_type": ["client_credentials"],
        }
        return httpx.Response(
            200,
            json={
                "access_token": "provider-token",
                "expires_in": 3600,
                "token_type": "bearer",
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        endpoint = HttpxTwitchTokenEndpoint(client)
        grant = await endpoint.issue_token("test-client-id", "test-client-secret")

    assert grant.access_token == "provider-token"
    assert grant.expires_in_seconds == 3600


@pytest.mark.anyio
async def test_classifies_a_malformed_success_response() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"expires_in": "not-a-number"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        endpoint = HttpxTwitchTokenEndpoint(client)

        with pytest.raises(TwitchTokenError) as error:
            await endpoint.issue_token("test-client-id", "test-client-secret")

    assert error.value.reason is TokenErrorReason.INVALID_RESPONSE


@pytest.mark.anyio
async def test_classifies_a_timeout() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("provider details", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        endpoint = HttpxTwitchTokenEndpoint(client)

        with pytest.raises(TwitchTokenError) as error:
            await endpoint.issue_token("test-client-id", "test-client-secret")

    assert error.value.reason is TokenErrorReason.TIMEOUT
    assert "provider details" not in str(error.value)


@pytest.mark.anyio
async def test_classifies_rejected_credentials_without_leaking_details() -> None:
    secret = "test-client-secret"

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            401,
            json={"message": f"rejected credential {secret}"},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        endpoint = HttpxTwitchTokenEndpoint(client)

        with pytest.raises(TwitchTokenError) as error:
            await endpoint.issue_token("test-client-id", secret)

    assert error.value.reason is TokenErrorReason.AUTHENTICATION_REJECTED
    assert secret not in str(error.value)
    assert "rejected credential" not in str(error.value)


@pytest.mark.anyio
async def test_classifies_provider_unavailability() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="internal provider details")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        endpoint = HttpxTwitchTokenEndpoint(client)

        with pytest.raises(TwitchTokenError) as error:
            await endpoint.issue_token("test-client-id", "test-client-secret")

    assert error.value.reason is TokenErrorReason.UNAVAILABLE
    assert "internal provider details" not in str(error.value)

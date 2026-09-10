"""Twitch application-token acquisition and lifecycle management."""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from time import monotonic
from typing import Protocol, cast

import httpx

TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"


class TokenErrorReason(StrEnum):
    """Operational failure categories exposed to the application layer."""

    AUTHENTICATION_REJECTED = "authentication_rejected"
    TIMEOUT = "timeout"
    UNAVAILABLE = "unavailable"
    INVALID_RESPONSE = "invalid_response"


class TwitchTokenError(Exception):
    """Secret-safe failure from the Twitch identity boundary."""

    def __init__(self, reason: TokenErrorReason) -> None:
        self.reason = reason
        super().__init__(f"Twitch token request failed: {reason.value}")


@dataclass(frozen=True, slots=True)
class TokenGrant:
    """Validated token data returned by the Twitch identity boundary."""

    access_token: str
    expires_in_seconds: int


class TokenEndpoint(Protocol):
    """Boundary implemented by the Twitch identity HTTP adapter."""

    async def issue_token(self, client_id: str, client_secret: str) -> TokenGrant:
        """Exchange backend credentials for an application token."""
        ...


class HttpxTwitchTokenEndpoint:
    """Exchange credentials with Twitch Identity over HTTP."""

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def issue_token(self, client_id: str, client_secret: str) -> TokenGrant:
        try:
            response = await self._client.post(
                TWITCH_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "client_credentials",
                },
            )
        except httpx.TimeoutException:
            raise TwitchTokenError(TokenErrorReason.TIMEOUT) from None
        except httpx.RequestError:
            raise TwitchTokenError(TokenErrorReason.UNAVAILABLE) from None

        if response.status_code in {400, 401, 403}:
            raise TwitchTokenError(TokenErrorReason.AUTHENTICATION_REJECTED)
        if response.status_code >= 500 or response.status_code == 429:
            raise TwitchTokenError(TokenErrorReason.UNAVAILABLE)
        if not response.is_success:
            raise TwitchTokenError(TokenErrorReason.INVALID_RESPONSE)

        try:
            payload = cast(dict[str, object], response.json())
            access_token = payload["access_token"]
            expires_in = payload["expires_in"]
            token_type = payload["token_type"]
        except KeyError, TypeError, ValueError:
            raise TwitchTokenError(TokenErrorReason.INVALID_RESPONSE) from None

        if (
            not isinstance(access_token, str)
            or not access_token
            or not isinstance(expires_in, int)
            or isinstance(expires_in, bool)
            or expires_in <= 0
            or not isinstance(token_type, str)
            or token_type.casefold() != "bearer"
        ):
            raise TwitchTokenError(TokenErrorReason.INVALID_RESPONSE)

        return TokenGrant(
            access_token=access_token,
            expires_in_seconds=expires_in,
        )


class TwitchTokenManager:
    """Provide a valid Twitch application token to provider adapters."""

    def __init__(
        self,
        *,
        client_id: str,
        client_secret: str,
        endpoint: TokenEndpoint,
        clock: Callable[[], float] = monotonic,
        refresh_margin_seconds: int = 60,
    ) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._endpoint = endpoint
        self._clock = clock
        self._refresh_margin_seconds = refresh_margin_seconds
        self._access_token: str | None = None
        self._refresh_at = 0.0
        self._refresh_lock = asyncio.Lock()

    async def get_access_token(self) -> str:
        """Return an application access token."""
        now = self._clock()
        if self._access_token is not None and now < self._refresh_at:
            return self._access_token

        async with self._refresh_lock:
            now = self._clock()
            if self._access_token is not None and now < self._refresh_at:
                return self._access_token

            grant = await self._endpoint.issue_token(
                self._client_id,
                self._client_secret,
            )
            self._access_token = grant.access_token
            self._refresh_at = now + max(
                0,
                grant.expires_in_seconds - self._refresh_margin_seconds,
            )
            return self._access_token

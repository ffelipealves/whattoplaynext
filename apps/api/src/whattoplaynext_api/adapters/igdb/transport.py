"""Authenticated HTTP transport for IGDB APICalypse queries."""

import asyncio
from collections.abc import Awaitable, Callable
from enum import StrEnum
from math import ceil
from random import uniform
from time import monotonic
from typing import Protocol, cast

import httpx

IGDB_API_BASE_URL = "https://api.igdb.com/v4"


class IgdbErrorReason(StrEnum):
    """Operational failure categories exposed to the application layer."""

    AUTHENTICATION_REJECTED = "authentication_rejected"
    INVALID_REQUEST = "invalid_request"
    INVALID_RESPONSE = "invalid_response"
    TIMEOUT = "timeout"
    RATE_LIMITED = "rate_limited"
    UNAVAILABLE = "unavailable"


class IgdbTransportError(Exception):
    """Provider-safe failure from the IGDB HTTP boundary."""

    def __init__(
        self,
        reason: IgdbErrorReason,
        *,
        retry_after_seconds: int | None = None,
    ) -> None:
        self.reason = reason
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"IGDB request failed: {reason.value}")


class AccessTokenProvider(Protocol):
    """Supply a valid application token without exposing its lifecycle."""

    async def get_access_token(self) -> str:
        """Return a valid Twitch application access token."""
        ...


class IgdbTransport:
    """Execute authenticated IGDB queries and return provider records."""

    def __init__(
        self,
        *,
        client: httpx.AsyncClient,
        client_id: str,
        token_provider: AccessTokenProvider,
        request_timeout_seconds: float = 5.0,
        retry_delay_seconds: float = 0.2,
        max_retry_delay_seconds: float = 2.0,
        retry_deadline_seconds: float = 10.0,
        jitter: Callable[[float], float] = lambda delay: uniform(0, delay),
        sleeper: Callable[[float], Awaitable[None]] = asyncio.sleep,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self._client = client
        self._client_id = client_id
        self._token_provider = token_provider
        self._request_timeout_seconds = request_timeout_seconds
        self._retry_delay_seconds = retry_delay_seconds
        self._max_retry_delay_seconds = max_retry_delay_seconds
        self._retry_deadline_seconds = retry_deadline_seconds
        self._jitter = jitter
        self._sleeper = sleeper
        self._clock = clock

    async def query(self, endpoint: str, query: str) -> list[dict[str, object]]:
        """Execute an APICalypse query against one IGDB endpoint."""
        payload = await self._request(endpoint, query)
        if not isinstance(payload, list) or any(
            not isinstance(record, dict) for record in payload
        ):
            raise IgdbTransportError(IgdbErrorReason.INVALID_RESPONSE)
        return cast(list[dict[str, object]], payload)

    async def count(self, endpoint: str, query: str) -> int:
        """Execute an IGDB count query and validate its object response."""
        payload = await self._request(f"{endpoint}/count", query)
        if not isinstance(payload, dict):
            raise IgdbTransportError(IgdbErrorReason.INVALID_RESPONSE)
        count = payload.get("count")
        if not isinstance(count, int) or isinstance(count, bool) or count < 0:
            raise IgdbTransportError(IgdbErrorReason.INVALID_RESPONSE)
        return count

    async def _request(self, endpoint: str, query: str) -> object:
        """Execute one authenticated request with bounded retries."""
        access_token = await self._token_provider.get_access_token()
        started_at = self._clock()
        last_reason: IgdbErrorReason | None = None
        for attempt in range(2):
            remaining = self._retry_deadline_seconds - (self._clock() - started_at)
            if remaining <= 0:
                raise IgdbTransportError(last_reason or IgdbErrorReason.UNAVAILABLE)
            try:
                response = await self._client.post(
                    f"{IGDB_API_BASE_URL}/{endpoint}",
                    content=query,
                    headers={
                        "Accept": "application/json",
                        "Authorization": f"Bearer {access_token}",
                        "Client-ID": self._client_id,
                    },
                    timeout=min(self._request_timeout_seconds, remaining),
                )
                if response.status_code == 429:
                    retry_after = self._bounded_retry_after(response)
                    if attempt == 1 or not self._has_retry_budget(
                        started_at,
                        retry_after,
                    ):
                        raise IgdbTransportError(
                            IgdbErrorReason.RATE_LIMITED,
                            retry_after_seconds=ceil(retry_after),
                        )
                    last_reason = IgdbErrorReason.RATE_LIMITED
                    await self._sleeper(retry_after)
                    continue
                if response.status_code >= 500:
                    retry_delay = self._jitter(self._retry_delay_seconds)
                    if attempt == 1 or not self._has_retry_budget(
                        started_at,
                        retry_delay,
                    ):
                        raise IgdbTransportError(IgdbErrorReason.UNAVAILABLE)
                    last_reason = IgdbErrorReason.UNAVAILABLE
                    await self._sleeper(retry_delay)
                    continue
                if response.status_code in {401, 403}:
                    raise IgdbTransportError(IgdbErrorReason.AUTHENTICATION_REJECTED)
                if 400 <= response.status_code < 500:
                    raise IgdbTransportError(IgdbErrorReason.INVALID_REQUEST)
                try:
                    payload: object = response.json()
                except ValueError:
                    raise IgdbTransportError(IgdbErrorReason.INVALID_RESPONSE) from None
                return payload
            except httpx.TimeoutException:
                retry_delay = self._jitter(self._retry_delay_seconds)
                if attempt == 1 or not self._has_retry_budget(
                    started_at,
                    retry_delay,
                ):
                    raise IgdbTransportError(IgdbErrorReason.TIMEOUT) from None
                last_reason = IgdbErrorReason.TIMEOUT
                await self._sleeper(retry_delay)
            except httpx.RequestError:
                retry_delay = self._jitter(self._retry_delay_seconds)
                if attempt == 1 or not self._has_retry_budget(
                    started_at,
                    retry_delay,
                ):
                    raise IgdbTransportError(IgdbErrorReason.UNAVAILABLE) from None
                last_reason = IgdbErrorReason.UNAVAILABLE
                await self._sleeper(retry_delay)

        raise AssertionError("unreachable")

    def _bounded_retry_after(self, response: httpx.Response) -> float:
        try:
            retry_after = float(response.headers["Retry-After"])
        except KeyError, ValueError:
            retry_after = self._jitter(self._retry_delay_seconds)
        return max(0, min(retry_after, self._max_retry_delay_seconds))

    def _has_retry_budget(self, started_at: float, delay: float) -> bool:
        return self._clock() + delay < started_at + self._retry_deadline_seconds

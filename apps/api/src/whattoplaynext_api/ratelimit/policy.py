"""The request budgets one visitor draws on while a request runs."""

from contextvars import ContextVar
from dataclasses import dataclass

from whattoplaynext_api.core.errors import ApplicationError, ErrorCode
from whattoplaynext_api.ratelimit.identity import IdentityDigester
from whattoplaynext_api.ratelimit.limiter import SlidingWindowLimiter

_current_client: ContextVar[str | None] = ContextVar("current_client", default=None)


@dataclass(frozen=True)
class RateLimiting:
    """Everything the HTTP edge needs to charge a request to a visitor."""

    public: SlidingWindowLimiter
    provider: SlidingWindowLimiter
    digester: IdentityDigester
    edge_token: str | None
    trusted_proxy_hops: int


async def charge_public_request(limits: RateLimiting, address: str) -> None:
    """Count one catalog request against the visitor's public ceiling.

    Also remembers the visitor for the rest of the request, so a cache miss
    can later be charged to the same budget holder.
    """
    identity = limits.digester.digest(address)
    _current_client.set(identity)
    decision = await limits.public.acquire(identity)
    if not decision.allowed:
        raise ApplicationError(
            ErrorCode.RATE_LIMITED,
            retry_after_seconds=decision.retry_after_seconds,
        )


class ProviderAdmission:
    """Charge a cache miss that would reach the provider to its visitor."""

    def __init__(self, limiter: SlidingWindowLimiter) -> None:
        self._limiter = limiter

    async def __call__(self) -> None:
        identity = _current_client.get()
        if identity is None:
            return
        decision = await self._limiter.acquire(identity)
        if not decision.allowed:
            raise ApplicationError(
                ErrorCode.RATE_LIMITED,
                retry_after_seconds=decision.retry_after_seconds,
            )

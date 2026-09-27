"""Per-visitor rate limiting at the public HTTP edge."""

from fastapi import Request

from whattoplaynext_api.ratelimit.identity import client_address
from whattoplaynext_api.ratelimit.policy import RateLimiting, charge_public_request


async def enforce_rate_limit(request: Request) -> None:
    """Reject a catalog request once its visitor exceeds the public ceiling."""
    limits: RateLimiting | None = request.app.state.rate_limiting
    if limits is None:
        return
    address = client_address(
        request.headers,
        request.client.host if request.client else None,
        edge_token=limits.edge_token,
        trusted_proxy_hops=limits.trusted_proxy_hops,
    )
    if address is not None:
        await charge_public_request(limits, address)

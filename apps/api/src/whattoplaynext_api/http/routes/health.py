"""Process health HTTP adapter."""

from typing import Literal, cast

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from whattoplaynext_api.cache.cache import CacheHealth
from whattoplaynext_api.core.errors import ErrorCode
from whattoplaynext_api.http.correlation import REQUEST_ID_HEADER
from whattoplaynext_api.http.errors import (
    REQUEST_ID_RESPONSE_HEADER,
    documented_error_responses,
)


class HealthResponse(BaseModel):
    """Stable public response for process-health checks."""

    status: Literal["ok"] = "ok"


router = APIRouter(tags=["system"])


@router.get(
    "/health",
    operation_id="getHealth",
    responses={
        200: {
            "headers": {REQUEST_ID_HEADER: REQUEST_ID_RESPONSE_HEADER},
        },
        **documented_error_responses(
            ErrorCode.METHOD_NOT_ALLOWED,
            ErrorCode.INTERNAL_ERROR,
        ),
    },
    response_model=HealthResponse,
    summary="Check process health",
)
async def get_health() -> HealthResponse:
    """Report liveness without synchronously calling IGDB or Redis."""
    return HealthResponse()


ProviderState = Literal["closed", "half-open", "open", "not-configured"]


class ReadinessResponse(BaseModel):
    """Dependency state for monitoring, without hosts, ports, or error text."""

    status: Literal["ready", "degraded", "unavailable"]
    cache: Literal["up", "down", "disabled"]
    provider: ProviderState


@router.get(
    "/health/ready",
    operation_id="getReadiness",
    responses={
        200: {"headers": {REQUEST_ID_HEADER: REQUEST_ID_RESPONSE_HEADER}},
        503: {
            "description": "No catalog provider is configured.",
            "headers": {REQUEST_ID_HEADER: REQUEST_ID_RESPONSE_HEADER},
            "model": ReadinessResponse,
        },
        **documented_error_responses(
            ErrorCode.METHOD_NOT_ALLOWED,
            ErrorCode.INTERNAL_ERROR,
        ),
    },
    response_model=ReadinessResponse,
    summary="Report dependency readiness",
)
async def get_readiness(request: Request, response: Response) -> ReadinessResponse:
    """Report cache and provider-circuit state without calling IGDB.

    At most one Redis ``PING``. Degraded dependencies still answer ``200``:
    the API keeps serving through them, and restarting it would not help.
    """
    cache = CacheHealth(await request.app.state.cache.health())
    circuit = request.app.state.provider_circuit
    provider = cast(
        ProviderState,
        circuit.state.value if circuit is not None else "not-configured",
    )
    if circuit is None:
        status: Literal["ready", "degraded", "unavailable"] = "unavailable"
        response.status_code = 503
    elif cache is CacheHealth.UP and provider == "closed":
        status = "ready"
    else:
        status = "degraded"
    return ReadinessResponse(status=status, cache=cache.value, provider=provider)

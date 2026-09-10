"""Process health HTTP adapter."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

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

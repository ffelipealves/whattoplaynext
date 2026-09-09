"""Process health HTTP adapter."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Stable public response for process-health checks."""

    status: Literal["ok"] = "ok"


router = APIRouter(tags=["system"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check process health",
)
async def get_health() -> HealthResponse:
    """Report liveness without synchronously calling IGDB or Redis."""
    return HealthResponse()

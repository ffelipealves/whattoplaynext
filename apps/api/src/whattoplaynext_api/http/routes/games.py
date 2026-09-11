"""Public HTTP adapter for game browsing."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from whattoplaynext_api.catalog.models import BrowseCriteria, GamePage
from whattoplaynext_api.catalog.ports import Catalog
from whattoplaynext_api.core.errors import ErrorCode
from whattoplaynext_api.http.correlation import REQUEST_ID_HEADER
from whattoplaynext_api.http.errors import (
    REQUEST_ID_RESPONSE_HEADER,
    documented_error_responses,
)
from whattoplaynext_api.http.routes.filters import get_catalog

router = APIRouter(tags=["catalog"])


class BrowseParameters(BaseModel):
    """Only the pagination input implemented by the M1.5 browse slice."""

    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=1, ge=1, le=100)


@router.get(
    "/games",
    operation_id="browseGames",
    responses={
        200: {"headers": {REQUEST_ID_HEADER: REQUEST_ID_RESPONSE_HEADER}},
        **documented_error_responses(
            ErrorCode.UPSTREAM_INVALID_RESPONSE,
            ErrorCode.UPSTREAM_TIMEOUT,
            ErrorCode.UPSTREAM_UNAVAILABLE,
            ErrorCode.RATE_LIMITED,
            ErrorCode.VALIDATION_ERROR,
            ErrorCode.METHOD_NOT_ALLOWED,
            ErrorCode.INTERNAL_ERROR,
        ),
    },
    response_model=GamePage,
    summary="Browse games",
)
async def browse_games(
    request: Request,
    catalog: Annotated[Catalog, Depends(get_catalog)],
    parameters: Annotated[BrowseParameters, Query()],
) -> GamePage:
    """Return one unfiltered page ordered by current popularity."""
    result = await catalog.browse_games(BrowseCriteria(page=parameters.page))
    return result.model_copy(
        update={
            "meta": result.meta.model_copy(
                update={"request_id": request.state.request_id}
            )
        }
    )

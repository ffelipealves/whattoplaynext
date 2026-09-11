"""Public filter-metadata HTTP adapter."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request

from whattoplaynext_api.catalog.models import FilterMetadata
from whattoplaynext_api.catalog.ports import Catalog
from whattoplaynext_api.core.errors import ErrorCode
from whattoplaynext_api.http.correlation import REQUEST_ID_HEADER
from whattoplaynext_api.http.errors import (
    REQUEST_ID_RESPONSE_HEADER,
    documented_error_responses,
)

router = APIRouter(tags=["catalog"])


def get_catalog(request: Request) -> Catalog:
    """Resolve the application catalog selected by the composition root."""
    return cast(Catalog, request.app.state.catalog)


@router.get(
    "/filters",
    operation_id="getFilters",
    responses={
        200: {"headers": {REQUEST_ID_HEADER: REQUEST_ID_RESPONSE_HEADER}},
        **documented_error_responses(
            ErrorCode.UPSTREAM_INVALID_RESPONSE,
            ErrorCode.UPSTREAM_TIMEOUT,
            ErrorCode.UPSTREAM_UNAVAILABLE,
            ErrorCode.RATE_LIMITED,
            ErrorCode.METHOD_NOT_ALLOWED,
            ErrorCode.INTERNAL_ERROR,
        ),
    },
    response_model=FilterMetadata,
    summary="Get catalog filter metadata",
)
async def get_filters(
    catalog: Annotated[Catalog, Depends(get_catalog)],
) -> FilterMetadata:
    """Return stable filter options from the configured catalog."""
    return await catalog.get_filter_metadata()

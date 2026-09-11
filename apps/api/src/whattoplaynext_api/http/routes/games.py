"""Public HTTP adapter for game browsing."""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from whattoplaynext_api.catalog.models import (
    BrowseCriteria,
    GameModeId,
    GamePage,
    GenreId,
    PlatformId,
    SortDirection,
    SortOption,
)
from whattoplaynext_api.catalog.ports import Catalog
from whattoplaynext_api.core.errors import ErrorCode
from whattoplaynext_api.http.correlation import REQUEST_ID_HEADER
from whattoplaynext_api.http.errors import (
    REQUEST_ID_RESPONSE_HEADER,
    documented_error_responses,
)
from whattoplaynext_api.http.routes.filters import get_catalog

router = APIRouter(tags=["catalog"])

ImplementedSortOption = Literal[
    SortOption.POPULARITY,
    SortOption.RATING,
    SortOption.RELEASE_DATE,
    SortOption.TITLE,
]


class BrowseParameters(BaseModel):
    """Strict HTTP query parameters implemented by the M1.6 search slice."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=100)
    platform: list[PlatformId] = Field(default_factory=list)
    genre: list[GenreId] = Field(default_factory=list)
    release_from: date | None = Field(default=None, alias="releaseFrom")
    release_to: date | None = Field(default=None, alias="releaseTo")
    minimum_rating: float | None = Field(
        default=None,
        ge=0,
        le=100,
        alias="minimumRating",
    )
    game_mode: list[GameModeId] = Field(default_factory=list, alias="gameMode")
    sort: ImplementedSortOption = SortOption.POPULARITY
    direction: SortDirection | None = None
    page: int = Field(default=1, ge=1, le=100)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        """Trim a submitted name before applying its public length bound."""
        return BrowseCriteria.normalize_name(value)

    @model_validator(mode="after")
    def validate_release_range(self) -> BrowseParameters:
        """Reject an inverted release interval at the HTTP boundary."""
        if (
            self.release_from is not None
            and self.release_to is not None
            and self.release_from > self.release_to
        ):
            raise ValueError("releaseFrom must not be after releaseTo")
        return self


def _default_direction(sort: SortOption) -> SortDirection:
    return (
        SortDirection.ASCENDING
        if sort in {SortOption.TITLE, SortOption.DURATION}
        else SortDirection.DESCENDING
    )


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
    """Return one strict, normalized page of catalog results."""
    criteria = BrowseCriteria(
        name=parameters.name,
        platform_ids=tuple(parameters.platform),
        genre_ids=tuple(parameters.genre),
        release_from=parameters.release_from,
        release_to=parameters.release_to,
        minimum_rating=parameters.minimum_rating,
        game_mode_ids=tuple(parameters.game_mode),
        sort=parameters.sort,
        direction=parameters.direction or _default_direction(parameters.sort),
        page=parameters.page,
    )
    result = await catalog.browse_games(criteria)
    return result.model_copy(
        update={
            "meta": result.meta.model_copy(
                update={"request_id": request.state.request_id}
            )
        }
    )

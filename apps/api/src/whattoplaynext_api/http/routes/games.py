"""Public HTTP adapter for game browsing."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    WithJsonSchema,
    field_validator,
    model_validator,
)

from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    AutocompleteResult,
    BrowseCriteria,
    DurationKind,
    GameDetail,
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

DurationHours = Annotated[
    Decimal,
    WithJsonSchema({"type": "number", "minimum": 1, "maximum": 1000}),
]


class BrowseParameters(BaseModel):
    """Strict HTTP query parameters implemented through the M1.7 search slice."""

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
    duration_kind: DurationKind = Field(
        default=DurationKind.NORMAL,
        alias="durationKind",
    )
    minimum_duration_hours: DurationHours | None = Field(
        default=None,
        ge=1,
        le=1000,
        alias="minimumDurationHours",
    )
    maximum_duration_hours: DurationHours | None = Field(
        default=None,
        ge=1,
        le=1000,
        alias="maximumDurationHours",
    )
    sort: SortOption = SortOption.POPULARITY
    direction: SortDirection | None = None
    page: int = Field(default=1, ge=1, le=100)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        """Trim a submitted name before applying its public length bound."""
        return BrowseCriteria.normalize_name(value)

    @model_validator(mode="after")
    def validate_release_range(self) -> BrowseParameters:
        """Reject inconsistent release and duration inputs at the HTTP boundary."""
        if (
            self.release_from is not None
            and self.release_to is not None
            and self.release_from > self.release_to
        ):
            raise ValueError("releaseFrom must not be after releaseTo")
        if (
            self.minimum_duration_hours is not None
            and self.maximum_duration_hours is not None
            and self.minimum_duration_hours > self.maximum_duration_hours
        ):
            raise ValueError(
                "minimumDurationHours must not exceed maximumDurationHours"
            )
        for duration in (
            self.minimum_duration_hours,
            self.maximum_duration_hours,
        ):
            if duration is not None:
                seconds = duration * 3600
                if seconds != seconds.to_integral_value():
                    raise ValueError("duration bounds must resolve to whole seconds")
        return self


class AutocompleteParameters(BaseModel):
    """Strict HTTP query parameters for title autocomplete."""

    model_config = ConfigDict(extra="forbid")

    query: str = Field(alias="q", min_length=2, max_length=100)
    platform: list[PlatformId] = Field(default_factory=list)

    @field_validator("query", mode="before")
    @classmethod
    def normalize_query(cls, value: object) -> object:
        """Trim a submitted query before applying its public length bounds."""
        return AutocompleteCriteria.normalize_query(value)


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
        duration_kind=parameters.duration_kind,
        minimum_duration_seconds=(
            int(parameters.minimum_duration_hours * 3600)
            if parameters.minimum_duration_hours is not None
            else None
        ),
        maximum_duration_seconds=(
            int(parameters.maximum_duration_hours * 3600)
            if parameters.maximum_duration_hours is not None
            else None
        ),
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


@router.get(
    "/games/autocomplete",
    operation_id="autocompleteGames",
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
    response_model=AutocompleteResult,
    summary="Autocomplete game titles",
)
async def autocomplete_games(
    request: Request,
    catalog: Annotated[Catalog, Depends(get_catalog)],
    parameters: Annotated[AutocompleteParameters, Query()],
) -> AutocompleteResult:
    """Return at most eight normalized title suggestions."""
    # Keep this route ahead of any future /games/{gameId} route so the
    # literal "autocomplete" segment is never captured as a path parameter.
    criteria = AutocompleteCriteria(
        query=parameters.query,
        platform_ids=tuple(parameters.platform),
    )
    result = await catalog.autocomplete(criteria)
    return result.model_copy(
        update={
            "meta": result.meta.model_copy(
                update={"request_id": request.state.request_id}
            )
        }
    )


@router.get(
    "/games/{gameId}",
    operation_id="getGameDetail",
    responses={
        200: {"headers": {REQUEST_ID_HEADER: REQUEST_ID_RESPONSE_HEADER}},
        **documented_error_responses(
            ErrorCode.GAME_NOT_FOUND,
            ErrorCode.UPSTREAM_INVALID_RESPONSE,
            ErrorCode.UPSTREAM_TIMEOUT,
            ErrorCode.UPSTREAM_UNAVAILABLE,
            ErrorCode.RATE_LIMITED,
            ErrorCode.VALIDATION_ERROR,
            ErrorCode.METHOD_NOT_ALLOWED,
            ErrorCode.INTERNAL_ERROR,
        ),
    },
    response_model=GameDetail,
    summary="Get game detail",
)
async def get_game_detail(
    request: Request,
    catalog: Annotated[Catalog, Depends(get_catalog)],
    game_id: Annotated[int, Path(alias="gameId", gt=0)],
) -> GameDetail:
    """Return complete normalized detail for one eligible game."""
    result = await catalog.get_game_detail(game_id)
    return result.model_copy(
        update={
            "meta": result.meta.model_copy(
                update={"request_id": request.state.request_id}
            )
        }
    )

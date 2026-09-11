"""Provider-neutral catalog models owned by the application."""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class CatalogOption(BaseModel):
    """Stable identifier and English source label for one filter option."""

    id: str
    label: str


class DurationKind(StrEnum):
    """Supported campaign-duration measures."""

    FAST = "fast"
    NORMAL = "normal"
    COMPLETIONIST = "completionist"


class SortOption(StrEnum):
    """Supported catalog sort fields."""

    POPULARITY = "popularity"
    RATING = "rating"
    RELEASE_DATE = "release-date"
    DURATION = "duration"
    TITLE = "title"


class FilterLimits(BaseModel):
    """Public bounds shared by filter controls and query validation."""

    page_size: int = Field(serialization_alias="pageSize")
    maximum_page: int = Field(serialization_alias="maximumPage")
    minimum_autocomplete_length: int = Field(
        serialization_alias="minimumAutocompleteLength",
    )
    maximum_name_length: int = Field(
        serialization_alias="maximumNameLength",
    )
    minimum_duration_hours: int = Field(
        serialization_alias="minimumDurationHours",
    )
    maximum_duration_hours: int = Field(
        serialization_alias="maximumDurationHours",
    )


class FilterMetadata(BaseModel):
    """All allow-listed values needed to construct the search form."""

    platforms: list[CatalogOption]
    genres: list[CatalogOption]
    game_modes: list[CatalogOption] = Field(serialization_alias="gameModes")
    duration_kinds: list[DurationKind] = Field(serialization_alias="durationKinds")
    sort_options: list[SortOption] = Field(serialization_alias="sortOptions")
    limits: FilterLimits


class SortDirection(StrEnum):
    """Provider-neutral ordering direction."""

    ASCENDING = "asc"
    DESCENDING = "desc"


class ServedFrom(StrEnum):
    """Origin of the data returned to the caller."""

    PROVIDER = "provider"


class BrowseCriteria(BaseModel):
    """Criteria currently supported by the unfiltered browse slice."""

    page: int = Field(default=1, ge=1, le=100)
    page_size: Literal[24] = 24
    sort: Literal[SortOption.POPULARITY] = SortOption.POPULARITY
    direction: Literal[SortDirection.DESCENDING] = SortDirection.DESCENDING


class GameCover(BaseModel):
    """Normalized game cover image."""

    url: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class GameRating(BaseModel):
    """Normalized rating and the number of contributing scores."""

    value: float = Field(ge=0, le=100)
    count: int = Field(ge=0)
    source: str


class GameSummary(BaseModel):
    """Provider-neutral game data required by browse results."""

    id: int = Field(gt=0)
    slug: str
    title: str
    release_year: int | None = Field(serialization_alias="releaseYear")
    cover: GameCover | None
    platforms: list[CatalogOption]
    genres: list[CatalogOption]
    rating: GameRating | None
    normal_duration_seconds: int | None = Field(
        serialization_alias="normalDurationSeconds"
    )
    game_modes: list[CatalogOption] = Field(serialization_alias="gameModes")


class Pagination(BaseModel):
    """Page location and total result information."""

    page: int = Field(ge=1)
    page_size: Literal[24] = Field(default=24, serialization_alias="pageSize")
    total_items: int = Field(ge=0, serialization_alias="totalItems")
    total_pages: int = Field(ge=0, serialization_alias="totalPages")


class BrowseQuery(BaseModel):
    """Normalized public criteria echoed with browse results."""

    sort: Literal["popularity"] = "popularity"
    direction: Literal["desc"] = "desc"


class ResponseMeta(BaseModel):
    """Freshness and processing metadata for one catalog response."""

    request_id: str | None = Field(default=None, serialization_alias="requestId")
    served_from: ServedFrom = Field(
        default=ServedFrom.PROVIDER,
        serialization_alias="servedFrom",
    )
    data_may_be_stale: bool = Field(
        default=False,
        serialization_alias="dataMayBeStale",
    )
    excluded_unknown_duration: bool = Field(
        default=False,
        serialization_alias="excludedUnknownDuration",
    )


class GamePage(BaseModel):
    """One normalized page of game summaries."""

    items: list[GameSummary]
    pagination: Pagination
    query: BrowseQuery
    meta: ResponseMeta

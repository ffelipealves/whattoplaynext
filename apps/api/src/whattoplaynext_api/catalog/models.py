"""Provider-neutral catalog models owned by the application."""

from enum import StrEnum

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

"""Provider-neutral catalog models owned by the application."""

from datetime import date
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


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


class PlatformId(StrEnum):
    """Stable public platform identifiers accepted by search."""

    PC = "pc"
    PLAYSTATION_4 = "playstation-4"
    PLAYSTATION_5 = "playstation-5"
    XBOX_ONE = "xbox-one"
    XBOX_SERIES_X_S = "xbox-series-x-s"
    NINTENDO_SWITCH = "nintendo-switch"


class GenreId(StrEnum):
    """Stable public genre identifiers accepted by search."""

    POINT_AND_CLICK = "point-and-click"
    FIGHTING = "fighting"
    SHOOTER = "shooter"
    MUSIC = "music"
    PLATFORM = "platform"
    PUZZLE = "puzzle"
    RACING = "racing"
    REAL_TIME_STRATEGY = "real-time-strategy-rts"
    ROLE_PLAYING = "role-playing-rpg"
    SIMULATOR = "simulator"
    SPORT = "sport"
    STRATEGY = "strategy"
    TURN_BASED_STRATEGY = "turn-based-strategy-tbs"
    TACTICAL = "tactical"
    HACK_AND_SLASH = "hack-and-slash-beat-em-up"
    QUIZ_TRIVIA = "quiz-trivia"
    PINBALL = "pinball"
    ADVENTURE = "adventure"
    INDIE = "indie"
    ARCADE = "arcade"
    VISUAL_NOVEL = "visual-novel"
    CARD_BOARD_GAME = "card-board-game"
    MOBA = "moba"


class GameModeId(StrEnum):
    """Stable public game-mode identifiers accepted by search."""

    SINGLE_PLAYER = "single-player"
    MULTIPLAYER = "multiplayer"
    CO_OPERATIVE = "co-operative"
    SPLIT_SCREEN = "split-screen"
    MASSIVELY_MULTIPLAYER_ONLINE = "massively-multiplayer-online"
    BATTLE_ROYALE = "battle-royale"


class ServedFrom(StrEnum):
    """Origin of the data returned to the caller."""

    PROVIDER = "provider"


class BrowseCriteria(BaseModel):
    """Validated provider-neutral criteria for strict catalog search."""

    name: str | None = Field(default=None, max_length=100)
    platform_ids: tuple[PlatformId, ...] = ()
    genre_ids: tuple[GenreId, ...] = ()
    release_from: date | None = None
    release_to: date | None = None
    minimum_rating: float | None = Field(default=None, ge=0, le=100)
    game_mode_ids: tuple[GameModeId, ...] = ()
    duration_kind: DurationKind = DurationKind.NORMAL
    minimum_duration_seconds: int | None = Field(default=None, ge=3600, le=3600000)
    maximum_duration_seconds: int | None = Field(default=None, ge=3600, le=3600000)
    page: int = Field(default=1, ge=1, le=100)
    page_size: Literal[24] = 24
    sort: SortOption = SortOption.POPULARITY
    direction: SortDirection = SortDirection.DESCENDING

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        """Trim a submitted name and reject an empty criterion."""
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                raise ValueError("name must not be empty")
            return normalized
        return value

    @field_validator("platform_ids", "genre_ids", "game_mode_ids")
    @classmethod
    def remove_duplicate_values(cls, value: tuple[object, ...]) -> tuple[object, ...]:
        """Preserve caller order while removing repeated category values."""
        return tuple(dict.fromkeys(value))

    @model_validator(mode="after")
    def validate_release_range(self) -> BrowseCriteria:
        """Require chronological release and duration bounds."""
        if (
            self.release_from is not None
            and self.release_to is not None
            and self.release_from > self.release_to
        ):
            raise ValueError("releaseFrom must not be after releaseTo")
        if (
            self.minimum_duration_seconds is not None
            and self.maximum_duration_seconds is not None
            and self.minimum_duration_seconds > self.maximum_duration_seconds
        ):
            raise ValueError(
                "minimumDurationHours must not exceed maximumDurationHours"
            )
        return self


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

    sort: SortOption
    direction: SortDirection


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


class AutocompleteCriteria(BaseModel):
    """Validated provider-neutral autocomplete query."""

    query: str = Field(min_length=2, max_length=100)
    platform_ids: tuple[PlatformId, ...] = ()

    @field_validator("query", mode="before")
    @classmethod
    def normalize_query(cls, value: object) -> object:
        """Trim a submitted query before applying its public length bounds."""
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("platform_ids")
    @classmethod
    def remove_duplicate_values(cls, value: tuple[object, ...]) -> tuple[object, ...]:
        """Preserve caller order while removing repeated platform context."""
        return tuple(dict.fromkeys(value))


class AutocompleteSuggestion(BaseModel):
    """One normalized title suggestion."""

    id: int = Field(gt=0)
    slug: str
    title: str
    release_year: int | None = Field(serialization_alias="releaseYear")
    cover: GameCover | None


class AutocompleteResult(BaseModel):
    """At most eight normalized autocomplete suggestions."""

    items: list[AutocompleteSuggestion]
    meta: ResponseMeta

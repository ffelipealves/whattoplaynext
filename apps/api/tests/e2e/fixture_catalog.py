"""A deterministic catalog for end-to-end runs.

Test scaffolding, never packaged: `pyproject.toml` ships `src/` alone. It plays
the same role the fake transports play in the pytest suite — the real HTTP
adapter, the real validation, the real normalization, and no provider — so the
browser journeys assert this application's behavior rather than IGDB's
availability on the day.
"""

from whattoplaynext_api.adapters.igdb.catalog import GAME_MODES, GENRES, PLATFORMS
from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    AutocompleteResult,
    AutocompleteSuggestion,
    BrowseCriteria,
    BrowseQuery,
    CatalogOption,
    DurationKind,
    FilterLimits,
    FilterMetadata,
    GameDetail,
    GamePage,
    GameRating,
    GameSummary,
    Pagination,
    ResponseMeta,
    SortOption,
)
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode

# Searching for this name makes the fixture fail the way a provider outage
# does, so the upstream-failure journey needs no unreachable service.
UPSTREAM_FAILURE_NAME = "trigger-upstream-failure"

# Enough titles to page through, with a handful of recognizable ones the
# journeys can search for by name.
NAMED_GAMES = (
    "Hollow Knight",
    "Hollow Knight: Silksong",
    "Celeste",
    "Hades",
    "Stardew Valley",
)


def _summary(index: int, title: str) -> GameSummary:
    return GameSummary(
        id=1000 + index,
        slug=title.lower().replace(" ", "-").replace(":", ""),
        title=title,
        release_year=2000 + (index % 25),
        cover=None,
        platforms=[
            CatalogOption(
                id=PLATFORMS[index % 2].public_id, label=PLATFORMS[index % 2].label
            )
        ],
        genres=[
            CatalogOption(id=GENRES[index % 3].public_id, label=GENRES[index % 3].label)
        ],
        rating=(
            GameRating(
                value=60 + (index % 40), count=10 + index, source="IGDB combined"
            )
            if index % 4
            else None
        ),
        normal_duration_seconds=3600 * (1 + index % 20) if index % 3 else None,
        game_modes=[
            CatalogOption(
                id=GAME_MODES[index % 2].public_id, label=GAME_MODES[index % 2].label
            )
        ],
    )


ALL_GAMES: tuple[GameSummary, ...] = tuple(
    _summary(index, title)
    for index, title in enumerate(
        [*NAMED_GAMES, *(f"Fixture Game {number:02d}" for number in range(1, 56))]
    )
)


class FixtureCatalog:
    """Answer catalog calls from a fixed in-memory catalog."""

    async def get_filter_metadata(self) -> FilterMetadata:
        """Publish the same allow-lists and bounds the real adapter does."""
        return FilterMetadata(
            platforms=[
                CatalogOption(id=option.public_id, label=option.label)
                for option in PLATFORMS
            ],
            genres=[
                CatalogOption(id=option.public_id, label=option.label)
                for option in GENRES
            ],
            game_modes=[
                CatalogOption(id=option.public_id, label=option.label)
                for option in GAME_MODES
            ],
            duration_kinds=list(DurationKind),
            sort_options=list(SortOption),
            limits=FilterLimits(
                page_size=24,
                maximum_page=100,
                minimum_autocomplete_length=2,
                maximum_name_length=100,
                minimum_duration_hours=1,
                maximum_duration_hours=1000,
            ),
        )

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        """Filter and page the fixed catalog with the criteria as given."""
        if criteria.name == UPSTREAM_FAILURE_NAME:
            raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

        matches = [
            game
            for game in ALL_GAMES
            if _matches_name(game, criteria.name)
            and _matches_platforms(game, criteria)
            and _matches_genres(game, criteria)
        ]
        if criteria.sort is SortOption.TITLE:
            matches.sort(key=lambda game: game.title)

        offset = (criteria.page - 1) * criteria.page_size
        return GamePage(
            items=matches[offset : offset + criteria.page_size],
            pagination=Pagination(
                page=criteria.page,
                page_size=criteria.page_size,
                total_items=len(matches),
                total_pages=-(-len(matches) // criteria.page_size),
            ),
            query=BrowseQuery(sort=criteria.sort, direction=criteria.direction),
            meta=ResponseMeta(
                excluded_unknown_duration=criteria.minimum_duration_seconds is not None
                or criteria.maximum_duration_seconds is not None
            ),
        )

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        """Suggest up to eight titles containing the query."""
        matches = [
            game
            for game in ALL_GAMES
            if criteria.query.casefold() in game.title.casefold()
        ][:8]
        return AutocompleteResult(
            items=[
                AutocompleteSuggestion(
                    id=game.id,
                    slug=game.slug,
                    title=game.title,
                    release_year=game.release_year,
                    cover=None,
                )
                for game in matches
            ],
            meta=ResponseMeta(),
        )

    async def get_game_detail(self, game_id: int) -> GameDetail:
        """Detail pages are a Milestone 3 surface; nothing here serves them."""
        raise ApplicationError(ErrorCode.GAME_NOT_FOUND)


def _matches_name(game: GameSummary, name: str | None) -> bool:
    return name is None or name.casefold() in game.title.casefold()


def _matches_platforms(game: GameSummary, criteria: BrowseCriteria) -> bool:
    if not criteria.platform_ids:
        return True
    selected = {str(value) for value in criteria.platform_ids}
    return any(option.id in selected for option in game.platforms)


def _matches_genres(game: GameSummary, criteria: BrowseCriteria) -> bool:
    if not criteria.genre_ids:
        return True
    selected = {str(value) for value in criteria.genre_ids}
    return any(option.id in selected for option in game.genres)

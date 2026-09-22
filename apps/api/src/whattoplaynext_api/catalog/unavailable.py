"""Safe catalog used until production provider composition is configured."""

from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    AutocompleteResult,
    BrowseCriteria,
    FilterMetadata,
    GameDetail,
    GamePage,
    PopularGameSelection,
)
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode


class UnavailableCatalog:
    """Fail catalog calls explicitly instead of returning invented data."""

    async def get_filter_metadata(self) -> FilterMetadata:
        """Report that no production provider has been composed."""
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        """Report that no production provider has been composed."""
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        """Report that no production provider has been composed."""
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    async def get_popular_games(self) -> PopularGameSelection:
        """Report that no production provider has been composed."""
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    async def get_game_detail(self, game_id: int) -> GameDetail:
        """Report that no production provider has been composed."""
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

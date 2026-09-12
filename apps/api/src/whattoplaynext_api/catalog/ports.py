"""Application-facing catalog interfaces."""

from typing import Protocol

from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    AutocompleteResult,
    BrowseCriteria,
    FilterMetadata,
    GameDetail,
    GamePage,
)


class Catalog(Protocol):
    """Capabilities required from a game catalog provider."""

    async def get_filter_metadata(self) -> FilterMetadata:
        """Return normalized filter options and public bounds."""
        ...

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        """Return one normalized, popularity-ordered page of games."""
        ...

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        """Return at most eight normalized title suggestions."""
        ...

    async def get_game_detail(self, game_id: int) -> GameDetail:
        """Return complete normalized detail for one eligible game."""
        ...

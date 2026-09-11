"""Application-facing catalog interfaces."""

from typing import Protocol

from whattoplaynext_api.catalog.models import FilterMetadata


class Catalog(Protocol):
    """Capabilities required from a game catalog provider."""

    async def get_filter_metadata(self) -> FilterMetadata:
        """Return normalized filter options and public bounds."""
        ...

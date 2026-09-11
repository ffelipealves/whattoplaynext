"""Safe catalog used until production provider composition is configured."""

from whattoplaynext_api.catalog.models import FilterMetadata
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode


class UnavailableCatalog:
    """Fail catalog calls explicitly instead of returning invented data."""

    async def get_filter_metadata(self) -> FilterMetadata:
        """Report that no production provider has been composed."""
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

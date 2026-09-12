"""Opt-in manual smoke test against live IGDB data.

Exercises all four catalog capabilities (filter metadata, browse, autocomplete,
detail) through the same `Catalog` interface used by the HTTP routes, using
locally configured Twitch credentials. Never run in CI or by `pnpm quality`:
it requires network access and `WTPN_TWITCH_CLIENT_ID`/
`WTPN_TWITCH_CLIENT_SECRET` set in `apps/api/.env`. Prints only counts and
titles, never credentials or raw provider payloads.
"""

import asyncio
import sys

from whattoplaynext_api.catalog.models import AutocompleteCriteria, BrowseCriteria
from whattoplaynext_api.core.errors import ApplicationError
from whattoplaynext_api.core.settings import get_settings
from whattoplaynext_api.main import build_catalog

# The Witcher 3: Wild Hunt's real IGDB ID, also used by the sanitized fixtures.
SAMPLE_GAME_ID = 1942


async def main() -> int:
    """Run each catalog capability against live IGDB and report the outcome."""
    settings = get_settings()
    if settings.twitch_client_id is None or settings.twitch_client_secret is None:
        print(
            "WTPN_TWITCH_CLIENT_ID and WTPN_TWITCH_CLIENT_SECRET are not set in "
            "apps/api/.env. Create a Twitch application and configure both "
            "before running this smoke test.",
            file=sys.stderr,
        )
        return 1

    catalog, client = build_catalog(settings)
    assert client is not None, "credentials are present, so a client must exist"
    try:
        print("get_filter_metadata()...")
        metadata = await catalog.get_filter_metadata()
        print(
            f"  ok: {len(metadata.platforms)} platforms, "
            f"{len(metadata.genres)} genres, {len(metadata.game_modes)} game modes"
        )

        print("browse_games() unfiltered page 1...")
        page = await catalog.browse_games(BrowseCriteria())
        print(
            f"  ok: {page.pagination.total_items} total items, "
            f"{len(page.items)} returned"
        )

        print("autocomplete(query='witcher')...")
        suggestions = await catalog.autocomplete(AutocompleteCriteria(query="witcher"))
        print(f"  ok: {len(suggestions.items)} suggestions")

        print(f"get_game_detail({SAMPLE_GAME_ID})...")
        detail = await catalog.get_game_detail(SAMPLE_GAME_ID)
        print(f"  ok: detail for '{detail.title}'")
    except ApplicationError as error:
        print(f"  failed: {error.code.value}", file=sys.stderr)
        return 1
    finally:
        await client.aclose()

    print("All four catalog capabilities returned live IGDB data successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

"""Run the API against the fixture catalog, for browser journeys.

Started by Playwright's `webServer`; never part of the shipped package. It
composes the real application — the same routes, validation, and error
envelope — with a catalog that needs no provider and no credentials.
"""

import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_catalog import FixtureCatalog  # noqa: E402

from whattoplaynext_api.core.settings import Settings  # noqa: E402
from whattoplaynext_api.main import create_app  # noqa: E402

DEFAULT_PORT = 8100


def main() -> int:
    """Serve the fixture-backed application on the requested port."""
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    application = create_app(
        Settings(environment="test"),
        catalog=FixtureCatalog(),
    )
    uvicorn.run(application, host="127.0.0.1", port=port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

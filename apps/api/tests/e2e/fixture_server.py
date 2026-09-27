"""Run the API against the fixture catalog, for browser journeys.

Started by Playwright's `webServer`; never part of the shipped package. It
composes the real application — the same routes, validation, and error
envelope — with a catalog that needs no provider and no credentials.
"""

import sys
from pathlib import Path

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Mount, Route

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_catalog import FixtureCatalog  # noqa: E402

from whattoplaynext_api.core.settings import Settings  # noqa: E402
from whattoplaynext_api.main import create_app  # noqa: E402

DEFAULT_PORT = 8100

# Stands in for Umami's script in browser journeys. It records every call the
# web application makes, resolving page-view builders against realistic
# defaults (the real title and full URL), so a journey can prove the
# application replaced them before anything would leave the browser.
UMAMI_STUB = """
window.__umamiCalls = [];
window.umami = {
  track(eventOrBuilder, data) {
    if (typeof eventOrBuilder === "function") {
      window.__umamiCalls.push(["pageview", eventOrBuilder({
        website: "e2e-website",
        hostname: location.hostname,
        language: navigator.language,
        screen: "1280x720",
        title: document.title,
        url: location.pathname + location.search,
        referrer: document.referrer,
      })]);
    } else {
      window.__umamiCalls.push([eventOrBuilder, data]);
    }
  },
};
"""


async def umami_stub(_request: Request) -> Response:
    return Response(UMAMI_STUB, media_type="text/javascript")


def main() -> int:
    """Serve the fixture-backed application on the requested port."""
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    application = create_app(
        Settings(environment="test"),
        catalog=FixtureCatalog(),
    )
    # Served outside the API's security headers: their same-origin resource
    # policy would stop the web origin from loading a script from this port.
    server = Starlette(
        routes=[
            Route("/e2e/umami-stub.js", umami_stub),
            Mount("/", app=application),
        ]
    )
    uvicorn.run(server, host="127.0.0.1", port=port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

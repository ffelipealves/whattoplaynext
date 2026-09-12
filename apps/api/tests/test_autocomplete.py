"""Public HTTP behavior for title autocomplete."""

import pytest
from httpx2 import ASGITransport, AsyncClient

from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    AutocompleteResult,
    AutocompleteSuggestion,
    BrowseCriteria,
    FilterMetadata,
    GameCover,
    GamePage,
    PlatformId,
    ResponseMeta,
)
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode
from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import create_app


class FakeCatalog:
    def __init__(self) -> None:
        self.criteria: AutocompleteCriteria | None = None

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        self.criteria = criteria
        return AutocompleteResult(
            items=[
                AutocompleteSuggestion(
                    id=1942,
                    slug="the-witcher-3-wild-hunt",
                    title="The Witcher 3: Wild Hunt",
                    release_year=2015,
                    cover=GameCover(
                        url=(
                            "https://images.igdb.com/igdb/image/upload/"
                            "t_cover_big/co1wyy.jpg"
                        ),
                        width=264,
                        height=374,
                    ),
                )
            ],
            meta=ResponseMeta(request_id=None),
        )

    async def get_filter_metadata(self) -> FilterMetadata:
        raise AssertionError("not used by autocomplete route tests")

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        raise AssertionError("not used by autocomplete route tests")


class FailingCatalog:
    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    async def get_filter_metadata(self) -> FilterMetadata:
        raise AssertionError("not used by autocomplete route tests")

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        raise AssertionError("not used by autocomplete route tests")


@pytest.mark.anyio
async def test_returns_normalized_suggestions_for_a_valid_query() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/autocomplete",
            params={"q": "witcher"},
            headers={"X-Request-ID": "autocomplete-default"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": 1942,
                "slug": "the-witcher-3-wild-hunt",
                "title": "The Witcher 3: Wild Hunt",
                "releaseYear": 2015,
                "cover": {
                    "url": (
                        "https://images.igdb.com/igdb/image/upload/"
                        "t_cover_big/co1wyy.jpg"
                    ),
                    "width": 264,
                    "height": 374,
                },
            }
        ],
        "meta": {
            "requestId": "autocomplete-default",
            "servedFrom": "provider",
            "dataMayBeStale": False,
            "excludedUnknownDuration": False,
        },
    }
    assert catalog.criteria == AutocompleteCriteria(query="witcher")
    assert response.headers["x-request-id"] == "autocomplete-default"


@pytest.mark.anyio
async def test_trims_the_query_before_validating_and_forwarding_it() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/autocomplete",
            params={"q": "  witcher  "},
        )

    assert response.status_code == 200
    assert catalog.criteria == AutocompleteCriteria(query="witcher")


@pytest.mark.anyio
async def test_passes_deduplicated_platform_context_in_caller_order() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/autocomplete",
            params=[
                ("q", "witcher"),
                ("platform", "pc"),
                ("platform", "playstation-5"),
                ("platform", "pc"),
            ],
        )

    assert response.status_code == 200
    assert catalog.criteria == AutocompleteCriteria(
        query="witcher",
        platform_ids=(PlatformId.PC, PlatformId.PLAYSTATION_5),
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "query",
    [
        "",
        "a",
        "  a  ",
        "x" * 101,
    ],
)
async def test_rejects_queries_outside_the_public_length_bounds(query: str) -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/autocomplete",
            params={"q": query},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert catalog.criteria is None


@pytest.mark.anyio
async def test_requires_a_query() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/games/autocomplete")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert catalog.criteria is None


@pytest.mark.anyio
@pytest.mark.parametrize(
    "unknown_parameter",
    ["mood=cozy", "page=2", "sort=title"],
)
async def test_rejects_unknown_query_parameters(unknown_parameter: str) -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            f"/api/v1/games/autocomplete?q=witcher&{unknown_parameter}"
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert catalog.criteria is None


@pytest.mark.anyio
async def test_rejects_an_unknown_platform_identifier() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/autocomplete",
            params={"q": "witcher", "platform": "unknown-console"},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert catalog.criteria is None


@pytest.mark.anyio
async def test_keeps_an_upstream_failure_distinct_from_empty_results() -> None:
    application = create_app(
        Settings(environment="test"),
        catalog=FailingCatalog(),
    )
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/autocomplete",
            params={"q": "witcher"},
            headers={"X-Request-ID": "autocomplete-upstream-failure"},
        )

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "UPSTREAM_UNAVAILABLE",
            "message": "Game data is temporarily unavailable.",
            "requestId": "autocomplete-upstream-failure",
        }
    }

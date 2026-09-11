"""Public HTTP behavior for unfiltered game browsing."""

import pytest
from httpx2 import ASGITransport, AsyncClient

from whattoplaynext_api.catalog.models import (
    BrowseCriteria,
    BrowseQuery,
    CatalogOption,
    FilterMetadata,
    GameCover,
    GamePage,
    GameRating,
    GameSummary,
    Pagination,
    ResponseMeta,
    SortDirection,
    SortOption,
)
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode
from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import create_app


class FakeCatalog:
    def __init__(self) -> None:
        self.criteria: BrowseCriteria | None = None

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        self.criteria = criteria
        return GamePage(
            items=[
                GameSummary(
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
                    platforms=[CatalogOption(id="pc", label="PC")],
                    genres=[
                        CatalogOption(
                            id="role-playing-rpg",
                            label="Role-playing (RPG)",
                        )
                    ],
                    rating=GameRating(
                        value=92.3,
                        count=2745,
                        source="IGDB combined",
                    ),
                    normal_duration_seconds=None,
                    game_modes=[
                        CatalogOption(id="single-player", label="Single player")
                    ],
                )
            ],
            pagination=Pagination(
                page=criteria.page,
                page_size=24,
                total_items=49,
                total_pages=3,
            ),
            query=BrowseQuery(),
            meta=ResponseMeta(request_id=None),
        )

    async def get_filter_metadata(self) -> FilterMetadata:
        raise AssertionError("not used by game route tests")


class FailingCatalog:
    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    async def get_filter_metadata(self) -> FilterMetadata:
        raise AssertionError("not used by game route tests")


@pytest.mark.anyio
async def test_browses_a_normalized_default_page() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games",
            headers={"X-Request-ID": "browse-default-page"},
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
                "platforms": [{"id": "pc", "label": "PC"}],
                "genres": [
                    {
                        "id": "role-playing-rpg",
                        "label": "Role-playing (RPG)",
                    }
                ],
                "rating": {
                    "value": 92.3,
                    "count": 2745,
                    "source": "IGDB combined",
                },
                "normalDurationSeconds": None,
                "gameModes": [{"id": "single-player", "label": "Single player"}],
            }
        ],
        "pagination": {
            "page": 1,
            "pageSize": 24,
            "totalItems": 49,
            "totalPages": 3,
        },
        "query": {"sort": "popularity", "direction": "desc"},
        "meta": {
            "requestId": "browse-default-page",
            "servedFrom": "provider",
            "dataMayBeStale": False,
            "excludedUnknownDuration": False,
        },
    }
    assert catalog.criteria == BrowseCriteria()
    assert response.headers["x-request-id"] == "browse-default-page"


@pytest.mark.anyio
async def test_passes_the_requested_page_with_fixed_browse_defaults() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/games?page=2")

    assert response.status_code == 200
    assert catalog.criteria == BrowseCriteria(page=2)
    assert catalog.criteria.page_size == 24
    assert catalog.criteria.sort is SortOption.POPULARITY
    assert catalog.criteria.direction is SortDirection.DESCENDING
    assert response.json()["pagination"]["page"] == 2


@pytest.mark.anyio
@pytest.mark.parametrize("page", [0, 101])
async def test_rejects_pages_outside_the_public_bounds(page: int) -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/games", params={"page": page})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert catalog.criteria is None


@pytest.mark.anyio
async def test_rejects_filter_parameters_reserved_for_milestone_1_6() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/games?name=halo")

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
            "/api/v1/games",
            headers={"X-Request-ID": "browse-upstream-failure"},
        )

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "UPSTREAM_UNAVAILABLE",
            "message": "Game data is temporarily unavailable.",
            "requestId": "browse-upstream-failure",
        }
    }

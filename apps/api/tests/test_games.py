"""Public HTTP behavior for unfiltered game browsing."""

from datetime import date

import pytest
from httpx2 import ASGITransport, AsyncClient

from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    AutocompleteResult,
    BrowseCriteria,
    BrowseQuery,
    CatalogOption,
    DurationKind,
    FilterMetadata,
    GameCover,
    GameDetail,
    GameModeId,
    GamePage,
    GameRating,
    GameSummary,
    GenreId,
    Pagination,
    PlatformId,
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
            query=BrowseQuery(
                sort=criteria.sort,
                direction=criteria.direction,
            ),
            meta=ResponseMeta(request_id=None),
        )

    async def get_filter_metadata(self) -> FilterMetadata:
        raise AssertionError("not used by game route tests")

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        raise AssertionError("not used by game route tests")

    async def get_game_detail(self, game_id: int) -> GameDetail:
        raise AssertionError("not used by game route tests")


class FailingCatalog:
    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    async def get_filter_metadata(self) -> FilterMetadata:
        raise AssertionError("not used by game route tests")

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        raise AssertionError("not used by game route tests")

    async def get_game_detail(self, game_id: int) -> GameDetail:
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
@pytest.mark.parametrize(
    "unknown_parameter",
    [
        "mood=cozy",
        "release_from=2020-01-01",
        "release_to=2020-12-31",
        "minimum_rating=50",
        "game_mode=single-player",
    ],
)
async def test_rejects_unknown_search_parameters(unknown_parameter: str) -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(f"/api/v1/games?{unknown_parameter}")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert catalog.criteria is None


@pytest.mark.anyio
async def test_normalizes_strict_search_criteria() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games",
            params=[
                ("name", "  Hollow Knight  "),
                ("platform", "pc"),
                ("platform", "playstation-5"),
                ("platform", "pc"),
                ("genre", "platform"),
                ("genre", "adventure"),
                ("gameMode", "single-player"),
                ("gameMode", "single-player"),
                ("releaseFrom", "2017-01-01"),
                ("releaseTo", "2018-12-31"),
                ("minimumRating", "80"),
                ("sort", "title"),
                ("page", "2"),
            ],
        )

    assert response.status_code == 200
    assert catalog.criteria == BrowseCriteria(
        name="Hollow Knight",
        platform_ids=(PlatformId.PC, PlatformId.PLAYSTATION_5),
        genre_ids=(GenreId.PLATFORM, GenreId.ADVENTURE),
        game_mode_ids=(GameModeId.SINGLE_PLAYER,),
        release_from=date(2017, 1, 1),
        release_to=date(2018, 12, 31),
        minimum_rating=80,
        sort=SortOption.TITLE,
        direction=SortDirection.ASCENDING,
        page=2,
    )
    assert response.json()["query"] == {"sort": "title", "direction": "asc"}


@pytest.mark.anyio
async def test_normalizes_duration_hours_to_whole_seconds() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games",
            params={
                "durationKind": "normal",
                "minimumDurationHours": "1.5",
                "maximumDurationHours": "20",
                "sort": "duration",
            },
        )

    assert response.status_code == 200
    assert catalog.criteria == BrowseCriteria(
        duration_kind=DurationKind.NORMAL,
        minimum_duration_seconds=5400,
        maximum_duration_seconds=72000,
        sort=SortOption.DURATION,
        direction=SortDirection.ASCENDING,
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "query",
    [
        "name=%20%20%20",
        f"name={'x' * 101}",
        "platform=unknown-console",
        "genre=unknown-genre",
        "gameMode=unknown-mode",
        "releaseFrom=not-a-date",
        "releaseFrom=2020-01-02&releaseTo=2020-01-01",
        "minimumRating=-0.1",
        "minimumRating=100.1",
        "sort=unknown-sort",
        "direction=sideways",
        "durationKind=normal&minimumDurationHours=0.5",
        "durationKind=normal&maximumDurationHours=1000.1",
        "durationKind=normal&minimumDurationHours=2.0001",
        "durationKind=normal&minimumDurationHours=10&maximumDurationHours=9",
        "durationKind=unknown",
    ],
)
async def test_rejects_invalid_or_not_yet_supported_criteria(query: str) -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(f"/api/v1/games?{query}")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert catalog.criteria is None


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("sort", "expected_direction"),
    [
        ("popularity", SortDirection.DESCENDING),
        ("rating", SortDirection.DESCENDING),
        ("release-date", SortDirection.DESCENDING),
        ("title", SortDirection.ASCENDING),
    ],
)
async def test_uses_a_sensible_default_direction_for_each_sort(
    sort: str,
    expected_direction: SortDirection,
) -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games",
            params={"sort": sort, "page": 100},
        )

    assert response.status_code == 200
    assert catalog.criteria is not None
    assert catalog.criteria.direction is expected_direction
    assert catalog.criteria.page == 100


@pytest.mark.anyio
async def test_accepts_a_duration_kind_without_filtering() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/games?durationKind=completionist")

    assert response.status_code == 200
    assert catalog.criteria is not None
    assert catalog.criteria.duration_kind is DurationKind.COMPLETIONIST


@pytest.mark.anyio
async def test_defaults_duration_bounds_and_sorting_to_normal_play() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games?minimumDurationHours=5&sort=duration"
        )

    assert response.status_code == 200
    assert catalog.criteria is not None
    assert catalog.criteria.duration_kind is DurationKind.NORMAL
    assert catalog.criteria.minimum_duration_seconds == 18000
    assert catalog.criteria.direction is SortDirection.ASCENDING


@pytest.mark.anyio
async def test_converts_decimal_duration_hours_exactly_to_seconds() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/games?minimumDurationHours=1.1")

    assert response.status_code == 200
    assert catalog.criteria is not None
    assert catalog.criteria.minimum_duration_seconds == 3960


@pytest.mark.anyio
async def test_preserves_an_explicit_sort_direction() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/games?sort=rating&direction=asc")

    assert response.status_code == 200
    assert catalog.criteria is not None
    assert catalog.criteria.direction is SortDirection.ASCENDING


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

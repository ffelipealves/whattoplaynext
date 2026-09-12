"""Public HTTP behavior for game detail."""

from datetime import date

import pytest
from httpx2 import ASGITransport, AsyncClient

from whattoplaynext_api.catalog.models import (
    AgeRating,
    AutocompleteCriteria,
    AutocompleteResult,
    BrowseCriteria,
    CatalogOption,
    DetailDuration,
    ExternalLink,
    FilterMetadata,
    GameCover,
    GameDetail,
    GameDurations,
    GamePage,
    GameRating,
    MultiplayerInfo,
    PlatformRelease,
    ResponseMeta,
    Theme,
)
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode
from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import create_app


def _sample_detail() -> GameDetail:
    return GameDetail(
        id=1942,
        slug="the-witcher-3-wild-hunt",
        title="The Witcher 3: Wild Hunt",
        alternative_names=["TW3"],
        summary="A story-driven, next-generation open world role-playing game.",
        summary_language="en",
        cover=GameCover(
            url=("https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg"),
            width=264,
            height=374,
        ),
        screenshots=[
            GameCover(
                url=(
                    "https://images.igdb.com/igdb/image/upload/"
                    "t_screenshot_big/sc1abc.jpg"
                ),
                width=889,
                height=500,
            )
        ],
        releases=[
            PlatformRelease(
                platform=CatalogOption(id="pc", label="PC"),
                release_date=date(2015, 5, 19),
            )
        ],
        genres=[CatalogOption(id="role-playing-rpg", label="Role-playing (RPG)")],
        themes=[Theme(id=1, name="Action")],
        platforms=[CatalogOption(id="pc", label="PC")],
        game_modes=[CatalogOption(id="single-player", label="Single player")],
        multiplayer=MultiplayerInfo(
            online_coop=True,
            offline_coop=False,
            split_screen=True,
            max_players=4,
        ),
        user_rating=GameRating(value=88.5, count=5321, source="IGDB user"),
        critic_rating=GameRating(value=92.1, count=45, source="IGDB critic"),
        combined_rating=GameRating(value=92.25, count=2745, source="IGDB combined"),
        durations=GameDurations(
            fast=DetailDuration(seconds=18000, submission_count=1834),
            normal=DetailDuration(seconds=39600, submission_count=1834),
            completionist=DetailDuration(seconds=108000, submission_count=1834),
        ),
        age_ratings=[AgeRating(organization="ESRB", rating="Mature")],
        external_links=[
            ExternalLink(
                label="Official Website",
                url="https://thewitcher.com/en/witcher3",
            )
        ],
        meta=ResponseMeta(request_id=None),
    )


class FakeCatalog:
    def __init__(self) -> None:
        self.requested_game_id: int | None = None

    async def get_game_detail(self, game_id: int) -> GameDetail:
        self.requested_game_id = game_id
        return _sample_detail()

    async def get_filter_metadata(self) -> FilterMetadata:
        raise AssertionError("not used by detail route tests")

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        raise AssertionError("not used by detail route tests")

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        return AutocompleteResult(items=[], meta=ResponseMeta(request_id=None))


class NotFoundCatalog:
    async def get_game_detail(self, game_id: int) -> GameDetail:
        raise ApplicationError(ErrorCode.GAME_NOT_FOUND)

    async def get_filter_metadata(self) -> FilterMetadata:
        raise AssertionError("not used by detail route tests")

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        raise AssertionError("not used by detail route tests")

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        raise AssertionError("not used by detail route tests")


class FailingCatalog:
    async def get_game_detail(self, game_id: int) -> GameDetail:
        raise ApplicationError(ErrorCode.UPSTREAM_UNAVAILABLE)

    async def get_filter_metadata(self) -> FilterMetadata:
        raise AssertionError("not used by detail route tests")

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        raise AssertionError("not used by detail route tests")

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        raise AssertionError("not used by detail route tests")


@pytest.mark.anyio
async def test_returns_normalized_detail_for_a_valid_game_id() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/1942",
            headers={"X-Request-ID": "detail-default"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "id": 1942,
        "slug": "the-witcher-3-wild-hunt",
        "title": "The Witcher 3: Wild Hunt",
        "alternativeNames": ["TW3"],
        "summary": "A story-driven, next-generation open world role-playing game.",
        "summaryLanguage": "en",
        "cover": {
            "url": ("https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg"),
            "width": 264,
            "height": 374,
        },
        "screenshots": [
            {
                "url": (
                    "https://images.igdb.com/igdb/image/upload/"
                    "t_screenshot_big/sc1abc.jpg"
                ),
                "width": 889,
                "height": 500,
            }
        ],
        "releases": [
            {
                "platform": {"id": "pc", "label": "PC"},
                "releaseDate": "2015-05-19",
            }
        ],
        "genres": [{"id": "role-playing-rpg", "label": "Role-playing (RPG)"}],
        "themes": [{"id": 1, "name": "Action"}],
        "platforms": [{"id": "pc", "label": "PC"}],
        "gameModes": [{"id": "single-player", "label": "Single player"}],
        "multiplayer": {
            "onlineCoop": True,
            "offlineCoop": False,
            "splitScreen": True,
            "maxPlayers": 4,
        },
        "userRating": {"value": 88.5, "count": 5321, "source": "IGDB user"},
        "criticRating": {"value": 92.1, "count": 45, "source": "IGDB critic"},
        "combinedRating": {"value": 92.25, "count": 2745, "source": "IGDB combined"},
        "durations": {
            "fast": {"seconds": 18000, "submissionCount": 1834},
            "normal": {"seconds": 39600, "submissionCount": 1834},
            "completionist": {"seconds": 108000, "submissionCount": 1834},
        },
        "ageRatings": [{"organization": "ESRB", "rating": "Mature"}],
        "externalLinks": [
            {
                "label": "Official Website",
                "url": "https://thewitcher.com/en/witcher3",
            }
        ],
        "meta": {
            "requestId": "detail-default",
            "servedFrom": "provider",
            "dataMayBeStale": False,
            "excludedUnknownDuration": False,
        },
    }
    assert catalog.requested_game_id == 1942
    assert response.headers["x-request-id"] == "detail-default"


@pytest.mark.anyio
@pytest.mark.parametrize("game_id", ["0", "-1"])
async def test_rejects_a_non_positive_game_id(game_id: str) -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(f"/api/v1/games/{game_id}")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert catalog.requested_game_id is None


@pytest.mark.anyio
async def test_rejects_a_non_integer_game_id() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/games/not-a-number")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert catalog.requested_game_id is None


@pytest.mark.anyio
async def test_returns_game_not_found_for_an_absent_or_ineligible_game() -> None:
    application = create_app(
        Settings(environment="test"),
        catalog=NotFoundCatalog(),
    )
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/999999",
            headers={"X-Request-ID": "detail-not-found"},
        )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "GAME_NOT_FOUND",
            "message": "Game not found.",
            "requestId": "detail-not-found",
        }
    }


@pytest.mark.anyio
async def test_keeps_an_upstream_failure_distinct_from_not_found() -> None:
    application = create_app(
        Settings(environment="test"),
        catalog=FailingCatalog(),
    )
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/1942",
            headers={"X-Request-ID": "detail-upstream-failure"},
        )

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "UPSTREAM_UNAVAILABLE",
            "message": "Game data is temporarily unavailable.",
            "requestId": "detail-upstream-failure",
        }
    }


@pytest.mark.anyio
async def test_does_not_route_autocomplete_to_the_detail_endpoint() -> None:
    catalog = FakeCatalog()
    application = create_app(Settings(environment="test"), catalog=catalog)
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/games/autocomplete",
            params={"q": "witcher"},
        )

    assert response.status_code == 200
    assert catalog.requested_game_id is None

"""Public HTTP behavior for filter metadata."""

import pytest
from httpx2 import ASGITransport, AsyncClient

from whattoplaynext_api.adapters.igdb.catalog import IgdbCatalog
from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransportError,
)
from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    AutocompleteResult,
    BrowseCriteria,
    CatalogOption,
    DurationKind,
    FilterLimits,
    FilterMetadata,
    GamePage,
    SortOption,
)
from whattoplaynext_api.core.settings import Settings
from whattoplaynext_api.main import create_app


class FakeCatalog:
    async def get_filter_metadata(self) -> FilterMetadata:
        return FilterMetadata(
            platforms=[CatalogOption(id="pc", label="PC")],
            genres=[
                CatalogOption(
                    id="role-playing-rpg",
                    label="Role-playing (RPG)",
                )
            ],
            game_modes=[CatalogOption(id="single-player", label="Single player")],
            duration_kinds=list(DurationKind),
            sort_options=list(SortOption),
            limits=FilterLimits(
                page_size=24,
                maximum_page=100,
                minimum_autocomplete_length=2,
                maximum_name_length=100,
                minimum_duration_hours=1,
                maximum_duration_hours=1000,
            ),
        )

    async def browse_games(self, criteria: BrowseCriteria) -> GamePage:
        raise AssertionError("not used by filter route tests")

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        raise AssertionError("not used by filter route tests")


class FailingTransport:
    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        raise IgdbTransportError(IgdbErrorReason.UNAVAILABLE)

    async def count(self, endpoint: str, query: str) -> int:
        raise AssertionError("not used by filter route tests")


@pytest.mark.anyio
async def test_returns_provider_neutral_filter_metadata() -> None:
    application = create_app(
        Settings(environment="test"),
        catalog=FakeCatalog(),
    )
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/filters")

    assert response.status_code == 200
    assert response.json() == {
        "platforms": [{"id": "pc", "label": "PC"}],
        "genres": [{"id": "role-playing-rpg", "label": "Role-playing (RPG)"}],
        "gameModes": [{"id": "single-player", "label": "Single player"}],
        "durationKinds": ["fast", "normal", "completionist"],
        "sortOptions": [
            "popularity",
            "rating",
            "release-date",
            "duration",
            "title",
        ],
        "limits": {
            "pageSize": 24,
            "maximumPage": 100,
            "minimumAutocompleteLength": 2,
            "maximumNameLength": 100,
            "minimumDurationHours": 1,
            "maximumDurationHours": 1000,
        },
    }
    assert response.headers["x-request-id"]


@pytest.mark.anyio
async def test_keeps_upstream_failure_distinct_from_empty_metadata() -> None:
    application = create_app(
        Settings(environment="test"),
        catalog=IgdbCatalog(FailingTransport()),
    )
    transport = ASGITransport(app=application)

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(
            "/api/v1/filters",
            headers={"X-Request-ID": "filters-upstream-failure"},
        )

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "UPSTREAM_UNAVAILABLE",
            "message": "Game data is temporarily unavailable.",
            "requestId": "filters-upstream-failure",
        }
    }

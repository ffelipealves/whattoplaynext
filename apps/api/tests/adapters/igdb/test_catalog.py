"""Catalog-seam tests for IGDB filter metadata normalization."""

import json
from pathlib import Path
from typing import cast

import httpx
import pytest

from whattoplaynext_api.adapters.igdb.catalog import IgdbCatalog
from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransport,
    IgdbTransportError,
)
from whattoplaynext_api.catalog.models import BrowseCriteria
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode

FIXTURE_DIRECTORY = Path(__file__).parents[2] / "fixtures" / "igdb"


def load_records(name: str) -> list[dict[str, object]]:
    payload = json.loads((FIXTURE_DIRECTORY / name).read_text(encoding="utf-8"))
    return cast(list[dict[str, object]], payload)


class FixtureTransport:
    def __init__(self) -> None:
        self.requests: list[tuple[str, str]] = []
        self.responses = {
            "platforms": load_records("platforms.json"),
            "genres": load_records("genres.json"),
            "game_modes": load_records("game_modes.json"),
        }

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        self.requests.append((endpoint, query))
        return self.responses[endpoint]

    async def count(self, endpoint: str, query: str) -> int:
        raise AssertionError("not used by filter metadata")


class FailingTransport:
    def __init__(self, reason: IgdbErrorReason) -> None:
        self.reason = reason

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        raise IgdbTransportError(self.reason, retry_after_seconds=2)

    async def count(self, endpoint: str, query: str) -> int:
        raise IgdbTransportError(self.reason, retry_after_seconds=2)


class EmptyTransport:
    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        return []

    async def count(self, endpoint: str, query: str) -> int:
        return 0


class BrowseFixtureTransport:
    def __init__(self, games_fixture: str = "games_complete.json") -> None:
        self.requests: list[tuple[str, str]] = []
        self.count_requests: list[tuple[str, str]] = []
        self.responses = {
            "popularity_primitives": load_records("popularity_complete.json"),
            "games": load_records(games_fixture),
        }

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        self.requests.append((endpoint, query))
        return self.responses[endpoint]

    async def count(self, endpoint: str, query: str) -> int:
        self.count_requests.append((endpoint, query))
        return 49


class FakeTokenProvider:
    async def get_access_token(self) -> str:
        return "sanitized-test-token"


@pytest.mark.anyio
async def test_normalizes_allow_listed_filter_metadata_from_provider_records() -> None:
    transport = FixtureTransport()
    catalog = IgdbCatalog(transport)

    metadata = await catalog.get_filter_metadata()

    assert [option.model_dump() for option in metadata.platforms] == [
        {"id": "pc", "label": "PC"},
        {"id": "playstation-4", "label": "PlayStation 4"},
        {"id": "playstation-5", "label": "PlayStation 5"},
        {"id": "xbox-one", "label": "Xbox One"},
        {"id": "xbox-series-x-s", "label": "Xbox Series X|S"},
        {"id": "nintendo-switch", "label": "Nintendo Switch"},
    ]
    assert [option.model_dump() for option in metadata.genres] == [
        {"id": "role-playing-rpg", "label": "Role-playing (RPG)"},
        {"id": "adventure", "label": "Adventure"},
    ]
    assert [option.model_dump() for option in metadata.game_modes] == [
        {"id": "single-player", "label": "Single player"},
        {"id": "multiplayer", "label": "Multiplayer"},
    ]
    assert list(metadata.duration_kinds) == ["fast", "normal", "completionist"]
    assert list(metadata.sort_options) == [
        "popularity",
        "rating",
        "release-date",
        "duration",
        "title",
    ]
    assert metadata.limits.model_dump() == {
        "page_size": 24,
        "maximum_page": 100,
        "minimum_autocomplete_length": 2,
        "maximum_name_length": 100,
        "minimum_duration_hours": 1,
        "maximum_duration_hours": 1000,
    }
    assert [endpoint for endpoint, _query in transport.requests] == [
        "platforms",
        "genres",
        "game_modes",
    ]
    assert all(
        query.startswith("fields id,name;") and "*" not in query
        for _endpoint, query in transport.requests
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("reason", "expected_code"),
    [
        (IgdbErrorReason.AUTHENTICATION_REJECTED, ErrorCode.UPSTREAM_UNAVAILABLE),
        (IgdbErrorReason.INVALID_REQUEST, ErrorCode.UPSTREAM_INVALID_RESPONSE),
        (IgdbErrorReason.INVALID_RESPONSE, ErrorCode.UPSTREAM_INVALID_RESPONSE),
        (IgdbErrorReason.TIMEOUT, ErrorCode.UPSTREAM_TIMEOUT),
        (IgdbErrorReason.RATE_LIMITED, ErrorCode.RATE_LIMITED),
        (IgdbErrorReason.UNAVAILABLE, ErrorCode.UPSTREAM_UNAVAILABLE),
    ],
)
async def test_translates_provider_failures_for_public_adapters(
    reason: IgdbErrorReason,
    expected_code: ErrorCode,
) -> None:
    catalog = IgdbCatalog(FailingTransport(reason))

    with pytest.raises(ApplicationError) as error:
        await catalog.get_filter_metadata()

    assert error.value.code is expected_code
    assert error.value.retry_after_seconds == (
        2 if reason is IgdbErrorReason.RATE_LIMITED else None
    )

    with pytest.raises(ApplicationError) as browse_error:
        await catalog.browse_games(BrowseCriteria())

    assert browse_error.value.code is expected_code
    assert browse_error.value.retry_after_seconds == (
        2 if reason is IgdbErrorReason.RATE_LIMITED else None
    )


@pytest.mark.anyio
async def test_rejects_empty_provider_taxonomies_as_an_invalid_response() -> None:
    catalog = IgdbCatalog(EmptyTransport())

    with pytest.raises(ApplicationError) as error:
        await catalog.get_filter_metadata()

    assert error.value.code is ErrorCode.UPSTREAM_INVALID_RESPONSE


@pytest.mark.anyio
async def test_browses_complete_game_summaries_with_an_explicit_projection() -> None:
    transport = BrowseFixtureTransport()
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(BrowseCriteria())

    assert result.model_dump(mode="json", by_alias=True) == {
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
                "platforms": [
                    {"id": "pc", "label": "PC"},
                    {"id": "playstation-4", "label": "PlayStation 4"},
                ],
                "genres": [
                    {
                        "id": "role-playing-rpg",
                        "label": "Role-playing (RPG)",
                    },
                    {"id": "adventure", "label": "Adventure"},
                ],
                "rating": {
                    "value": 92.25,
                    "count": 2745,
                    "source": "IGDB combined",
                },
                "normalDurationSeconds": None,
                "gameModes": [
                    {"id": "single-player", "label": "Single player"},
                    {"id": "multiplayer", "label": "Multiplayer"},
                ],
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
            "requestId": None,
            "servedFrom": "provider",
            "dataMayBeStale": False,
            "excludedUnknownDuration": False,
        },
    }
    assert transport.count_requests == [
        ("popularity_primitives", "where popularity_type = 1;")
    ]
    assert transport.requests == [
        (
            "popularity_primitives",
            (
                "fields game_id,value; where popularity_type = 1; "
                "sort value desc; limit 24; offset 0;"
            ),
        ),
        (
            "games",
            (
                "fields id,slug,name,first_release_date,cover.image_id,"
                "platforms.id,genres.id,total_rating,total_rating_count,"
                "game_modes.id; where id = (1942); limit 24;"
            ),
        ),
    ]
    assert all("*" not in query for _endpoint, query in transport.requests)


@pytest.mark.anyio
async def test_keeps_missing_optional_game_fields_nullable_or_empty() -> None:
    catalog = IgdbCatalog(BrowseFixtureTransport("games_sparse.json"))

    result = await catalog.browse_games(BrowseCriteria())

    assert result.items[0].model_dump(mode="json", by_alias=True) == {
        "id": 1942,
        "slug": "minimal-game",
        "title": "Minimal Game",
        "releaseYear": None,
        "cover": None,
        "platforms": [],
        "genres": [],
        "rating": None,
        "normalDurationSeconds": None,
        "gameModes": [],
    }


@pytest.mark.anyio
async def test_returns_a_successful_empty_page_from_a_valid_count_object() -> None:
    requests: list[tuple[str, bytes]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append((request.url.path, request.content))
        if request.url.path == "/v4/popularity_primitives/count":
            return httpx.Response(200, json={"count": 0})
        return httpx.Response(200, json=[])

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        catalog = IgdbCatalog(
            IgdbTransport(
                client=client,
                client_id="sanitized-client-id",
                token_provider=FakeTokenProvider(),
            )
        )

        result = await catalog.browse_games(BrowseCriteria())

    assert result.items == []
    assert result.pagination.total_items == 0
    assert result.pagination.total_pages == 0
    assert requests == [
        (
            "/v4/popularity_primitives/count",
            b"where popularity_type = 1;",
        ),
        (
            "/v4/popularity_primitives",
            (
                b"fields game_id,value; where popularity_type = 1; "
                b"sort value desc; limit 24; offset 0;"
            ),
        ),
    ]


@pytest.mark.anyio
async def test_rejects_a_malformed_count_object_as_an_upstream_failure() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": 1})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        catalog = IgdbCatalog(
            IgdbTransport(
                client=client,
                client_id="sanitized-client-id",
                token_provider=FakeTokenProvider(),
            )
        )

        with pytest.raises(ApplicationError) as error:
            await catalog.browse_games(BrowseCriteria())

    assert error.value.code is ErrorCode.UPSTREAM_INVALID_RESPONSE


@pytest.mark.anyio
async def test_classifies_an_out_of_range_release_timestamp() -> None:
    transport = BrowseFixtureTransport()
    transport.responses["games"] = [
        {
            "id": 1942,
            "slug": "invalid-release",
            "name": "Invalid Release",
            "first_release_date": 10**30,
        }
    ]
    catalog = IgdbCatalog(transport)

    with pytest.raises(ApplicationError) as error:
        await catalog.browse_games(BrowseCriteria())

    assert error.value.code is ErrorCode.UPSTREAM_INVALID_RESPONSE


@pytest.mark.anyio
async def test_translates_the_second_page_to_a_24_item_provider_offset() -> None:
    transport = BrowseFixtureTransport()
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(BrowseCriteria(page=2))

    assert result.pagination.model_dump() == {
        "page": 2,
        "page_size": 24,
        "total_items": 49,
        "total_pages": 3,
    }
    assert transport.requests[0] == (
        "popularity_primitives",
        (
            "fields game_id,value; where popularity_type = 1; "
            "sort value desc; limit 24; offset 24;"
        ),
    )

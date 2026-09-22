"""Catalog-seam tests for IGDB filter metadata normalization."""

import json
from datetime import date
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
from whattoplaynext_api.catalog.models import (
    AutocompleteCriteria,
    BrowseCriteria,
    DurationKind,
    GameModeId,
    GenreId,
    PlatformId,
    SortDirection,
    SortOption,
)
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode

FIXTURE_DIRECTORY = Path(__file__).parents[2] / "fixtures" / "igdb"


def load_records(name: str) -> list[dict[str, object]]:
    payload = json.loads((FIXTURE_DIRECTORY / name).read_text(encoding="utf-8"))
    return cast(list[dict[str, object]], payload)


class FixtureTransport:
    def __init__(self) -> None:
        self.requests: list[tuple[str, str]] = []
        self.responses: dict[str, list[dict[str, object]]] = {
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
            "game_time_to_beats": load_records(
                "game_time_to_beats_sparse.json"
                if games_fixture == "games_sparse.json"
                else "game_time_to_beats_complete.json"
            ),
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


class SearchFixtureTransport:
    def __init__(self) -> None:
        self.requests: list[tuple[str, str]] = []
        self.count_requests: list[tuple[str, str]] = []

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        self.requests.append((endpoint, query))
        if endpoint == "game_time_to_beats":
            return []
        return load_records("games_complete.json")

    async def count(self, endpoint: str, query: str) -> int:
        self.count_requests.append((endpoint, query))
        return 49


class QueuedFixtureTransport:
    def __init__(self, responses: list[list[dict[str, object]]], total: int) -> None:
        self.responses = responses
        self.total = total
        self.requests: list[tuple[str, str]] = []
        self.count_requests: list[tuple[str, str]] = []

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        self.requests.append((endpoint, query))
        return self.responses.pop(0)

    async def count(self, endpoint: str, query: str) -> int:
        self.count_requests.append((endpoint, query))
        return self.total


class M17FixtureTransport:
    def __init__(self, counts: dict[str, int] | None = None) -> None:
        self.counts = counts or {}
        self.requests: list[tuple[str, str]] = []
        self.count_requests: list[tuple[str, str]] = []
        self.responses: dict[str, list[dict[str, object]]] = {
            "games": load_records("games_release_candidates.json"),
            "game_time_to_beats": load_records("game_time_to_beats_candidates.json"),
            "popularity_primitives": [
                {"game_id": 101, "value": 0.5},
                {"game_id": 105, "value": 0.9},
            ],
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
        return self.counts.get(endpoint, 5)


class AutocompleteFixtureTransport:
    def __init__(self, records: list[dict[str, object]] | None = None) -> None:
        self.requests: list[tuple[str, str]] = []
        self.count_requests: list[tuple[str, str]] = []
        self.records = (
            records if records is not None else load_records("games_complete.json")
        )

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        self.requests.append((endpoint, query))
        return self.records

    async def count(self, endpoint: str, query: str) -> int:
        raise AssertionError("not used by autocomplete")


class DetailFixtureTransport:
    def __init__(
        self,
        game_fixture: str = "game_detail_complete.json",
        duration_fixture: str = "game_time_to_beats_detail.json",
    ) -> None:
        self.requests: list[tuple[str, str]] = []
        self.responses: dict[str, list[dict[str, object]]] = {
            "games": load_records(game_fixture),
            "game_time_to_beats": load_records(duration_fixture),
        }

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        self.requests.append((endpoint, query))
        return self.responses[endpoint]

    async def count(self, endpoint: str, query: str) -> int:
        raise AssertionError("not used by detail")


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

    with pytest.raises(ApplicationError) as autocomplete_error:
        await catalog.autocomplete(AutocompleteCriteria(query="witcher"))

    assert autocomplete_error.value.code is expected_code
    assert autocomplete_error.value.retry_after_seconds == (
        2 if reason is IgdbErrorReason.RATE_LIMITED else None
    )

    with pytest.raises(ApplicationError) as detail_error:
        await catalog.get_game_detail(1942)

    assert detail_error.value.code is expected_code
    assert detail_error.value.retry_after_seconds == (
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
                "normalDurationSeconds": 144000,
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
    assert transport.count_requests == [("games", "where game_type = (0,8,9);")]
    assert transport.requests == [
        (
            "games",
            ("fields id; where game_type = (0,8,9); sort id asc; limit 500; offset 0;"),
        ),
        (
            "popularity_primitives",
            (
                "fields game_id,value; where popularity_type = 1 & "
                "game_id = (1942); limit 500;"
            ),
        ),
        (
            "games",
            (
                "fields id,slug,name,first_release_date,cover.image_id,"
                "platforms.id,genres.id,total_rating,total_rating_count,"
                "game_modes.id; where game_type = (0,8,9) & id = (1942); "
                "limit 1;"
            ),
        ),
        (
            "game_time_to_beats",
            ("fields game_id,normally; where game_id = (1942); limit 500;"),
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
        if request.url.path == "/v4/games/count":
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
            "/v4/games/count",
            b"where game_type = (0,8,9);",
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
async def test_returns_the_second_popularity_page_from_the_ranked_index() -> None:
    transport = PopularityIndexTransport(
        ranked=[(game_id, 1.0 - game_id / 10_000) for game_id in range(1, 501)],
        matching=list(range(1, 501)),
        total=50_000,
    )
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(BrowseCriteria(page=2))

    assert result.pagination.model_dump() == {
        "page": 2,
        "page_size": 24,
        "total_items": 50_000,
        "total_pages": 2_084,
    }
    assert transport.requests[0] == (
        "popularity_primitives",
        (
            "fields game_id,value; where popularity_type = 1; "
            "sort value desc; limit 500; offset 0;"
        ),
    )
    assert [item.id for item in result.items] == list(range(25, 49))


@pytest.mark.anyio
async def test_translates_strict_and_or_criteria_to_the_games_endpoint() -> None:
    transport = SearchFixtureTransport()
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            name="Hollow Knight",
            platform_ids=(PlatformId.PC, PlatformId.PLAYSTATION_5),
            genre_ids=(GenreId.PLATFORM, GenreId.ADVENTURE),
            minimum_rating=80,
            game_mode_ids=(GameModeId.SINGLE_PLAYER,),
            sort=SortOption.RATING,
            direction=SortDirection.DESCENDING,
            page=2,
        )
    )

    assert result.pagination.model_dump() == {
        "page": 2,
        "page_size": 24,
        "total_items": 49,
        "total_pages": 3,
    }
    assert result.query.model_dump(mode="json") == {
        "sort": "rating",
        "direction": "desc",
    }
    assert transport.count_requests[0][0] == "games"
    count_query = transport.count_requests[0][1]
    expected_filters = {
        "game_type = (0,8,9)",
        'name ~ *"Hollow Knight"*',
        "platforms = (6,167)",
        "genres = (8,31)",
        "total_rating >= 80",
        "game_modes = (1)",
    }
    assert count_query.startswith("where ")
    assert set(count_query.removeprefix("where ").removesuffix(";").split(" & ")) == (
        expected_filters
    )
    assert transport.requests[0][0] == "games"
    result_query = transport.requests[0][1]
    assert all(filter_clause in result_query for filter_clause in expected_filters)
    assert "sort total_rating desc;" in result_query
    assert "limit 24; offset 24;" in result_query


@pytest.mark.anyio
async def test_keeps_strict_filters_when_sorting_by_popularity() -> None:
    transport = PopularityIndexTransport(
        ranked=[(1942, 0.5), (3000, 0.9)],
        matching=[1942, 3000],
    )
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            genre_ids=(GenreId.ADVENTURE,),
            sort=SortOption.POPULARITY,
            direction=SortDirection.DESCENDING,
        )
    )

    assert [game.id for game in result.items] == [3000, 1942]
    assert result.pagination.total_items == 2
    assert transport.count_requests[0][0] == "games"
    assert "genres = (31)" in transport.count_requests[0][1]
    assert all(
        "genres = (31)" in query
        for endpoint, query in transport.requests
        if endpoint == "games" and "fields id;" in query
    )
    assert transport.requests[-2] == (
        "games",
        (
            "fields id,slug,name,first_release_date,cover.image_id,platforms.id,"
            "genres.id,total_rating,total_rating_count,game_modes.id; where "
            "game_type = (0,8,9) & genres = (31) & id = (3000,1942); limit 2;"
        ),
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("sort", "direction", "provider_sort"),
    [
        (SortOption.RATING, SortDirection.ASCENDING, "total_rating asc"),
        (
            SortOption.RELEASE_DATE,
            SortDirection.DESCENDING,
            "first_release_date desc",
        ),
        (SortOption.TITLE, SortDirection.ASCENDING, "name asc"),
    ],
)
async def test_translates_supported_sort_fields_without_changing_direction(
    sort: SortOption,
    direction: SortDirection,
    provider_sort: str,
) -> None:
    transport = SearchFixtureTransport()
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(BrowseCriteria(sort=sort, direction=direction))

    assert f"sort {provider_sort};" in transport.requests[0][1]


@pytest.mark.anyio
async def test_escapes_name_text_inside_the_apicalypse_string_literal() -> None:
    transport = SearchFixtureTransport()
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(
        BrowseCriteria(
            name='He said "hi";\nfields *',
            sort=SortOption.TITLE,
        )
    )

    count_query = transport.count_requests[0][1]
    assert count_query == (
        'where game_type = (0,8,9) & name ~ *"He said \\"hi\\";\\nfields *"*;'
    )
    assert "\n" not in count_query


@pytest.mark.anyio
async def test_sorts_by_the_selected_duration_and_keeps_unknown_values() -> None:
    transport = M17FixtureTransport()
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            duration_kind=DurationKind.NORMAL,
            sort=SortOption.DURATION,
            direction=SortDirection.DESCENDING,
        )
    )

    assert [item.id for item in result.items] == [105, 103, 104, 101, 102]
    assert result.pagination.total_items == 5
    assert result.meta.excluded_unknown_duration is False
    games_query = next(
        query for endpoint, query in transport.requests if endpoint == "games"
    )
    assert "release_dates" not in games_query


@pytest.mark.anyio
async def test_filters_platform_releases_and_durations_before_paging() -> None:
    transport = M17FixtureTransport()
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC, PlatformId.PLAYSTATION_5),
            release_from=date(2020, 1, 1),
            release_to=date(2020, 12, 31),
            duration_kind=DurationKind.NORMAL,
            minimum_duration_seconds=7200,
            maximum_duration_seconds=36000,
        )
    )

    assert [item.id for item in result.items] == [105, 101]
    assert [item.normal_duration_seconds for item in result.items] == [36000, 7200]
    assert result.pagination.total_items == 2
    assert result.pagination.total_pages == 1
    assert result.meta.excluded_unknown_duration is True
    games_query = next(
        query for endpoint, query in transport.requests if endpoint == "games"
    )
    assert "platforms = (6,167)" in games_query
    assert "release_dates.platform,release_dates.date" in games_query
    assert "first_release_date" not in games_query.split("where", 1)[-1]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("kind", "minimum", "maximum", "expected_ids"),
    [
        (DurationKind.FAST, 3600, 3600, [105, 101]),
        (DurationKind.NORMAL, 36000, 36000, [105]),
        (DurationKind.COMPLETIONIST, 18000, 18000, [101]),
    ],
)
async def test_maps_each_duration_kind_for_inclusive_filtering(
    kind: DurationKind,
    minimum: int,
    maximum: int,
    expected_ids: list[int],
) -> None:
    catalog = IgdbCatalog(M17FixtureTransport())

    result = await catalog.browse_games(
        BrowseCriteria(
            duration_kind=kind,
            minimum_duration_seconds=minimum,
            maximum_duration_seconds=maximum,
            sort=SortOption.TITLE,
            direction=SortDirection.ASCENDING,
        )
    )

    assert [item.id for item in result.items] == expected_ids
    assert result.meta.excluded_unknown_duration is True


@pytest.mark.anyio
async def test_uses_first_release_date_bounds_when_no_platform_is_selected() -> None:
    transport = SearchFixtureTransport()
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(
        BrowseCriteria(
            release_from=date(2017, 1, 1),
            release_to=date(2018, 12, 31),
            sort=SortOption.TITLE,
        )
    )

    count_query = transport.count_requests[0][1]
    assert "first_release_date >= 1483228800" in count_query
    assert "first_release_date <= 1546300799" in count_query


@pytest.mark.anyio
async def test_autocompletes_with_a_normalized_relevance_ordered_projection() -> None:
    transport = AutocompleteFixtureTransport()
    catalog = IgdbCatalog(transport)

    result = await catalog.autocomplete(AutocompleteCriteria(query="witcher"))

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
            }
        ],
        "meta": {
            "requestId": None,
            "servedFrom": "provider",
            "dataMayBeStale": False,
            "excludedUnknownDuration": False,
        },
    }
    assert transport.requests == [
        (
            "games",
            (
                'search "witcher"; fields id,slug,name,first_release_date,'
                "cover.image_id; where game_type = (0,8,9); limit 8;"
            ),
        )
    ]


@pytest.mark.anyio
async def test_keeps_missing_optional_autocomplete_fields_nullable() -> None:
    catalog = IgdbCatalog(
        AutocompleteFixtureTransport(load_records("games_sparse.json"))
    )

    result = await catalog.autocomplete(AutocompleteCriteria(query="minimal"))

    assert result.items[0].model_dump(mode="json", by_alias=True) == {
        "id": 1942,
        "slug": "minimal-game",
        "title": "Minimal Game",
        "releaseYear": None,
        "cover": None,
    }


@pytest.mark.anyio
async def test_narrows_autocomplete_results_by_platform_context() -> None:
    transport = AutocompleteFixtureTransport()
    catalog = IgdbCatalog(transport)

    await catalog.autocomplete(
        AutocompleteCriteria(
            query="witcher",
            platform_ids=(PlatformId.PC, PlatformId.PLAYSTATION_5),
        )
    )

    assert transport.requests == [
        (
            "games",
            (
                'search "witcher"; fields id,slug,name,first_release_date,'
                "cover.image_id; where game_type = (0,8,9) & "
                "platforms = (6,167); limit 8;"
            ),
        )
    ]


@pytest.mark.anyio
async def test_returns_at_most_eight_autocomplete_suggestions() -> None:
    records = [
        {"id": game_id, "slug": f"game-{game_id}", "name": f"Game {game_id}"}
        for game_id in range(1, 11)
    ]
    catalog = IgdbCatalog(AutocompleteFixtureTransport(records))

    result = await catalog.autocomplete(AutocompleteCriteria(query="game"))

    assert [item.id for item in result.items] == list(range(1, 9))


@pytest.mark.anyio
async def test_escapes_autocomplete_text_inside_the_apicalypse_string_literal() -> None:
    transport = AutocompleteFixtureTransport([])
    catalog = IgdbCatalog(transport)

    await catalog.autocomplete(AutocompleteCriteria(query='He said "hi";\nfields *'))

    query = transport.requests[0][1]
    assert query.startswith('search "He said \\"hi\\";\\nfields *"; ')
    assert "\n" not in query


@pytest.mark.anyio
async def test_returns_complete_normalized_detail_from_a_full_projection() -> None:
    transport = DetailFixtureTransport()
    catalog = IgdbCatalog(transport)

    result = await catalog.get_game_detail(1942)

    assert result.model_dump(mode="json", by_alias=True) == {
        "id": 1942,
        "slug": "the-witcher-3-wild-hunt",
        "title": "The Witcher 3: Wild Hunt",
        "alternativeNames": ["TW3", "Wiedzmin 3: Dziki Gon"],
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
            },
            {
                "url": (
                    "https://images.igdb.com/igdb/image/upload/"
                    "t_screenshot_big/sc2def.jpg"
                ),
                "width": 889,
                "height": 500,
            },
        ],
        "releases": [
            {
                "platform": {"id": "pc", "label": "PC"},
                "releaseDate": "2015-05-19",
            },
            {
                "platform": {"id": "playstation-4", "label": "PlayStation 4"},
                "releaseDate": "2015-05-19",
            },
            {
                "platform": {"id": "playstation-5", "label": "PlayStation 5"},
                "releaseDate": "2020-12-22",
            },
        ],
        "genres": [
            {"id": "role-playing-rpg", "label": "Role-playing (RPG)"},
            {"id": "adventure", "label": "Adventure"},
        ],
        "themes": [
            {"id": 1, "name": "Action"},
            {"id": 22, "name": "Historical"},
        ],
        "platforms": [
            {"id": "pc", "label": "PC"},
            {"id": "playstation-4", "label": "PlayStation 4"},
            {"id": "playstation-5", "label": "PlayStation 5"},
        ],
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
        "ageRatings": [
            {"organization": "ESRB", "rating": "Mature"},
            {"organization": "PEGI", "rating": "18"},
        ],
        "externalLinks": [
            {
                "label": "Official Website",
                "url": "https://thewitcher.com/en/witcher3",
            },
            {
                "label": "Steam",
                "url": "https://store.steampowered.com/app/292030",
            },
        ],
        "meta": {
            "requestId": None,
            "servedFrom": "provider",
            "dataMayBeStale": False,
            "excludedUnknownDuration": False,
        },
    }
    assert transport.requests[0][0] == "games"
    assert "where id = 1942;" in transport.requests[0][1]
    assert transport.requests[1] == (
        "game_time_to_beats",
        "fields hastily,normally,completely,count; where game_id = 1942; limit 1;",
    )


@pytest.mark.anyio
async def test_keeps_missing_optional_detail_fields_nullable_or_empty() -> None:
    catalog = IgdbCatalog(
        DetailFixtureTransport(
            "game_detail_sparse.json", "game_time_to_beats_detail_sparse.json"
        )
    )

    result = await catalog.get_game_detail(1942)

    assert result.model_dump(mode="json", by_alias=True) == {
        "id": 1942,
        "slug": "minimal-game",
        "title": "Minimal Game",
        "alternativeNames": [],
        "summary": None,
        "summaryLanguage": None,
        "cover": None,
        "screenshots": [],
        "releases": [],
        "genres": [],
        "themes": [],
        "platforms": [],
        "gameModes": [],
        "multiplayer": {
            "onlineCoop": False,
            "offlineCoop": False,
            "splitScreen": False,
            "maxPlayers": None,
        },
        "userRating": None,
        "criticRating": None,
        "combinedRating": None,
        "durations": {"fast": None, "normal": None, "completionist": None},
        "ageRatings": [],
        "externalLinks": [],
        "meta": {
            "requestId": None,
            "servedFrom": "provider",
            "dataMayBeStale": False,
            "excludedUnknownDuration": False,
        },
    }


@pytest.mark.anyio
async def test_rejects_an_absent_game_id_as_not_found() -> None:
    catalog = IgdbCatalog(EmptyTransport())

    with pytest.raises(ApplicationError) as error:
        await catalog.get_game_detail(999999)

    assert error.value.code is ErrorCode.GAME_NOT_FOUND


@pytest.mark.anyio
@pytest.mark.parametrize("game_type", [1, 2, 3, 5, 6, 7, 10, 11, 12, 13, 14])
async def test_rejects_an_ineligible_game_type_as_not_found(
    game_type: int,
) -> None:
    transport = DetailFixtureTransport()
    transport.responses["games"][0]["game_type"] = game_type
    catalog = IgdbCatalog(transport)

    with pytest.raises(ApplicationError) as error:
        await catalog.get_game_detail(1942)

    assert error.value.code is ErrorCode.GAME_NOT_FOUND
    assert [endpoint for endpoint, _query in transport.requests] == ["games"]


@pytest.mark.anyio
@pytest.mark.parametrize("game_type", [0, 8, 9])
async def test_accepts_base_game_remake_and_remaster_game_types(
    game_type: int,
) -> None:
    transport = DetailFixtureTransport()
    transport.responses["games"][0]["game_type"] = game_type
    catalog = IgdbCatalog(transport)

    result = await catalog.get_game_detail(1942)

    assert result.id == 1942


class PopularityIndexTransport:
    """Simulates the popularity index, a game filter, and their intersection.

    Request-order scripts cannot express "stops early", which is the whole
    point of paging the index, so this fake answers from data and counts what
    the adapter actually asked for.
    """

    def __init__(
        self,
        *,
        ranked: list[tuple[int, float]],
        matching: list[int],
        total: int | None = None,
    ) -> None:
        self.ranked = ranked
        self.matching = matching
        self.total = len(matching) if total is None else total
        self.requests: list[tuple[str, str]] = []
        self.count_requests: list[tuple[str, str]] = []

    @staticmethod
    def _ids(query: str, field: str) -> list[int]:
        inside = query.split(f"{field} = (", 1)[1].split(")", 1)[0]
        return [int(value) for value in inside.split(",") if value]

    @staticmethod
    def _window(query: str) -> tuple[int, int]:
        limit = int(query.split("limit ", 1)[1].split(";", 1)[0])
        offset = (
            int(query.split("offset ", 1)[1].split(";", 1)[0])
            if "offset " in query
            else 0
        )
        return limit, offset

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        self.requests.append((endpoint, query))
        if endpoint == "popularity_primitives":
            if "game_id = (" in query:
                wanted = set(self._ids(query, "game_id"))
                return [
                    {"game_id": game_id, "value": value}
                    for game_id, value in self.ranked
                    if game_id in wanted
                ]
            ordered = sorted(
                self.ranked,
                key=lambda entry: entry[1],
                reverse="sort value desc" in query,
            )
            limit, offset = self._window(query)
            return [
                {"game_id": game_id, "value": value}
                for game_id, value in ordered[offset : offset + limit]
            ]
        if endpoint == "games":
            if "id = (" in query:
                candidates = self._ids(query, "id")
                selected = [
                    game_id for game_id in candidates if game_id in self.matching
                ]
            else:
                limit, offset = self._window(query)
                selected = sorted(self.matching)[offset : offset + limit]
            if query.startswith("fields id;"):
                return [{"id": game_id} for game_id in selected]
            return [
                {"id": game_id, "slug": f"game-{game_id}", "name": f"Game {game_id}"}
                for game_id in selected
            ]
        if endpoint == "game_time_to_beats":
            return []
        raise AssertionError(f"unexpected endpoint: {endpoint}")

    async def count(self, endpoint: str, query: str) -> int:
        self.count_requests.append((endpoint, query))
        return self.total

    def endpoints(self) -> list[str]:
        return [endpoint for endpoint, _query in self.requests]


@pytest.mark.anyio
async def test_selects_at_most_500_eligible_popular_games_for_the_sitemap() -> None:
    transport = PopularityIndexTransport(
        ranked=[(game_id, 1.0 - game_id / 10_000) for game_id in range(1, 1_001)],
        matching=list(range(2, 1_001, 2)),
    )
    catalog = IgdbCatalog(transport)

    result = await catalog.get_popular_games()

    assert [game.id for game in result.items] == list(range(2, 1_001, 2))
    assert all(game.slug == f"game-{game.id}" for game in result.items)
    assert transport.count_requests == []
    assert transport.endpoints() == [
        "popularity_primitives",
        "games",
        "popularity_primitives",
        "games",
    ]
    game_queries = [
        query for endpoint, query in transport.requests if endpoint == "games"
    ]
    assert all(query.startswith("fields id,slug;") for query in game_queries)
    assert all("game_type = (0,8,9)" in query for query in game_queries)


@pytest.mark.anyio
async def test_pages_the_popularity_index_instead_of_listing_every_match() -> None:
    # A broad filter matches far more games than one page can show; reading
    # every matching id just to rank it is what made these queries time out.
    transport = PopularityIndexTransport(
        ranked=[(game_id, 1.0 - game_id / 10000) for game_id in range(1, 1001)],
        matching=list(range(1, 900)),
        total=200_000,
    )
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            genre_ids=(GenreId.ADVENTURE,),
            sort=SortOption.POPULARITY,
            direction=SortDirection.DESCENDING,
        )
    )

    assert [game.id for game in result.items] == list(range(1, 25))
    assert result.pagination.total_items == 200_000
    index_query = transport.requests[0][1]
    assert transport.requests[0][0] == "popularity_primitives"
    assert "sort value desc" in index_query
    assert "offset 0;" in index_query
    intersect_query = transport.requests[1][1]
    assert transport.requests[1][0] == "games"
    assert intersect_query.startswith("fields id;")
    assert "genres = (31)" in intersect_query
    assert "id = (" in intersect_query
    # One index page already contains a full result page, so the adapter must
    # not walk any further.
    assert transport.endpoints() == [
        "popularity_primitives",
        "games",
        "games",
        "game_time_to_beats",
    ]


@pytest.mark.anyio
async def test_keeps_walking_the_index_until_the_requested_page_is_full() -> None:
    transport = PopularityIndexTransport(
        ranked=[(game_id, 1.0 - game_id / 10000) for game_id in range(1, 2001)],
        matching=[game_id for game_id in range(1, 2001) if game_id % 50 == 0],
        total=50_000,
    )
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            genre_ids=(GenreId.ADVENTURE,),
            sort=SortOption.POPULARITY,
            page=1,
        )
    )

    # The 24th most popular match sits in the third index page, so the walk
    # reads three and stops rather than draining the index.
    assert [game.id for game in result.items] == list(range(50, 1201, 50))
    assert transport.endpoints().count("popularity_primitives") == 3


@pytest.mark.anyio
async def test_lists_a_small_match_set_without_touching_the_index() -> None:
    # Paging the index cannot beat two requests, and it would be wasted work
    # whenever the few matches turn out to be unranked.
    transport = PopularityIndexTransport(
        ranked=[(game_id, 1.0 - game_id / 10000) for game_id in range(1, 1001)],
        matching=list(range(1, 101)),
    )
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(
        BrowseCriteria(genre_ids=(GenreId.ADVENTURE,), sort=SortOption.POPULARITY)
    )

    index_pages = [
        query
        for endpoint, query in transport.requests
        if endpoint == "popularity_primitives" and "game_id = (" not in query
    ]
    assert index_pages == []


@pytest.mark.anyio
async def test_lists_every_match_when_too_few_are_ranked_to_fill_the_page() -> None:
    # A narrow filter whose matches are mostly unranked: the index cannot fill
    # the page, so the adapter falls back to ordering the full match list and
    # keeps unranked games after ranked ones.
    transport = PopularityIndexTransport(
        ranked=[(30, 0.9)],
        matching=[10, 20, 30],
    )
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            genre_ids=(GenreId.ADVENTURE,),
            sort=SortOption.POPULARITY,
            direction=SortDirection.DESCENDING,
        )
    )

    assert [game.id for game in result.items] == [30, 10, 20]
    assert result.pagination.total_items == 3


@pytest.mark.anyio
async def test_bounds_the_duration_index_before_reading_matching_games() -> None:
    # The duration index is orders of magnitude smaller than the catalog, so
    # bounding it first replaces a full scan of every matching game.
    transport = M17FixtureTransport({"games": 200_000, "game_time_to_beats": 4})
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(
        BrowseCriteria(
            duration_kind=DurationKind.NORMAL,
            minimum_duration_seconds=7200,
            maximum_duration_seconds=36000,
        )
    )

    duration_query = next(
        query
        for endpoint, query in transport.requests
        if endpoint == "game_time_to_beats"
    )
    assert "normally >= 7200" in duration_query
    assert "normally <= 36000" in duration_query
    games_query = next(
        query for endpoint, query in transport.requests if endpoint == "games"
    )
    assert "id = (101,103,104,105)" in games_query
    assert "offset" not in games_query
    assert [endpoint for endpoint, _query in transport.count_requests] == [
        "games",
        "game_time_to_beats",
    ]


@pytest.mark.anyio
async def test_excludes_unrecorded_durations_under_an_upper_bound_only() -> None:
    # IGDB stores "not recorded" as zero, which would otherwise satisfy a
    # maximum-only bound.
    transport = M17FixtureTransport()
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(
        BrowseCriteria(
            duration_kind=DurationKind.COMPLETIONIST,
            maximum_duration_seconds=36000,
        )
    )

    duration_query = next(
        query
        for endpoint, query in transport.requests
        if endpoint == "game_time_to_beats"
    )
    assert "completely > 0" in duration_query
    assert "completely <= 36000" in duration_query


@pytest.mark.anyio
async def test_still_scans_candidates_when_only_sorting_by_duration() -> None:
    # Without a duration bound there is no index to narrow, so the candidate
    # scan remains the only way to order by a value the games endpoint lacks.
    transport = M17FixtureTransport()
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(
        BrowseCriteria(sort=SortOption.DURATION, direction=SortDirection.ASCENDING)
    )

    assert [endpoint for endpoint, _query in transport.count_requests] == ["games"]


@pytest.mark.anyio
async def test_reads_the_matching_games_when_they_outnumber_the_duration_index() -> (
    None
):
    # A narrow filter with a generous duration ceiling inverts the economics:
    # listing the few matches beats walking a duration index that covers most
    # of the catalog.
    transport = M17FixtureTransport({"games": 5, "game_time_to_beats": 9_000})
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(
        BrowseCriteria(
            genre_ids=(GenreId.ADVENTURE,),
            duration_kind=DurationKind.NORMAL,
            maximum_duration_seconds=72_000,
        )
    )

    games_query = next(
        query for endpoint, query in transport.requests if endpoint == "games"
    )
    assert "genres = (31)" in games_query
    assert "offset 0;" in games_query
    assert "id = (" not in games_query


class ReleaseIndexTransport:
    """Simulates the release-date index, the game filter, and their join."""

    def __init__(
        self,
        *,
        releases: list[tuple[int, int]],
        matching: list[int],
        candidate_total: int | None = None,
        release_total: int | None = None,
    ) -> None:
        self.release_total = release_total
        # (game_id, date) rows exactly as the provider stores them: one game
        # can hold several, and a page of results is one row at a time.
        self.releases = releases
        self.matching = matching
        self.candidate_total = (
            len(matching) if candidate_total is None else candidate_total
        )
        self.requests: list[tuple[str, str]] = []
        self.count_requests: list[tuple[str, str]] = []

    @staticmethod
    def _ids(query: str, field: str) -> list[int]:
        inside = query.split(f"{field} = (", 1)[1].split(")", 1)[0]
        return [int(value) for value in inside.split(",") if value]

    @staticmethod
    def _window(query: str) -> tuple[int, int]:
        limit = int(query.split("limit ", 1)[1].split(";", 1)[0])
        offset = (
            int(query.split("offset ", 1)[1].split(";", 1)[0])
            if "offset " in query
            else 0
        )
        return limit, offset

    def _min_date(self, game_id: int) -> int:
        return min(date for game, date in self.releases if game == game_id)

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        self.requests.append((endpoint, query))
        if endpoint == "release_dates":
            rows = sorted(
                self.releases,
                key=lambda row: row[1],
                reverse="sort date desc" in query,
            )
            limit, offset = self._window(query)
            return [
                {"game": game, "date": date}
                for game, date in rows[offset : offset + limit]
            ]
        if endpoint == "games":
            if "id = (" in query:
                selected = [
                    game_id
                    for game_id in self._ids(query, "id")
                    if game_id in self.matching
                ]
            else:
                limit, offset = self._window(query)
                selected = sorted(self.matching)[offset : offset + limit]
            return [
                {
                    "id": game_id,
                    "slug": f"game-{game_id}",
                    "name": f"Game {game_id}",
                    "release_dates": [
                        {"platform": 6, "date": date}
                        for game, date in self.releases
                        if game == game_id
                    ],
                }
                for game_id in selected
            ]
        if endpoint in {"game_time_to_beats", "popularity_primitives"}:
            return []
        raise AssertionError(f"unexpected endpoint: {endpoint}")

    async def count(self, endpoint: str, query: str) -> int:
        self.count_requests.append((endpoint, query))
        if endpoint == "release_dates" and self.release_total is not None:
            return self.release_total
        return self.candidate_total

    def endpoints(self) -> list[str]:
        return [endpoint for endpoint, _query in self.requests]


def _release_transport(**kwargs: object) -> ReleaseIndexTransport:
    return ReleaseIndexTransport(**kwargs)  # type: ignore[arg-type]


@pytest.mark.anyio
async def test_pages_the_release_index_instead_of_reading_every_match() -> None:
    # Sorting by a platform's release date used to read every matching game
    # just to order 24 of them.
    transport = ReleaseIndexTransport(
        releases=[(game_id, 1_000 + game_id) for game_id in range(1, 2001)],
        matching=list(range(1, 2001)),
        candidate_total=200_000,
    )
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC,),
            sort=SortOption.RELEASE_DATE,
            direction=SortDirection.DESCENDING,
        )
    )

    assert [item.id for item in result.items] == list(range(2000, 1976, -1))
    assert result.pagination.total_items == 200_000
    index_query = next(
        query for endpoint, query in transport.requests if endpoint == "release_dates"
    )
    assert "platform = (6)" in index_query
    assert "sort date desc" in index_query
    # One index page already covers the requested page.
    assert transport.endpoints().count("release_dates") == 1


@pytest.mark.anyio
async def test_orders_by_the_earliest_release_on_a_selected_platform() -> None:
    # A game released twice on the platform is placed by its first release,
    # which is also what the release-range filter matches on.
    transport = ReleaseIndexTransport(
        releases=[(1, 500), (1, 9_000), (2, 1_000), (3, 2_000)],
        matching=[1, 2, 3],
        candidate_total=200_000,
    )
    catalog = IgdbCatalog(transport)

    ascending = await catalog.browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC,),
            sort=SortOption.RELEASE_DATE,
            direction=SortDirection.ASCENDING,
        )
    )
    descending = await catalog.browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC,),
            sort=SortOption.RELEASE_DATE,
            direction=SortDirection.DESCENDING,
        )
    )

    assert [item.id for item in ascending.items] == [1, 2, 3]
    # Game 1's latest release is the newest row in the index, but its earliest
    # is the oldest: ordering on the row alone would put it first.
    assert [item.id for item in descending.items] == [3, 2, 1]


@pytest.mark.anyio
async def test_keeps_walking_the_release_index_past_unmatched_games() -> None:
    transport = ReleaseIndexTransport(
        releases=[(game_id, 1_000 + game_id) for game_id in range(1, 2001)],
        matching=[game_id for game_id in range(1, 2001) if game_id % 50 == 0],
        candidate_total=200_000,
    )
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC,),
            genre_ids=(GenreId.ADVENTURE,),
            sort=SortOption.RELEASE_DATE,
            direction=SortDirection.DESCENDING,
        )
    )

    assert [item.id for item in result.items] == list(range(2000, 800, -50))
    assert transport.endpoints().count("release_dates") >= 2


@pytest.mark.anyio
async def test_reads_the_matches_when_they_are_fewer_than_the_release_index() -> None:
    transport = ReleaseIndexTransport(
        releases=[(1, 500), (2, 1_000)],
        matching=[1, 2],
        candidate_total=2,
    )
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC,),
            sort=SortOption.RELEASE_DATE,
        )
    )

    assert "release_dates" not in transport.endpoints()
    games_query = next(
        query for endpoint, query in transport.requests if endpoint == "games"
    )
    assert "offset 0;" in games_query


@pytest.mark.anyio
async def test_bounds_the_release_index_before_reading_matching_games() -> None:
    # A release range on a selected platform narrows the release index far
    # below the match list, so that is the side worth reading.
    transport = ReleaseIndexTransport(
        releases=[(1, 1_577_836_800), (2, 1_600_000_000), (3, 900_000_000)],
        matching=[1, 2, 3],
        candidate_total=200_000,
        release_total=2,
    )
    catalog = IgdbCatalog(transport)

    result = await catalog.browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC,),
            release_from=date(2020, 1, 1),
            release_to=date(2020, 12, 31),
        )
    )

    assert [item.id for item in result.items] == [1, 2]
    assert result.pagination.total_items == 2
    index_query = next(
        query for endpoint, query in transport.requests if endpoint == "release_dates"
    )
    assert "platform = (6)" in index_query
    assert "date >= 1577836800" in index_query
    assert "date <= 1609459199" in index_query
    games_query = next(
        query for endpoint, query in transport.requests if endpoint == "games"
    )
    assert "id = (" in games_query
    assert "offset" not in games_query


@pytest.mark.anyio
async def test_reads_the_matches_when_they_are_fewer_than_the_release_range() -> None:
    transport = ReleaseIndexTransport(
        releases=[(1, 1_577_836_800), (2, 1_600_000_000)],
        matching=[1, 2],
        candidate_total=2,
        release_total=50_000,
    )
    catalog = IgdbCatalog(transport)

    await catalog.browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC,),
            release_from=date(2020, 1, 1),
        )
    )

    games_query = next(
        query for endpoint, query in transport.requests if endpoint == "games"
    )
    assert "offset 0;" in games_query


@pytest.mark.anyio
async def test_applies_content_eligibility_to_every_game_lookup_strategy() -> None:
    plain_sort = SearchFixtureTransport()
    await IgdbCatalog(plain_sort).browse_games(BrowseCriteria(sort=SortOption.RATING))

    popularity_walk = PopularityIndexTransport(
        ranked=[(game_id, 1.0 - game_id / 10_000) for game_id in range(1, 2_501)],
        matching=list(range(1, 2_501)),
        total=250_000,
    )
    await IgdbCatalog(popularity_walk).browse_games(BrowseCriteria(page=100))

    exhaustive_popularity = PopularityIndexTransport(
        ranked=[(30, 0.9)],
        matching=[10, 20, 30],
    )
    await IgdbCatalog(exhaustive_popularity).browse_games(BrowseCriteria())

    duration_index = M17FixtureTransport({"games": 200_000, "game_time_to_beats": 4})
    await IgdbCatalog(duration_index).browse_games(
        BrowseCriteria(
            minimum_duration_seconds=7_200,
            maximum_duration_seconds=36_000,
        )
    )

    release_range = ReleaseIndexTransport(
        releases=[(1, 1_577_836_800), (2, 1_600_000_000)],
        matching=[1, 2],
        candidate_total=200_000,
        release_total=2,
    )
    await IgdbCatalog(release_range).browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC,),
            release_from=date(2020, 1, 1),
            release_to=date(2020, 12, 31),
        )
    )

    release_walk = ReleaseIndexTransport(
        releases=[(game_id, 1_000 + game_id) for game_id in range(1, 501)],
        matching=list(range(1, 501)),
        candidate_total=200_000,
    )
    await IgdbCatalog(release_walk).browse_games(
        BrowseCriteria(
            platform_ids=(PlatformId.PC,),
            sort=SortOption.RELEASE_DATE,
        )
    )

    autocomplete = AutocompleteFixtureTransport([])
    await IgdbCatalog(autocomplete).autocomplete(AutocompleteCriteria(query="witcher"))

    transports = (
        plain_sort,
        popularity_walk,
        exhaustive_popularity,
        duration_index,
        release_range,
        release_walk,
        autocomplete,
    )
    game_queries = [
        query
        for transport in transports
        for endpoint, query in (
            *transport.count_requests,
            *transport.requests,
        )
        if endpoint == "games"
    ]

    assert game_queries
    assert all("game_type = (0,8,9)" in query for query in game_queries)
    assert not any(
        query.startswith("fields id;")
        and "sort id asc" in query
        and "id = (" not in query
        for endpoint, query in popularity_walk.requests
        if endpoint == "games"
    )

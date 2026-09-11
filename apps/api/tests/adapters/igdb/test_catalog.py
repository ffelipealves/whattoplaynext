"""Catalog-seam tests for IGDB filter metadata normalization."""

import json
from pathlib import Path
from typing import cast

import pytest

from whattoplaynext_api.adapters.igdb.catalog import IgdbCatalog
from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransportError,
)
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


class FailingTransport:
    def __init__(self, reason: IgdbErrorReason) -> None:
        self.reason = reason

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        raise IgdbTransportError(self.reason, retry_after_seconds=2)


class EmptyTransport:
    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        return []


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


@pytest.mark.anyio
async def test_rejects_empty_provider_taxonomies_as_an_invalid_response() -> None:
    catalog = IgdbCatalog(EmptyTransport())

    with pytest.raises(ApplicationError) as error:
        await catalog.get_filter_metadata()

    assert error.value.code is ErrorCode.UPSTREAM_INVALID_RESPONSE

"""Tests for canonical, namespaced cache keys."""

import pytest
from pydantic import BaseModel

from whattoplaynext_api.cache.keys import cache_key


class Criteria(BaseModel):
    name: str | None = None
    platform: list[str] = []
    sort: str = "popularity"


def search_key(criteria: object, *, schema_version: int = 1) -> str:
    return cache_key(
        environment="test",
        api_version="v1",
        resource="search",
        schema_version=schema_version,
        criteria=criteria,
    )


def test_key_is_namespaced_versioned_and_ends_in_a_digest() -> None:
    key = search_key(Criteria())

    prefix, digest = key.rsplit(":", 1)
    assert prefix == "wtpn:test:cache:v1:search:s1"
    assert len(digest) == 64
    int(digest, 16)


def test_omitted_defaults_and_explicit_defaults_share_a_key() -> None:
    assert search_key(Criteria()) == search_key(Criteria(sort="popularity"))


def test_repeated_values_are_order_and_duplicate_insensitive() -> None:
    assert search_key(Criteria(platform=["pc", "playstation-5"])) == search_key(
        Criteria(platform=["playstation-5", "pc", "pc"])
    )


@pytest.mark.parametrize(
    ("left", "right"),
    [
        (Criteria(name="zelda"), Criteria(name="Zelda")),
        (Criteria(platform=["pc"]), Criteria(platform=["pc", "xbox-one"])),
        (Criteria(sort="rating"), Criteria(sort="title")),
        # A value must not be able to impersonate a key boundary.
        (Criteria(name="a", sort="b"), Criteria(name='a","sort":"b', sort="")),
    ],
)
def test_different_criteria_never_collide(left: Criteria, right: Criteria) -> None:
    assert search_key(left) != search_key(right)


def test_schema_version_separates_entries() -> None:
    assert search_key(Criteria(), schema_version=1) != search_key(
        Criteria(), schema_version=2
    )


def test_raw_query_text_never_appears_in_the_key() -> None:
    key = search_key(Criteria(name="the legend of zelda"))

    assert "zelda" not in key


def test_criteria_may_be_absent_for_parameterless_resources() -> None:
    key = cache_key(
        environment="production",
        api_version="v1",
        resource="filters",
        schema_version=3,
        criteria=None,
    )

    assert key.startswith("wtpn:production:cache:v1:filters:s3:")


@pytest.mark.parametrize(
    "resource",
    ["", "Search", "search:page", "search page", "-search"],
)
def test_rejects_a_resource_that_could_break_the_namespace(resource: str) -> None:
    with pytest.raises(ValueError, match="resource"):
        cache_key(
            environment="test",
            api_version="v1",
            resource=resource,
            schema_version=1,
            criteria=None,
        )


def test_rejects_a_non_positive_schema_version() -> None:
    with pytest.raises(ValueError, match="schema"):
        search_key(Criteria(), schema_version=0)

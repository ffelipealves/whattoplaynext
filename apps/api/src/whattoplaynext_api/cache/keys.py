"""Canonical, namespaced cache keys."""

import json
from hashlib import sha256
from re import compile as compile_pattern

from pydantic import BaseModel

SEGMENT_PATTERN = compile_pattern(r"[a-z0-9][a-z0-9-]*")


def cache_key(
    *,
    environment: str,
    api_version: str,
    resource: str,
    schema_version: int,
    criteria: object,
) -> str:
    """Build ``wtpn:{env}:cache:{api}:{resource}:s{schema}:{digest}``.

    The digest covers a canonical serialization of already validated criteria,
    so equivalent requests share a key while raw query text never appears in
    it. Bump ``schema_version`` whenever a resource's response shape or
    eligibility rules change.
    """
    for name, segment in (
        ("environment", environment),
        ("api_version", api_version),
        ("resource", resource),
    ):
        if not SEGMENT_PATTERN.fullmatch(segment):
            msg = f"Invalid cache key {name}: {segment!r}"
            raise ValueError(msg)
    if schema_version < 1:
        msg = "Cache schema version must be positive"
        raise ValueError(msg)
    digest = sha256(_canonical_json(criteria).encode()).hexdigest()
    return (
        f"wtpn:{environment}:cache:{api_version}:{resource}:s{schema_version}:{digest}"
    )


def _canonical_json(criteria: object) -> str:
    return json.dumps(
        _canonical(criteria),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _canonical(value: object) -> object:
    """Materialize defaults and make repeated values order-insensitive.

    Every list in validated criteria is a set of allow-listed identifiers,
    so sorting and deduplicating it cannot merge distinct requests.
    """
    if isinstance(value, BaseModel):
        return _canonical(value.model_dump(mode="json"))
    if isinstance(value, dict):
        return {str(key): _canonical(item) for key, item in value.items()}
    if isinstance(value, list | tuple | set | frozenset):
        items = [_canonical(item) for item in value]
        unique = {_canonical_json(item): item for item in items}
        return [unique[encoded] for encoded in sorted(unique)]
    return value

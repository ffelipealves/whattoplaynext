"""Typed cache entries over the byte-oriented store port."""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from math import ceil
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, JsonValue
from pydantic import ValidationError as PydanticValidationError

from whattoplaynext_api.cache.store import CacheStore, CacheUnavailableError

logger = logging.getLogger("whattoplaynext_api.cache")


class CacheHealth(StrEnum):
    """Cache dependency state safe to report to monitoring."""

    UP = "up"
    DOWN = "down"
    DISABLED = "disabled"


@dataclass(frozen=True)
class CachedValue[T: BaseModel]:
    """A decoded entry and the times that decide whether it is still fresh."""

    value: T
    stored_at: datetime
    fresh_until: datetime

    def is_fresh(self, now: datetime) -> bool:
        """Whether the entry may be served without asking the provider."""
        return now < self.fresh_until


class _Envelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = Field(alias="v")
    stored_at: AwareDatetime = Field(alias="storedAt")
    fresh_until: AwareDatetime = Field(alias="freshUntil")
    payload: JsonValue


def _utc_now() -> datetime:
    return datetime.now(UTC)


class Cache:
    """Read and write versioned entries without letting Redis fail a request.

    Store failures become misses and skipped writes. After one, the store is
    bypassed for ``bypass_for`` so an outage does not add a timeout to every
    request. A ``None`` store is a disabled cache.
    """

    def __init__(
        self,
        store: CacheStore | None,
        *,
        clock: Callable[[], datetime] = _utc_now,
        bypass_for: timedelta = timedelta(seconds=30),
    ) -> None:
        self._store = store
        self._clock = clock
        self._bypass_for = bypass_for
        self._bypass_until: datetime | None = None

    async def read[T: BaseModel](
        self, key: str, model: type[T]
    ) -> CachedValue[T] | None:
        """Return the entry for ``key``, fresh or expired, or ``None``."""
        store = self._available_store()
        if store is None:
            return None
        try:
            raw = await store.get(key)
        except CacheUnavailableError:
            self._start_bypass()
            return None
        if raw is None:
            return None
        try:
            envelope = _Envelope.model_validate_json(raw)
            value = model.model_validate(envelope.payload)
        except PydanticValidationError:
            # Never log the entry itself: it may hold provider text.
            logger.warning("cache.decode_failed")
            await self._discard(store, key)
            return None
        return CachedValue(
            value=value,
            stored_at=envelope.stored_at,
            fresh_until=envelope.fresh_until,
        )

    async def write(
        self,
        key: str,
        value: BaseModel,
        *,
        fresh_for: timedelta,
        stale_for: timedelta = timedelta(0),
    ) -> None:
        """Store ``value`` as fresh for ``fresh_for``, then kept for ``stale_for``."""
        if fresh_for <= timedelta(0):
            msg = "A cache entry must have a positive fresh lifetime"
            raise ValueError(msg)
        if stale_for < timedelta(0):
            msg = "A cache entry cannot have a negative stale window"
            raise ValueError(msg)
        store = self._available_store()
        if store is None:
            return
        stored_at = self._clock()
        envelope = _Envelope(
            v=1,
            storedAt=stored_at,
            freshUntil=stored_at + fresh_for,
            payload=value.model_dump(mode="json"),
        )
        ttl_seconds = max(1, ceil((fresh_for + stale_for).total_seconds()))
        try:
            await store.set(
                key,
                envelope.model_dump_json(by_alias=True).encode(),
                ttl_seconds,
            )
        except CacheUnavailableError:
            self._start_bypass()

    async def health(self) -> CacheHealth:
        """Probe the store directly, ignoring any active bypass."""
        if self._store is None:
            return CacheHealth.DISABLED
        try:
            await self._store.ping()
        except CacheUnavailableError:
            self._start_bypass()
            return CacheHealth.DOWN
        self._bypass_until = None
        return CacheHealth.UP

    def _available_store(self) -> CacheStore | None:
        if self._bypass_until is not None and self._clock() < self._bypass_until:
            return None
        return self._store

    def _start_bypass(self) -> None:
        logger.warning("cache.unavailable")
        self._bypass_until = self._clock() + self._bypass_for

    async def _discard(self, store: CacheStore, key: str) -> None:
        try:
            await store.delete(key)
        except CacheUnavailableError:
            self._start_bypass()

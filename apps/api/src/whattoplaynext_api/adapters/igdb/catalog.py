"""IGDB implementation of the provider-neutral catalog interface."""

from dataclasses import dataclass
from datetime import UTC, datetime, time
from json import dumps
from math import ceil
from typing import Protocol

from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransportError,
)
from whattoplaynext_api.catalog.models import (
    AgeRating,
    AutocompleteCriteria,
    AutocompleteResult,
    AutocompleteSuggestion,
    BrowseCriteria,
    BrowseQuery,
    CatalogOption,
    DetailDuration,
    DurationKind,
    ExternalLink,
    FilterLimits,
    FilterMetadata,
    GameCover,
    GameDetail,
    GameDurations,
    GamePage,
    GameRating,
    GameSummary,
    MultiplayerInfo,
    Pagination,
    PlatformRelease,
    ResponseMeta,
    SortDirection,
    SortOption,
    Theme,
)
from whattoplaynext_api.core.errors import ApplicationError, ErrorCode


class IgdbQueryTransport(Protocol):
    """Execute one authenticated APICalypse query."""

    async def query(
        self,
        endpoint: str,
        query: str,
    ) -> list[dict[str, object]]:
        """Return validated IGDB records for one endpoint."""
        ...

    async def count(self, endpoint: str, query: str) -> int:
        """Return a validated count for one IGDB endpoint."""
        ...


@dataclass(frozen=True, slots=True)
class AllowedOption:
    provider_id: int
    public_id: str
    label: str


PLATFORMS = (
    AllowedOption(6, "pc", "PC"),
    AllowedOption(48, "playstation-4", "PlayStation 4"),
    AllowedOption(167, "playstation-5", "PlayStation 5"),
    AllowedOption(49, "xbox-one", "Xbox One"),
    AllowedOption(169, "xbox-series-x-s", "Xbox Series X|S"),
    AllowedOption(130, "nintendo-switch", "Nintendo Switch"),
)

GENRES = (
    AllowedOption(2, "point-and-click", "Point-and-click"),
    AllowedOption(4, "fighting", "Fighting"),
    AllowedOption(5, "shooter", "Shooter"),
    AllowedOption(7, "music", "Music"),
    AllowedOption(8, "platform", "Platform"),
    AllowedOption(9, "puzzle", "Puzzle"),
    AllowedOption(10, "racing", "Racing"),
    AllowedOption(11, "real-time-strategy-rts", "Real Time Strategy (RTS)"),
    AllowedOption(12, "role-playing-rpg", "Role-playing (RPG)"),
    AllowedOption(13, "simulator", "Simulator"),
    AllowedOption(14, "sport", "Sport"),
    AllowedOption(15, "strategy", "Strategy"),
    AllowedOption(16, "turn-based-strategy-tbs", "Turn-based strategy (TBS)"),
    AllowedOption(24, "tactical", "Tactical"),
    AllowedOption(25, "hack-and-slash-beat-em-up", "Hack and slash/Beat 'em up"),
    AllowedOption(26, "quiz-trivia", "Quiz/Trivia"),
    AllowedOption(30, "pinball", "Pinball"),
    AllowedOption(31, "adventure", "Adventure"),
    AllowedOption(32, "indie", "Indie"),
    AllowedOption(33, "arcade", "Arcade"),
    AllowedOption(34, "visual-novel", "Visual Novel"),
    AllowedOption(35, "card-board-game", "Card & Board Game"),
    AllowedOption(36, "moba", "MOBA"),
)

GAME_MODES = (
    AllowedOption(1, "single-player", "Single player"),
    AllowedOption(2, "multiplayer", "Multiplayer"),
    AllowedOption(3, "co-operative", "Co-operative"),
    AllowedOption(4, "split-screen", "Split screen"),
    AllowedOption(5, "massively-multiplayer-online", "Massively Multiplayer Online"),
    AllowedOption(6, "battle-royale", "Battle Royale"),
)

DURATION_PROVIDER_FIELDS = {
    DurationKind.FAST: "hastily",
    DurationKind.NORMAL: "normally",
    DurationKind.COMPLETIONIST: "completely",
}

AUTOCOMPLETE_SUGGESTION_LIMIT = 8

# IGDB's maximum page size for a single query, and therefore the unit every
# index walk in this adapter is measured in.
PROVIDER_BATCH_SIZE = 500

# Listing every match costs two requests per provider page, which is both
# cheap and exact while the matches are few; paging the popularity index only
# earns its place once that list grows past a handful of pages.
POPULARITY_WALK_THRESHOLD = 4 * PROVIDER_BATCH_SIZE

# Released base games plus their separately cataloged remakes and remasters;
# DLC, expansions, bundles, mods, and other non-base `game_type` values are
# excluded from MVP content per docs/product-requirements.md#3.2. Verified
# against live IGDB data (the `game_types` endpoint) on 2026-09-12.
ELIGIBLE_GAME_TYPES = frozenset({0, 8, 9})

WEBSITE_LABELS = {
    1: "Official Website",
    3: "Wikipedia",
    6: "Twitch",
    9: "YouTube",
    13: "Steam",
    16: "Epic Games Store",
    17: "GOG",
    18: "Discord",
}


class IgdbCatalog:
    """Normalize IGDB data behind the catalog application interface."""

    def __init__(self, transport: IgdbQueryTransport) -> None:
        self._transport = transport

    async def get_filter_metadata(self) -> FilterMetadata:
        """Return allow-listed filters with application-owned identities."""
        try:
            platform_records = await self._transport.query(
                "platforms",
                _options_query(PLATFORMS),
            )
            genre_records = await self._transport.query(
                "genres",
                _options_query(GENRES),
            )
            game_mode_records = await self._transport.query(
                "game_modes",
                _options_query(GAME_MODES),
            )
        except IgdbTransportError as error:
            raise _application_error(error) from error
        platforms = _normalize_options(platform_records, PLATFORMS)
        genres = _normalize_options(genre_records, GENRES)
        game_modes = _normalize_options(game_mode_records, GAME_MODES)
        if not platforms or not genres or not game_modes:
            raise ApplicationError(ErrorCode.UPSTREAM_INVALID_RESPONSE)
        return FilterMetadata(
            platforms=platforms,
            genres=genres,
            game_modes=game_modes,
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
        """Return one strictly filtered and ordered page of games."""
        offset = (criteria.page - 1) * criteria.page_size
        needs_local_evaluation = _needs_local_evaluation(criteria)
        try:
            if needs_local_evaluation:
                total_items, items = await self._locally_evaluated_page(criteria)
            elif criteria.sort is SortOption.POPULARITY:
                if _has_game_filters(criteria):
                    total_items, game_ids = await self._filtered_popularity_ids(
                        criteria
                    )
                else:
                    popularity_filter = "where popularity_type = 1;"
                    total_items = await self._transport.count(
                        "popularity_primitives",
                        popularity_filter,
                    )
                    popularity_records = await self._transport.query(
                        "popularity_primitives",
                        (
                            "fields game_id,value; where popularity_type = 1; "
                            f"sort value {criteria.direction.value}; "
                            f"limit {criteria.page_size}; offset {offset};"
                        ),
                    )
                    game_ids = _popularity_game_ids(popularity_records)
                game_records = (
                    await self._transport.query(
                        "games",
                        _games_query(game_ids, criteria.page_size),
                    )
                    if game_ids
                    else []
                )
                items = _normalize_games(game_records, game_ids)
            else:
                where_query = _where_query(criteria)
                total_items = await self._transport.count("games", where_query)
                game_records = await self._transport.query(
                    "games",
                    _search_query(criteria, where_query, offset),
                )
                items = [_normalize_game(record) for record in game_records]
            if not needs_local_evaluation:
                items = await self._enrich_page_durations(items)
        except IgdbTransportError as error:
            raise _application_error(error) from error
        except OSError, OverflowError, TypeError, ValueError:
            raise ApplicationError(ErrorCode.UPSTREAM_INVALID_RESPONSE) from None

        return GamePage(
            items=items,
            pagination=Pagination(
                page=criteria.page,
                page_size=criteria.page_size,
                total_items=total_items,
                total_pages=ceil(total_items / criteria.page_size),
            ),
            query=BrowseQuery(
                sort=criteria.sort,
                direction=criteria.direction,
            ),
            meta=ResponseMeta(excluded_unknown_duration=_has_duration_filter(criteria)),
        )

    async def autocomplete(self, criteria: AutocompleteCriteria) -> AutocompleteResult:
        """Return at most eight relevance-ordered title suggestions."""
        try:
            records = await self._transport.query(
                "games",
                _autocomplete_query(criteria),
            )
        except IgdbTransportError as error:
            raise _application_error(error) from error
        except OSError, OverflowError, TypeError, ValueError:
            raise ApplicationError(ErrorCode.UPSTREAM_INVALID_RESPONSE) from None
        items = [
            _normalize_suggestion(record)
            for record in records[:AUTOCOMPLETE_SUGGESTION_LIMIT]
        ]
        return AutocompleteResult(items=items, meta=ResponseMeta())

    async def get_game_detail(self, game_id: int) -> GameDetail:
        """Return complete normalized detail for one eligible game."""
        try:
            records = await self._transport.query("games", _detail_query(game_id))
            if not records or not _is_eligible_game_type(records[0]):
                raise ApplicationError(ErrorCode.GAME_NOT_FOUND)
            duration_records = await self._transport.query(
                "game_time_to_beats",
                _detail_duration_query(game_id),
            )
        except IgdbTransportError as error:
            raise _application_error(error) from error
        except OSError, OverflowError, TypeError, ValueError:
            raise ApplicationError(ErrorCode.UPSTREAM_INVALID_RESPONSE) from None
        return _normalize_detail(records[0], duration_records)

    async def _locally_evaluated_page(
        self,
        criteria: BrowseCriteria,
    ) -> tuple[int, list[GameSummary]]:
        where_query = _where_query(
            criteria,
            include_release_bounds=not bool(criteria.platform_ids),
        )
        duration_kinds = tuple(
            dict.fromkeys((DurationKind.NORMAL, criteria.duration_kind))
        )
        include_release_dates = _needs_platform_release_data(criteria)

        # Both sides have to be read in full to evaluate a duration filter
        # locally, so the cheaper plan is whichever index is smaller: a narrow
        # play-time window covers a fraction of the duration index, while a
        # narrow game filter matches a fraction of the catalog.
        candidate_total = await self._transport.count("games", where_query)
        duration_total = (
            await self._transport.count(
                "game_time_to_beats",
                _duration_range_where(criteria),
            )
            if _has_duration_filter(criteria)
            else None
        )

        if duration_total is not None and duration_total <= candidate_total:
            durations = await self._durations_in_range(criteria, duration_kinds)
            records = await self._games_by_ids(
                list(durations),
                where_query,
                include_release_dates=include_release_dates,
            )
        else:
            records = await self._candidate_records(
                where_query,
                candidate_total,
                include_release_dates=include_release_dates,
            )
            durations = await self._duration_values(
                _record_ids(records),
                duration_kinds,
            )

        if _has_platform_release_filter(criteria):
            records = [
                record
                for record in records
                if _matches_platform_release(record, criteria)
            ]

        if _has_duration_filter(criteria):
            records = [
                record
                for record in records
                if _matches_duration(_required_int(record, "id"), durations, criteria)
            ]

        popularity = (
            await self._popularity_for_ids(_record_ids(records))
            if criteria.sort is SortOption.POPULARITY
            else {}
        )
        records = _order_local_records(records, criteria, durations, popularity)
        total_items = len(records)
        offset = (criteria.page - 1) * criteria.page_size
        page_records = records[offset : offset + criteria.page_size]
        return total_items, _normalize_games_with_durations(page_records, durations)

    async def _candidate_records(
        self,
        where_query: str,
        candidate_total: int,
        *,
        include_release_dates: bool,
    ) -> list[dict[str, object]]:
        """Read every game the strict filter matches, one provider page apart."""
        records: list[dict[str, object]] = []
        for batch_offset in range(0, candidate_total, PROVIDER_BATCH_SIZE):
            records.extend(
                await self._transport.query(
                    "games",
                    _candidate_games_query(
                        where_query,
                        batch_offset,
                        include_release_dates=include_release_dates,
                    ),
                )
            )
        return records

    async def _durations_in_range(
        self,
        criteria: BrowseCriteria,
        kinds: tuple[DurationKind, ...],
    ) -> dict[int, dict[DurationKind, int]]:
        """Read every game whose selected duration falls inside the bounds."""
        fields = ",".join(DURATION_PROVIDER_FIELDS[kind] for kind in kinds)
        where = _duration_range_where(criteria)
        durations: dict[int, dict[DurationKind, int]] = {}
        offset = 0
        while True:
            records = await self._transport.query(
                "game_time_to_beats",
                (
                    f"fields game_id,{fields}; {where} sort game_id asc; "
                    f"limit {PROVIDER_BATCH_SIZE}; offset {offset};"
                ),
            )
            durations.update(_normalize_duration_records(records, kinds))
            if len(records) < PROVIDER_BATCH_SIZE:
                return durations
            offset += PROVIDER_BATCH_SIZE

    async def _games_by_ids(
        self,
        game_ids: list[int],
        where_query: str,
        *,
        include_release_dates: bool,
    ) -> list[dict[str, object]]:
        """Read the games in one id set that also satisfy the strict filter."""
        records: list[dict[str, object]] = []
        for game_id_batch in _chunks(game_ids, PROVIDER_BATCH_SIZE):
            records.extend(
                await self._transport.query(
                    "games",
                    _candidate_games_by_ids_query(
                        where_query,
                        game_id_batch,
                        include_release_dates=include_release_dates,
                    ),
                )
            )
        return records

    async def _enrich_page_durations(
        self,
        items: list[GameSummary],
    ) -> list[GameSummary]:
        durations = await self._duration_values(
            [item.id for item in items],
            (DurationKind.NORMAL,),
        )
        return [
            item.model_copy(
                update={
                    "normal_duration_seconds": durations.get(item.id, {}).get(
                        DurationKind.NORMAL
                    )
                }
            )
            for item in items
        ]

    async def _duration_values(
        self,
        game_ids: list[int],
        kinds: tuple[DurationKind, ...],
    ) -> dict[int, dict[DurationKind, int]]:
        durations: dict[int, dict[DurationKind, int]] = {}
        fields = ",".join(DURATION_PROVIDER_FIELDS[kind] for kind in kinds)
        for game_id_batch in _chunks(game_ids, PROVIDER_BATCH_SIZE):
            ids = ",".join(str(game_id) for game_id in game_id_batch)
            records = await self._transport.query(
                "game_time_to_beats",
                (f"fields game_id,{fields}; where game_id = ({ids}); limit 500;"),
            )
            durations.update(_normalize_duration_records(records, kinds))
        return durations

    async def _popularity_for_ids(self, game_ids: list[int]) -> dict[int, float]:
        popularity: dict[int, float] = {}
        for game_id_batch in _chunks(game_ids, PROVIDER_BATCH_SIZE):
            ids = ",".join(str(game_id) for game_id in game_id_batch)
            records = await self._transport.query(
                "popularity_primitives",
                (
                    "fields game_id,value; where popularity_type = 1 & "
                    f"game_id = ({ids}); limit 500;"
                ),
            )
            popularity.update(_popularity_values(records))
        return popularity

    async def _filtered_popularity_ids(
        self,
        criteria: BrowseCriteria,
    ) -> tuple[int, list[int]]:
        where_query = _where_query(criteria)
        total_items = await self._transport.count("games", where_query)
        required = criteria.page * criteria.page_size
        ordered_ids = (
            await self._ranked_matching_ids(
                where_query,
                criteria.direction,
                required=required,
                total_items=total_items,
            )
            if total_items > POPULARITY_WALK_THRESHOLD
            else None
        )
        if ordered_ids is None:
            ordered_ids = await self._every_matching_id_by_popularity(
                where_query,
                criteria.direction,
                total_items,
            )
        offset = (criteria.page - 1) * criteria.page_size
        return total_items, ordered_ids[offset : offset + criteria.page_size]

    async def _ranked_matching_ids(
        self,
        where_query: str,
        direction: SortDirection,
        *,
        required: int,
        total_items: int,
    ) -> list[int] | None:
        """Page the popularity index until the requested page is full.

        Only the most popular `required` matches can ever be shown, so reading
        the index in popularity order and intersecting each page with the
        filter answers a broad search in a couple of requests, where listing
        every matching id first costs one request per 500 matches.

        Returns `None` when the index cannot fill the page — either it ran out
        of ranked games or filling it would cost more requests than listing
        every match — leaving that case to the exhaustive path, which is also
        the only one that can order unranked matches.
        """
        budget = max(1, ceil(total_items / PROVIDER_BATCH_SIZE))
        ranked: list[tuple[int, float]] = []
        seen: set[int] = set()
        for batch in range(budget):
            records = await self._transport.query(
                "popularity_primitives",
                (
                    "fields game_id,value; where popularity_type = 1; "
                    f"sort value {direction.value}; "
                    f"limit {PROVIDER_BATCH_SIZE}; "
                    f"offset {batch * PROVIDER_BATCH_SIZE};"
                ),
            )
            # Validated once: the keys are this index page's ids, already in
            # the provider's popularity order.
            values = _popularity_values(records)
            candidate_ids = list(values)
            for game_id in await self._matching_ids(candidate_ids, where_query):
                if game_id not in seen:
                    seen.add(game_id)
                    ranked.append((game_id, values[game_id]))
            if len(ranked) >= required:
                return _ids_by_popularity(ranked, direction)
            if len(records) < PROVIDER_BATCH_SIZE:
                return None
        return None

    async def _matching_ids(
        self,
        candidate_ids: list[int],
        where_query: str,
    ) -> list[int]:
        """Keep the candidates the strict filter accepts, in candidate order."""
        if not candidate_ids:
            return []
        records = await self._transport.query(
            "games",
            (
                f"fields id; {_where_with_ids(where_query, candidate_ids)} "
                f"limit {len(candidate_ids)};"
            ),
        )
        matching = set(_record_ids(records))
        return [game_id for game_id in candidate_ids if game_id in matching]

    async def _every_matching_id_by_popularity(
        self,
        where_query: str,
        direction: SortDirection,
        total_items: int,
    ) -> list[int]:
        matching_ids: list[int] = []
        for batch_offset in range(0, total_items, PROVIDER_BATCH_SIZE):
            records = await self._transport.query(
                "games",
                (
                    f"fields id; {where_query} sort id asc; "
                    f"limit {PROVIDER_BATCH_SIZE}; offset {batch_offset};"
                ),
            )
            matching_ids.extend(_record_ids(records))

        popularity = await self._popularity_for_ids(matching_ids)

        reverse_value = direction is SortDirection.DESCENDING
        return sorted(
            matching_ids,
            key=lambda game_id: (
                game_id not in popularity,
                (
                    -popularity.get(game_id, 0)
                    if reverse_value
                    else popularity.get(game_id, 0)
                ),
                game_id,
            ),
        )


def _options_query(options: tuple[AllowedOption, ...]) -> str:
    provider_ids = ",".join(str(option.provider_id) for option in options)
    return f"fields id,name; where id = ({provider_ids}); limit 500;"


def _normalize_options(
    records: list[dict[str, object]],
    allowed: tuple[AllowedOption, ...],
) -> list[CatalogOption]:
    available_ids = {
        provider_id
        for record in records
        if isinstance((provider_id := record.get("id")), int)
        and not isinstance(provider_id, bool)
    }
    return [
        CatalogOption(id=option.public_id, label=option.label)
        for option in allowed
        if option.provider_id in available_ids
    ]


def _popularity_game_ids(records: list[dict[str, object]]) -> list[int]:
    game_ids: list[int] = []
    for record in records:
        game_id = record.get("game_id")
        if not isinstance(game_id, int) or isinstance(game_id, bool):
            raise ValueError("invalid popularity record")
        game_ids.append(game_id)
    return game_ids


def _popularity_values(records: list[dict[str, object]]) -> dict[int, float]:
    values: dict[int, float] = {}
    for record in records:
        game_id = record.get("game_id")
        value = record.get("value")
        if (
            not isinstance(game_id, int)
            or isinstance(game_id, bool)
            or not isinstance(value, int | float)
            or isinstance(value, bool)
        ):
            raise ValueError("invalid popularity record")
        values[game_id] = float(value)
    return values


def _ids_by_popularity(
    ranked: list[tuple[int, float]],
    direction: SortDirection,
) -> list[int]:
    """Order ranked matches by value, breaking ties on id for stable paging."""
    reverse_value = direction is SortDirection.DESCENDING
    return [
        game_id
        for game_id, _value in sorted(
            ranked,
            key=lambda entry: (
                -entry[1] if reverse_value else entry[1],
                entry[0],
            ),
        )
    ]


def _where_with_ids(where_query: str, game_ids: list[int]) -> str:
    """Narrow an existing where clause to one batch of candidate ids."""
    ids = ",".join(str(game_id) for game_id in game_ids)
    id_clause = f"id = ({ids})"
    if not where_query:
        return f"where {id_clause};"
    return f"{where_query.removesuffix(';')} & {id_clause};"


def _record_ids(records: list[dict[str, object]]) -> list[int]:
    return [_required_int(record, "id") for record in records]


def _normalize_duration_records(
    records: list[dict[str, object]],
    kinds: tuple[DurationKind, ...],
) -> dict[int, dict[DurationKind, int]]:
    durations: dict[int, dict[DurationKind, int]] = {}
    for record in records:
        game_id = _required_int(record, "game_id")
        game_durations: dict[DurationKind, int] = {}
        for kind in kinds:
            field = DURATION_PROVIDER_FIELDS[kind]
            value = record.get(field)
            if value is None:
                continue
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                raise ValueError(f"invalid duration field: {field}")
            if value > 0:
                game_durations[kind] = value
        durations[game_id] = game_durations
    return durations


def _chunks(values: list[int], size: int) -> list[list[int]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def _games_query(game_ids: list[int], page_size: int) -> str:
    ids = ",".join(str(game_id) for game_id in game_ids)
    return (
        "fields id,slug,name,first_release_date,cover.image_id,platforms.id,"
        "genres.id,total_rating,total_rating_count,game_modes.id; "
        f"where id = ({ids}); limit {page_size};"
    )


def _duration_range_where(criteria: BrowseCriteria) -> str:
    field = DURATION_PROVIDER_FIELDS[criteria.duration_kind]
    # IGDB records an unknown duration as zero, which a maximum-only bound
    # would otherwise accept as the shortest possible game.
    clauses = [f"{field} > 0"]
    if criteria.minimum_duration_seconds is not None:
        clauses.append(f"{field} >= {criteria.minimum_duration_seconds}")
    if criteria.maximum_duration_seconds is not None:
        clauses.append(f"{field} <= {criteria.maximum_duration_seconds}")
    return f"where {' & '.join(clauses)};"


def _candidate_games_by_ids_query(
    where_query: str,
    game_ids: list[int],
    *,
    include_release_dates: bool,
) -> str:
    return (
        f"{_candidate_games_fields(include_release_dates)}; "
        f"{_where_with_ids(where_query, game_ids)} limit {len(game_ids)};"
    )


def _candidate_games_fields(include_release_dates: bool) -> str:
    release_fields = (
        ",release_dates.platform,release_dates.date" if include_release_dates else ""
    )
    return (
        "fields id,slug,name,first_release_date,cover.image_id,platforms.id,"
        f"genres.id,total_rating,total_rating_count,game_modes.id{release_fields}"
    )


def _candidate_games_query(
    where_query: str,
    offset: int,
    *,
    include_release_dates: bool,
) -> str:
    where = f" {where_query}" if where_query else ""
    return (
        f"{_candidate_games_fields(include_release_dates)};"
        f"{where} sort id asc; limit {PROVIDER_BATCH_SIZE}; offset {offset};"
    )


def _has_game_filters(criteria: BrowseCriteria) -> bool:
    return any(
        (
            criteria.name is not None,
            criteria.platform_ids,
            criteria.genre_ids,
            criteria.release_from is not None,
            criteria.release_to is not None,
            criteria.minimum_rating is not None,
            criteria.game_mode_ids,
        )
    )


def _has_duration_filter(criteria: BrowseCriteria) -> bool:
    return (
        criteria.minimum_duration_seconds is not None
        or criteria.maximum_duration_seconds is not None
    )


def _has_platform_release_filter(criteria: BrowseCriteria) -> bool:
    return bool(criteria.platform_ids) and (
        criteria.release_from is not None or criteria.release_to is not None
    )


def _needs_platform_release_data(criteria: BrowseCriteria) -> bool:
    return bool(criteria.platform_ids) and (
        _has_platform_release_filter(criteria)
        or criteria.sort is SortOption.RELEASE_DATE
    )


def _needs_local_evaluation(criteria: BrowseCriteria) -> bool:
    return (
        _has_duration_filter(criteria)
        or criteria.sort is SortOption.DURATION
        or _needs_platform_release_data(criteria)
    )


def _where_query(
    criteria: BrowseCriteria,
    *,
    include_release_bounds: bool = True,
) -> str:
    clauses: list[str] = []
    if criteria.name is not None:
        clauses.append(f"name ~ *{dumps(criteria.name, ensure_ascii=False)}*")
    _append_option_clause(clauses, "platforms", criteria.platform_ids, PLATFORMS)
    _append_option_clause(clauses, "genres", criteria.genre_ids, GENRES)
    if include_release_bounds and criteria.release_from is not None:
        clauses.append(
            "first_release_date >= "
            f"{int(datetime.combine(criteria.release_from, time.min, UTC).timestamp())}"
        )
    if include_release_bounds and criteria.release_to is not None:
        clauses.append(
            "first_release_date <= "
            f"{int(datetime.combine(criteria.release_to, time.max, UTC).timestamp())}"
        )
    if criteria.minimum_rating is not None:
        clauses.append(f"total_rating >= {criteria.minimum_rating}")
    _append_option_clause(
        clauses,
        "game_modes",
        criteria.game_mode_ids,
        GAME_MODES,
    )
    return f"where {' & '.join(clauses)};" if clauses else ""


def _append_option_clause(
    clauses: list[str],
    field: str,
    values: tuple[object, ...],
    allowed: tuple[AllowedOption, ...],
) -> None:
    if not values:
        return
    provider_ids_by_public_id = {
        option.public_id: option.provider_id for option in allowed
    }
    provider_ids = ",".join(
        str(provider_ids_by_public_id[str(value)]) for value in values
    )
    clauses.append(f"{field} = ({provider_ids})")


def _search_query(
    criteria: BrowseCriteria,
    where_query: str,
    offset: int,
) -> str:
    sort_fields = {
        SortOption.RATING: "total_rating",
        SortOption.RELEASE_DATE: "first_release_date",
        SortOption.TITLE: "name",
    }
    try:
        sort_field = sort_fields[criteria.sort]
    except KeyError:
        raise ApplicationError(ErrorCode.INVALID_QUERY) from None
    where = f" {where_query}" if where_query else ""
    return (
        "fields id,slug,name,first_release_date,cover.image_id,platforms.id,"
        "genres.id,total_rating,total_rating_count,game_modes.id;"
        f"{where} sort {sort_field} {criteria.direction.value}; "
        f"limit {criteria.page_size}; offset {offset};"
    )


def _autocomplete_query(criteria: AutocompleteCriteria) -> str:
    clauses: list[str] = []
    _append_option_clause(clauses, "platforms", criteria.platform_ids, PLATFORMS)
    where = f" where {' & '.join(clauses)};" if clauses else ""
    escaped_query = dumps(criteria.query, ensure_ascii=False)
    return (
        f"search {escaped_query}; "
        "fields id,slug,name,first_release_date,cover.image_id;"
        f"{where} limit {AUTOCOMPLETE_SUGGESTION_LIMIT};"
    )


def _normalize_games(
    records: list[dict[str, object]],
    ordered_ids: list[int],
) -> list[GameSummary]:
    games = {_required_int(record, "id"): _normalize_game(record) for record in records}
    return [games[game_id] for game_id in ordered_ids if game_id in games]


def _normalize_games_with_durations(
    records: list[dict[str, object]],
    durations: dict[int, dict[DurationKind, int]],
) -> list[GameSummary]:
    return [
        _normalize_game(record).model_copy(
            update={
                "normal_duration_seconds": durations.get(
                    _required_int(record, "id"), {}
                ).get(DurationKind.NORMAL)
            }
        )
        for record in records
    ]


def _matches_platform_release(
    record: dict[str, object],
    criteria: BrowseCriteria,
) -> bool:
    selected_platform_ids = {
        option.provider_id
        for option in PLATFORMS
        if option.public_id in criteria.platform_ids
    }
    lower = (
        int(datetime.combine(criteria.release_from, time.min, UTC).timestamp())
        if criteria.release_from is not None
        else None
    )
    upper = (
        int(datetime.combine(criteria.release_to, time.max, UTC).timestamp())
        if criteria.release_to is not None
        else None
    )
    return any(
        platform_id in selected_platform_ids
        and (lower is None or release_timestamp >= lower)
        and (upper is None or release_timestamp <= upper)
        for platform_id, release_timestamp in _release_dates(record)
    )


def _release_dates(record: dict[str, object]) -> list[tuple[int, int]]:
    value = record.get("release_dates")
    if not isinstance(value, list):
        return []
    releases: list[tuple[int, int]] = []
    for release in value:
        if not isinstance(release, dict):
            continue
        platform = release.get("platform")
        platform_id = platform.get("id") if isinstance(platform, dict) else platform
        release_timestamp = release.get("date")
        if (
            isinstance(platform_id, int)
            and not isinstance(platform_id, bool)
            and isinstance(release_timestamp, int)
            and not isinstance(release_timestamp, bool)
        ):
            releases.append((platform_id, release_timestamp))
    return releases


def _matches_duration(
    game_id: int,
    durations: dict[int, dict[DurationKind, int]],
    criteria: BrowseCriteria,
) -> bool:
    duration = durations.get(game_id, {}).get(criteria.duration_kind)
    return (
        duration is not None
        and (
            criteria.minimum_duration_seconds is None
            or duration >= criteria.minimum_duration_seconds
        )
        and (
            criteria.maximum_duration_seconds is None
            or duration <= criteria.maximum_duration_seconds
        )
    )


def _order_local_records(
    records: list[dict[str, object]],
    criteria: BrowseCriteria,
    durations: dict[int, dict[DurationKind, int]],
    popularity: dict[int, float],
) -> list[dict[str, object]]:
    records = sorted(records, key=lambda record: _required_int(record, "id"))
    known: list[tuple[dict[str, object], str | int | float]] = []
    unknown: list[dict[str, object]] = []
    for record in records:
        value = _local_sort_value(record, criteria, durations, popularity)
        if value is None:
            unknown.append(record)
        else:
            known.append((record, value))
    ordered_known = sorted(
        known,
        key=lambda item: item[1],
        reverse=criteria.direction is SortDirection.DESCENDING,
    )
    return [record for record, _value in ordered_known] + unknown


def _local_sort_value(
    record: dict[str, object],
    criteria: BrowseCriteria,
    durations: dict[int, dict[DurationKind, int]],
    popularity: dict[int, float],
) -> str | int | float | None:
    game_id = _required_int(record, "id")
    if criteria.sort is SortOption.POPULARITY:
        return popularity.get(game_id)
    if criteria.sort is SortOption.RATING:
        rating = record.get("total_rating")
        return (
            float(rating)
            if isinstance(rating, int | float) and not isinstance(rating, bool)
            else None
        )
    if criteria.sort is SortOption.RELEASE_DATE:
        if criteria.platform_ids:
            selected = {
                option.provider_id
                for option in PLATFORMS
                if option.public_id in criteria.platform_ids
            }
            dates = [
                date
                for platform, date in _release_dates(record)
                if platform in selected
            ]
            return min(dates) if dates else None
        release = record.get("first_release_date")
        return (
            release
            if isinstance(release, int) and not isinstance(release, bool)
            else None
        )
    if criteria.sort is SortOption.DURATION:
        return durations.get(game_id, {}).get(criteria.duration_kind)
    return _required_string(record, "name")


def _release_year(record: dict[str, object]) -> int | None:
    release_date = record.get("first_release_date")
    return (
        datetime.fromtimestamp(release_date, tz=UTC).year
        if isinstance(release_date, int) and not isinstance(release_date, bool)
        else None
    )


def _normalize_game(record: dict[str, object]) -> GameSummary:
    return GameSummary(
        id=_required_int(record, "id"),
        slug=_required_string(record, "slug"),
        title=_required_string(record, "name"),
        release_year=_release_year(record),
        cover=_normalize_cover(record.get("cover")),
        platforms=_normalize_record_options(record.get("platforms"), PLATFORMS),
        genres=_normalize_record_options(record.get("genres"), GENRES),
        rating=_normalize_rating(record),
        normal_duration_seconds=None,
        game_modes=_normalize_record_options(record.get("game_modes"), GAME_MODES),
    )


def _normalize_suggestion(record: dict[str, object]) -> AutocompleteSuggestion:
    return AutocompleteSuggestion(
        id=_required_int(record, "id"),
        slug=_required_string(record, "slug"),
        title=_required_string(record, "name"),
        release_year=_release_year(record),
        cover=_normalize_cover(record.get("cover")),
    )


def _required_int(record: dict[str, object], field: str) -> int:
    value = record.get(field)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"invalid required field: {field}")
    return value


def _required_string(record: dict[str, object], field: str) -> str:
    value = record.get(field)
    if not isinstance(value, str) or not value:
        raise ValueError(f"invalid required field: {field}")
    return value


def _normalize_image(
    value: object,
    *,
    transform: str,
    width: int,
    height: int,
) -> GameCover | None:
    if not isinstance(value, dict):
        return None
    image_id = value.get("image_id")
    if not isinstance(image_id, str) or not image_id:
        return None
    return GameCover(
        url=f"https://images.igdb.com/igdb/image/upload/t_{transform}/{image_id}.jpg",
        width=width,
        height=height,
    )


def _normalize_cover(value: object) -> GameCover | None:
    return _normalize_image(value, transform="cover_big", width=264, height=374)


def _normalize_screenshot(value: object) -> GameCover | None:
    return _normalize_image(value, transform="screenshot_big", width=889, height=500)


def _normalize_record_options(
    value: object,
    allowed: tuple[AllowedOption, ...],
) -> list[CatalogOption]:
    if not isinstance(value, list):
        return []
    available_ids = {
        provider_id
        for record in value
        if isinstance(record, dict)
        and isinstance((provider_id := record.get("id")), int)
        and not isinstance(provider_id, bool)
    }
    return [
        CatalogOption(id=option.public_id, label=option.label)
        for option in allowed
        if option.provider_id in available_ids
    ]


def _normalize_named_rating(
    record: dict[str, object],
    value_field: str,
    count_field: str,
    source: str,
) -> GameRating | None:
    value = record.get(value_field)
    count = record.get(count_field)
    if (
        not isinstance(value, int | float)
        or isinstance(value, bool)
        or not isinstance(count, int)
        or isinstance(count, bool)
    ):
        return None
    return GameRating(value=float(value), count=count, source=source)


def _normalize_rating(record: dict[str, object]) -> GameRating | None:
    return _normalize_named_rating(
        record, "total_rating", "total_rating_count", "IGDB combined"
    )


def _detail_query(game_id: int) -> str:
    return (
        "fields id,slug,name,alternative_names.name,summary,game_type,"
        "cover.image_id,screenshots.image_id,"
        "release_dates.platform,release_dates.date,"
        "genres.id,themes.id,themes.name,platforms.id,game_modes.id,"
        "multiplayer_modes.onlinecoop,multiplayer_modes.offlinecoop,"
        "multiplayer_modes.splitscreen,multiplayer_modes.splitscreenonline,"
        "multiplayer_modes.onlinemax,multiplayer_modes.offlinemax,"
        "rating,rating_count,aggregated_rating,aggregated_rating_count,"
        "total_rating,total_rating_count,"
        "age_ratings.organization.name,age_ratings.rating_category.rating,"
        "websites.type,websites.url; "
        f"where id = {game_id};"
    )


def _detail_duration_query(game_id: int) -> str:
    return (
        f"fields hastily,normally,completely,count; where game_id = {game_id}; limit 1;"
    )


def _is_eligible_game_type(record: dict[str, object]) -> bool:
    game_type = record.get("game_type")
    return (
        isinstance(game_type, int)
        and not isinstance(game_type, bool)
        and game_type in ELIGIBLE_GAME_TYPES
    )


def _normalize_detail(
    record: dict[str, object],
    duration_records: list[dict[str, object]],
) -> GameDetail:
    summary = record.get("summary")
    summary_text = summary if isinstance(summary, str) and summary else None
    return GameDetail(
        id=_required_int(record, "id"),
        slug=_required_string(record, "slug"),
        title=_required_string(record, "name"),
        alternative_names=_normalize_alternative_names(record.get("alternative_names")),
        summary=summary_text,
        summary_language="en" if summary_text is not None else None,
        cover=_normalize_cover(record.get("cover")),
        screenshots=_normalize_screenshots(record.get("screenshots")),
        releases=_normalize_platform_releases(record.get("release_dates")),
        genres=_normalize_record_options(record.get("genres"), GENRES),
        themes=_normalize_themes(record.get("themes")),
        platforms=_normalize_record_options(record.get("platforms"), PLATFORMS),
        game_modes=_normalize_record_options(record.get("game_modes"), GAME_MODES),
        multiplayer=_normalize_multiplayer(record.get("multiplayer_modes")),
        user_rating=_normalize_named_rating(
            record, "rating", "rating_count", "IGDB user"
        ),
        critic_rating=_normalize_named_rating(
            record, "aggregated_rating", "aggregated_rating_count", "IGDB critic"
        ),
        combined_rating=_normalize_rating(record),
        durations=_normalize_detail_durations(duration_records),
        age_ratings=_normalize_age_ratings(record.get("age_ratings")),
        external_links=_normalize_external_links(record.get("websites")),
        meta=ResponseMeta(),
    )


def _normalize_alternative_names(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    names: list[str] = []
    for item in value:
        if isinstance(item, dict):
            name = item.get("name")
            if isinstance(name, str) and name:
                names.append(name)
    return names


def _normalize_screenshots(value: object) -> list[GameCover]:
    if not isinstance(value, list):
        return []
    return [
        screenshot
        for item in value
        if (screenshot := _normalize_screenshot(item)) is not None
    ]


def _normalize_platform_releases(value: object) -> list[PlatformRelease]:
    if not isinstance(value, list):
        return []
    releases: list[PlatformRelease] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        platform_field = item.get("platform")
        platform_id = (
            platform_field.get("id")
            if isinstance(platform_field, dict)
            else platform_field
        )
        if not isinstance(platform_id, int) or isinstance(platform_id, bool):
            continue
        option = next(
            (option for option in PLATFORMS if option.provider_id == platform_id),
            None,
        )
        if option is None:
            continue
        date_value = item.get("date")
        release_date = (
            datetime.fromtimestamp(date_value, tz=UTC).date()
            if isinstance(date_value, int) and not isinstance(date_value, bool)
            else None
        )
        releases.append(
            PlatformRelease(
                platform=CatalogOption(id=option.public_id, label=option.label),
                release_date=release_date,
            )
        )
    return releases


def _normalize_themes(value: object) -> list[Theme]:
    if not isinstance(value, list):
        return []
    themes: list[Theme] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        theme_id = item.get("id")
        name = item.get("name")
        if (
            isinstance(theme_id, int)
            and not isinstance(theme_id, bool)
            and isinstance(name, str)
            and name
        ):
            themes.append(Theme(id=theme_id, name=name))
    return themes


def _normalize_multiplayer(value: object) -> MultiplayerInfo:
    online_coop = False
    offline_coop = False
    split_screen = False
    max_players: int | None = None
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue
            online_coop = online_coop or bool(item.get("onlinecoop"))
            offline_coop = offline_coop or bool(item.get("offlinecoop"))
            split_screen = (
                split_screen
                or bool(item.get("splitscreen"))
                or bool(item.get("splitscreenonline"))
            )
            for field in ("onlinemax", "offlinemax"):
                candidate = item.get(field)
                if (
                    isinstance(candidate, int)
                    and not isinstance(candidate, bool)
                    and candidate > 0
                ):
                    max_players = (
                        candidate
                        if max_players is None
                        else max(max_players, candidate)
                    )
    return MultiplayerInfo(
        online_coop=online_coop,
        offline_coop=offline_coop,
        split_screen=split_screen,
        max_players=max_players,
    )


def _normalize_detail_durations(records: list[dict[str, object]]) -> GameDurations:
    if not records:
        return GameDurations(fast=None, normal=None, completionist=None)
    record = records[0]
    count = record.get("count")
    submission_count = (
        count
        if isinstance(count, int) and not isinstance(count, bool) and count >= 0
        else 0
    )

    def duration_for(field: str) -> DetailDuration | None:
        value = record.get(field)
        if isinstance(value, int) and not isinstance(value, bool) and value > 0:
            return DetailDuration(seconds=value, submission_count=submission_count)
        return None

    return GameDurations(
        fast=duration_for("hastily"),
        normal=duration_for("normally"),
        completionist=duration_for("completely"),
    )


def _normalize_age_ratings(value: object) -> list[AgeRating]:
    if not isinstance(value, list):
        return []
    ratings: list[AgeRating] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        organization_field = item.get("organization")
        organization = (
            organization_field.get("name")
            if isinstance(organization_field, dict)
            else None
        )
        category_field = item.get("rating_category")
        rating = (
            category_field.get("rating") if isinstance(category_field, dict) else None
        )
        if (
            isinstance(organization, str)
            and organization
            and isinstance(rating, str)
            and rating
        ):
            ratings.append(AgeRating(organization=organization, rating=rating))
    return ratings


def _normalize_external_links(value: object) -> list[ExternalLink]:
    if not isinstance(value, list):
        return []
    links: list[ExternalLink] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        website_type = item.get("type")
        url = item.get("url")
        label = (
            WEBSITE_LABELS.get(website_type)
            if isinstance(website_type, int) and not isinstance(website_type, bool)
            else None
        )
        if label is not None and isinstance(url, str) and url:
            links.append(ExternalLink(label=label, url=url))
    return links


def _application_error(error: IgdbTransportError) -> ApplicationError:
    error_codes = {
        IgdbErrorReason.AUTHENTICATION_REJECTED: ErrorCode.UPSTREAM_UNAVAILABLE,
        IgdbErrorReason.INVALID_REQUEST: ErrorCode.UPSTREAM_INVALID_RESPONSE,
        IgdbErrorReason.INVALID_RESPONSE: ErrorCode.UPSTREAM_INVALID_RESPONSE,
        IgdbErrorReason.TIMEOUT: ErrorCode.UPSTREAM_TIMEOUT,
        IgdbErrorReason.RATE_LIMITED: ErrorCode.RATE_LIMITED,
        IgdbErrorReason.UNAVAILABLE: ErrorCode.UPSTREAM_UNAVAILABLE,
    }
    return ApplicationError(
        error_codes[error.reason],
        retry_after_seconds=(
            error.retry_after_seconds
            if error.reason is IgdbErrorReason.RATE_LIMITED
            else None
        ),
    )

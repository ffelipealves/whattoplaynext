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
    BrowseCriteria,
    BrowseQuery,
    CatalogOption,
    DurationKind,
    FilterLimits,
    FilterMetadata,
    GameCover,
    GamePage,
    GameRating,
    GameSummary,
    Pagination,
    ResponseMeta,
    SortDirection,
    SortOption,
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

    async def _locally_evaluated_page(
        self,
        criteria: BrowseCriteria,
    ) -> tuple[int, list[GameSummary]]:
        where_query = _where_query(
            criteria,
            include_release_bounds=not bool(criteria.platform_ids),
        )
        candidate_total = await self._transport.count("games", where_query)
        records: list[dict[str, object]] = []
        for batch_offset in range(0, candidate_total, 500):
            records.extend(
                await self._transport.query(
                    "games",
                    _candidate_games_query(
                        where_query,
                        batch_offset,
                        include_release_dates=_needs_platform_release_data(criteria),
                    ),
                )
            )
        if _has_platform_release_filter(criteria):
            records = [
                record
                for record in records
                if _matches_platform_release(record, criteria)
            ]

        duration_kinds = tuple(
            dict.fromkeys(
                (
                    DurationKind.NORMAL,
                    criteria.duration_kind,
                )
            )
        )
        durations = await self._duration_values(_record_ids(records), duration_kinds)
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
        for game_id_batch in _chunks(game_ids, 500):
            ids = ",".join(str(game_id) for game_id in game_id_batch)
            records = await self._transport.query(
                "game_time_to_beats",
                (f"fields game_id,{fields}; where game_id = ({ids}); limit 500;"),
            )
            durations.update(_normalize_duration_records(records, kinds))
        return durations

    async def _popularity_for_ids(self, game_ids: list[int]) -> dict[int, float]:
        popularity: dict[int, float] = {}
        for game_id_batch in _chunks(game_ids, 500):
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
        matching_ids: list[int] = []
        for batch_offset in range(0, total_items, 500):
            records = await self._transport.query(
                "games",
                (
                    f"fields id; {where_query} sort id asc; "
                    f"limit 500; offset {batch_offset};"
                ),
            )
            matching_ids.extend(_record_ids(records))

        popularity = await self._popularity_for_ids(matching_ids)

        reverse_value = criteria.direction is SortDirection.DESCENDING
        ordered_ids = sorted(
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
        offset = (criteria.page - 1) * criteria.page_size
        return total_items, ordered_ids[offset : offset + criteria.page_size]


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


def _candidate_games_query(
    where_query: str,
    offset: int,
    *,
    include_release_dates: bool,
) -> str:
    where = f" {where_query}" if where_query else ""
    release_fields = (
        ",release_dates.platform,release_dates.date" if include_release_dates else ""
    )
    return (
        "fields id,slug,name,first_release_date,cover.image_id,platforms.id,"
        "genres.id,total_rating,total_rating_count,game_modes.id"
        f"{release_fields};"
        f"{where} sort id asc; limit 500; offset {offset};"
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


def _normalize_game(record: dict[str, object]) -> GameSummary:
    release_date = record.get("first_release_date")
    release_year = (
        datetime.fromtimestamp(release_date, tz=UTC).year
        if isinstance(release_date, int) and not isinstance(release_date, bool)
        else None
    )
    return GameSummary(
        id=_required_int(record, "id"),
        slug=_required_string(record, "slug"),
        title=_required_string(record, "name"),
        release_year=release_year,
        cover=_normalize_cover(record.get("cover")),
        platforms=_normalize_record_options(record.get("platforms"), PLATFORMS),
        genres=_normalize_record_options(record.get("genres"), GENRES),
        rating=_normalize_rating(record),
        normal_duration_seconds=None,
        game_modes=_normalize_record_options(record.get("game_modes"), GAME_MODES),
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


def _normalize_cover(value: object) -> GameCover | None:
    if not isinstance(value, dict):
        return None
    image_id = value.get("image_id")
    if not isinstance(image_id, str) or not image_id:
        return None
    return GameCover(
        url=(f"https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"),
        width=264,
        height=374,
    )


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


def _normalize_rating(record: dict[str, object]) -> GameRating | None:
    value = record.get("total_rating")
    count = record.get("total_rating_count")
    if (
        not isinstance(value, int | float)
        or isinstance(value, bool)
        or not isinstance(count, int)
        or isinstance(count, bool)
    ):
        return None
    return GameRating(value=float(value), count=count, source="IGDB combined")


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

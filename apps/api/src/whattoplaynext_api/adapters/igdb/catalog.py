"""IGDB implementation of the provider-neutral catalog interface."""

from dataclasses import dataclass
from typing import Protocol

from whattoplaynext_api.adapters.igdb.transport import (
    IgdbErrorReason,
    IgdbTransportError,
)
from whattoplaynext_api.catalog.models import (
    CatalogOption,
    DurationKind,
    FilterLimits,
    FilterMetadata,
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

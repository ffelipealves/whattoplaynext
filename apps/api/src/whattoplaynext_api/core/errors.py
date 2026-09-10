"""Provider-neutral application failures."""

from enum import StrEnum


class ErrorCode(StrEnum):
    """Stable failure codes understood by public adapters."""

    GAME_NOT_FOUND = "GAME_NOT_FOUND"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    INVALID_QUERY = "INVALID_QUERY"
    METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED"
    NOT_FOUND = "NOT_FOUND"
    RATE_LIMITED = "RATE_LIMITED"
    UPSTREAM_INVALID_RESPONSE = "UPSTREAM_INVALID_RESPONSE"
    UPSTREAM_TIMEOUT = "UPSTREAM_TIMEOUT"
    UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE"
    VALIDATION_ERROR = "VALIDATION_ERROR"


class ApplicationError(Exception):
    """Expose a classified failure without transport-specific details."""

    def __init__(
        self,
        code: ErrorCode,
        *,
        retry_after_seconds: int | None = None,
    ) -> None:
        super().__init__(code.value)
        self.code = code
        self.retry_after_seconds = retry_after_seconds

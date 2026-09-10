"""Stable error responses for the public HTTP adapter."""

from dataclasses import dataclass
from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from whattoplaynext_api.core.errors import ApplicationError, ErrorCode
from whattoplaynext_api.http.correlation import (
    REQUEST_ID_HEADER,
    RequestCorrelationMiddleware,
)


class ErrorDetail(BaseModel):
    """Public details nested inside an error response."""

    code: ErrorCode
    message: str
    request_id: str = Field(serialization_alias="requestId")
    retry_after_seconds: int | None = Field(
        default=None,
        serialization_alias="retryAfterSeconds",
    )


class ErrorResponse(BaseModel):
    """Public envelope shared by every error response."""

    error: ErrorDetail


@dataclass(frozen=True)
class ErrorDefinition:
    status_code: int
    message: str


ERROR_DEFINITIONS = {
    ErrorCode.GAME_NOT_FOUND: ErrorDefinition(404, "Game not found."),
    ErrorCode.INTERNAL_ERROR: ErrorDefinition(500, "An unexpected error occurred."),
    ErrorCode.INVALID_QUERY: ErrorDefinition(400, "Query combination is invalid."),
    ErrorCode.METHOD_NOT_ALLOWED: ErrorDefinition(405, "Method not allowed."),
    ErrorCode.NOT_FOUND: ErrorDefinition(404, "Resource not found."),
    ErrorCode.RATE_LIMITED: ErrorDefinition(429, "Too many requests."),
    ErrorCode.UPSTREAM_INVALID_RESPONSE: ErrorDefinition(
        502,
        "Game data provider returned an invalid response.",
    ),
    ErrorCode.UPSTREAM_TIMEOUT: ErrorDefinition(504, "Game data provider timed out."),
    ErrorCode.UPSTREAM_UNAVAILABLE: ErrorDefinition(
        503,
        "Game data is temporarily unavailable.",
    ),
    ErrorCode.VALIDATION_ERROR: ErrorDefinition(
        422,
        "One or more parameter values are invalid.",
    ),
}

REQUEST_ID_RESPONSE_HEADER = {
    "description": "Identifier used to correlate this response.",
    "schema": {"type": "string"},
}


def documented_error_responses(
    *codes: ErrorCode,
) -> dict[int | str, dict[str, Any]]:
    """Describe selected stable failures without exposing handler details."""
    return {
        ERROR_DEFINITIONS[code].status_code: {
            "description": ERROR_DEFINITIONS[code].message,
            "headers": {REQUEST_ID_HEADER: REQUEST_ID_RESPONSE_HEADER},
            "model": ErrorResponse,
        }
        for code in codes
    }


def build_error_response(
    request: Request,
    code: ErrorCode,
    retry_after_seconds: int | None = None,
) -> JSONResponse:
    """Create one safe response shape for every translated failure."""
    definition = ERROR_DEFINITIONS[code]
    request_id: str = request.state.request_id
    response = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=definition.message,
            request_id=request_id,
            retry_after_seconds=retry_after_seconds,
        )
    )
    headers = {REQUEST_ID_HEADER: request_id}
    if retry_after_seconds is not None:
        headers["Retry-After"] = str(retry_after_seconds)
    return JSONResponse(
        content=response.model_dump(mode="json", by_alias=True, exclude_none=True),
        headers=headers,
        status_code=definition.status_code,
    )


async def handle_application_error(
    request: Request,
    error: Exception,
) -> JSONResponse:
    """Translate a classified application failure into the public contract."""
    application_error = cast(ApplicationError, error)
    return build_error_response(
        request,
        application_error.code,
        application_error.retry_after_seconds,
    )


async def handle_validation_error(
    request: Request,
    _error: Exception,
) -> JSONResponse:
    """Replace framework validation details with the stable public envelope."""
    return build_error_response(request, ErrorCode.VALIDATION_ERROR)


async def handle_unexpected_error(
    request: Request,
    _error: Exception,
) -> JSONResponse:
    """Return a safe fallback without exposing the original exception."""
    return build_error_response(request, ErrorCode.INTERNAL_ERROR)


async def handle_not_found_error(
    request: Request,
    _error: Exception,
) -> JSONResponse:
    """Normalize an unknown public resource without leaking framework details."""
    return build_error_response(request, ErrorCode.NOT_FOUND)


async def handle_method_not_allowed_error(
    request: Request,
    _error: Exception,
) -> JSONResponse:
    """Normalize requests using a method unsupported by the public resource."""
    return build_error_response(request, ErrorCode.METHOD_NOT_ALLOWED)


def install_http_boundary(application: FastAPI) -> None:
    """Install request correlation and error translation at the HTTP seam."""
    application.add_middleware(RequestCorrelationMiddleware)
    application.add_exception_handler(ApplicationError, handle_application_error)
    application.add_exception_handler(RequestValidationError, handle_validation_error)
    application.add_exception_handler(Exception, handle_unexpected_error)
    application.add_exception_handler(404, handle_not_found_error)
    application.add_exception_handler(405, handle_method_not_allowed_error)

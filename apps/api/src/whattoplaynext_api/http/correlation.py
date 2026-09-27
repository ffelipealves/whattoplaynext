"""Request correlation and the one structured log line per request."""

import logging
from collections.abc import Awaitable, Callable
from re import compile as compile_pattern
from time import perf_counter
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from whattoplaynext_api.cache.catalog import CacheOutcome, record_cache_outcomes
from whattoplaynext_api.core.telemetry import RequestTelemetry, request_scope

REQUEST_ID_HEADER = "X-Request-ID"
REQUEST_ID_PATTERN = compile_pattern(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")

logger = logging.getLogger("whattoplaynext_api.http")


class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    """Attach one request identifier to every response and log the request.

    The log line names the route template, never the raw path or query
    string, so search text and game IDs stay out of the logs.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        supplied_request_id = request.headers.get(REQUEST_ID_HEADER)
        request_id = (
            supplied_request_id
            if supplied_request_id and REQUEST_ID_PATTERN.fullmatch(supplied_request_id)
            else str(uuid4())
        )
        request.state.request_id = request_id

        started = perf_counter()
        with request_scope(request_id) as telemetry, record_cache_outcomes() as cache:
            try:
                response = await call_next(request)
            except Exception:
                # The server-error handler outside this middleware answers 500
                # and re-raises; the request still gets its log line.
                _log_request(request, 500, started, telemetry, cache)
                raise
            _log_request(request, response.status_code, started, telemetry, cache)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


def _log_request(
    request: Request,
    status: int,
    started: float,
    telemetry: RequestTelemetry,
    cache: list[CacheOutcome],
) -> None:
    route = request.scope.get("route")
    # FastAPI records the route as declared, relative to the API prefix every
    # public router is included under.
    template = (
        f"{getattr(request.app.state, 'api_prefix', '')}{route.path}"
        if route is not None and hasattr(route, "path")
        else "unmatched"
    )
    circuit = getattr(request.app.state, "provider_circuit", None)
    logger.info(
        "http.request",
        extra={
            "method": request.method,
            "route": template,
            "status": status,
            "duration_ms": round((perf_counter() - started) * 1000, 1),
            "cache": [outcome.value for outcome in cache],
            "provider_attempts": telemetry.provider_attempts,
            "provider_wait_ms": round(telemetry.provider_wait_ms, 1),
            "rate_limit": telemetry.rate_limit,
            "circuit": circuit.state.value if circuit is not None else "not-configured",
        },
    )

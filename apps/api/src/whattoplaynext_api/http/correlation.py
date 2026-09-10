"""Request correlation at the public HTTP edge."""

from collections.abc import Awaitable, Callable
from re import compile as compile_pattern
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

REQUEST_ID_HEADER = "X-Request-ID"
REQUEST_ID_PATTERN = compile_pattern(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")


class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    """Attach one request identifier to every HTTP response."""

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

        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response

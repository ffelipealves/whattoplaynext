"""Security headers for every API response."""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# The API serves JSON to one server-side caller. Nothing it returns should be
# rendered, framed, sniffed, cached by default, or embedded by another origin.
API_SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}
STRICT_TRANSPORT_SECURITY = "max-age=31536000; includeSubDomains"
# Swagger UI and ReDoc load their own scripts and styles; they exist only
# outside production (see create_app), so they keep their default headers.
INTERACTIVE_DOCUMENTATION = ("/docs", "/redoc")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add the API's security headers; HSTS only where HTTPS is guaranteed."""

    def __init__(self, app: object, *, strict_transport: bool) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._strict_transport = strict_transport

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)
        if request.url.path.startswith(INTERACTIVE_DOCUMENTATION):
            return response
        response.headers.update(API_SECURITY_HEADERS)
        response.headers.setdefault("Cache-Control", "no-store")
        if self._strict_transport:
            response.headers["Strict-Transport-Security"] = STRICT_TRANSPORT_SECURITY
        return response

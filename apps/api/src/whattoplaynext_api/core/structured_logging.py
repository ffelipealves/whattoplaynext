"""Structured JSON logs that can only carry allow-listed fields."""

import json
import logging
import sys
import traceback
from datetime import UTC, datetime
from pathlib import Path
from typing import TextIO

from whattoplaynext_api.core.telemetry import current_request_id

# The only ``extra`` fields a log line may carry, mapped to their JSON names.
# Anything else passed as ``extra`` is dropped, so a careless call site cannot
# leak a query value, an address, a payload, or a secret into the logs.
ALLOWED_FIELDS = {
    "cache": "cache",
    "circuit": "circuit",
    "duration_ms": "durationMs",
    "error_code": "errorCode",
    "method": "method",
    "open_seconds": "openSeconds",
    "provider_attempts": "providerAttempts",
    "provider_wait_ms": "providerWaitMs",
    "rate_limit": "rateLimit",
    "reason": "reason",
    # For code that runs outside the request scope, such as the server-error
    # handler; it overrides the scope's identifier.
    "request_id": "requestId",
    "resource": "resource",
    "route": "route",
    "status": "status",
}

_HANDLER_MARK = "_whattoplaynext_json"


class JsonFormatter(logging.Formatter):
    """One JSON object per line; exceptions keep their type and stack only."""

    def format(self, record: logging.LogRecord) -> str:
        line: dict[str, object] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "event": record.getMessage(),
        }
        request_id = current_request_id()
        if request_id is not None:
            line["requestId"] = request_id
        for attribute, name in ALLOWED_FIELDS.items():
            if attribute in record.__dict__:
                line[name] = record.__dict__[attribute]
        if record.exc_info and record.exc_info[0] is not None:
            error_type, _, trace = record.exc_info
            # The message is left out on purpose: exception text can quote
            # provider payloads or request values.
            line["exceptionType"] = error_type.__name__
            line["stack"] = [
                f"{Path(frame.filename).name}:{frame.lineno}:{frame.name}"
                for frame in traceback.extract_tb(trace)
            ]
        return json.dumps(line, default=str, separators=(",", ":"))


def configure_logging(stream: TextIO = sys.stdout, level: int = logging.INFO) -> None:
    """Route every log through one JSON handler; safe to call repeatedly.

    Uvicorn's access log is switched off: it prints the client address and the
    full URL with its query string, and ``http.request`` replaces it. HTTPX's
    per-request INFO lines are unstructured duplicates of provider telemetry.
    """
    root = logging.getLogger()
    for handler in [h for h in root.handlers if getattr(h, _HANDLER_MARK, False)]:
        root.removeHandler(handler)
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    setattr(handler, _HANDLER_MARK, True)
    root.addHandler(handler)
    root.setLevel(level)

    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True
    for name in ("httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)

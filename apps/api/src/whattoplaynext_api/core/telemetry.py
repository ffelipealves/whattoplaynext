"""What one request did, collected while it runs, for its log line."""

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field


@dataclass
class RequestTelemetry:
    """Safe, aggregate facts about one request: no values, no addresses."""

    request_id: str
    provider_attempts: list[str] = field(default_factory=list)
    provider_wait_ms: float = 0.0
    rate_limit: str = "not-applied"


_current: ContextVar[RequestTelemetry | None] = ContextVar(
    "request_telemetry", default=None
)


@contextmanager
def request_scope(request_id: str) -> Iterator[RequestTelemetry]:
    """Collect telemetry for everything this context does."""
    telemetry = RequestTelemetry(request_id=request_id)
    token = _current.set(telemetry)
    try:
        yield telemetry
    finally:
        _current.reset(token)


def current_request_id() -> str | None:
    telemetry = _current.get()
    return telemetry.request_id if telemetry is not None else None


def record_provider_attempt(outcome: str) -> None:
    """Note one provider attempt: ``ok``, a failure class, or a refusal."""
    telemetry = _current.get()
    if telemetry is not None:
        telemetry.provider_attempts.append(outcome)


def record_provider_wait(seconds: float) -> None:
    """Note time spent waiting for a turn under the provider ceiling."""
    telemetry = _current.get()
    if telemetry is not None:
        telemetry.provider_wait_ms += seconds * 1000


def record_rate_limit(decision: str) -> None:
    """Note the per-visitor rate-limit decision for this request."""
    telemetry = _current.get()
    if telemetry is not None:
        telemetry.rate_limit = decision

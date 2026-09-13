import type { components } from "@whattoplaynext/contracts";

type PublishedErrorCode = components["schemas"]["ErrorCode"];

/**
 * Every failure state this application can tell apart: the API's own stable
 * codes plus the two it cannot express — a request that never reached the
 * service, and a response that did not carry the published envelope at all
 * (a proxy's own error page, say).
 */
export type ApiFailureCode = PublishedErrorCode | "UNREACHABLE" | "UNKNOWN";

export type ApiFailure = {
  code: ApiFailureCode;
  /** Present when the API asks the caller to wait before retrying. */
  retryAfterSeconds?: number;
  /** The API's correlation id, worth showing so a report can be traced. */
  requestId?: string;
};

const PUBLISHED_CODES = new Set<string>([
  "GAME_NOT_FOUND",
  "INTERNAL_ERROR",
  "INVALID_QUERY",
  "METHOD_NOT_ALLOWED",
  "NOT_FOUND",
  "RATE_LIMITED",
  "UPSTREAM_INVALID_RESPONSE",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_UNAVAILABLE",
  "VALIDATION_ERROR",
] satisfies PublishedErrorCode[]);

/** The API process itself was never reached: no envelope exists to classify. */
export const UNREACHABLE: ApiFailure = { code: "UNREACHABLE" };

function detailOf(error: unknown): Record<string, unknown> | undefined {
  const detail = (error as { error?: unknown } | null)?.error;
  return typeof detail === "object" && detail !== null
    ? (detail as Record<string, unknown>)
    : undefined;
}

function retryAfterFrom(
  detail: Record<string, unknown> | undefined,
  response: Response | undefined,
): number | undefined {
  const published = detail?.retryAfterSeconds;
  if (typeof published === "number" && Number.isFinite(published)) {
    return published;
  }
  // The API sends the same value as a header; an HTTP-date form is valid there
  // but carries no seconds to show, so it is left out rather than guessed at.
  const header = Number(response?.headers.get("Retry-After"));
  return Number.isInteger(header) && header >= 0 ? header : undefined;
}

/**
 * Turns one API error response into a failure state the UI can speak about.
 * Anything that is not the published envelope collapses to `UNKNOWN` rather
 * than being reported as something more specific than it is.
 */
export function classifyApiFailure(
  error: unknown,
  response?: Response,
): ApiFailure {
  const detail = detailOf(error);
  const code = detail?.code;

  return {
    code:
      typeof code === "string" && PUBLISHED_CODES.has(code)
        ? (code as PublishedErrorCode)
        : "UNKNOWN",
    retryAfterSeconds: retryAfterFrom(detail, response),
    requestId:
      typeof detail?.requestId === "string" ? detail.requestId : undefined,
  };
}

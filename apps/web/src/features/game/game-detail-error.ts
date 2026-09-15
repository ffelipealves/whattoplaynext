import { isApiFailureCode, type ApiFailure } from "@/lib/api-failure";

const DIGEST_PREFIX = "WTPN_GAME_DETAIL:";

type BoundaryError = Error & { digest?: string };

/**
 * Next.js strips Server Component error messages in production but preserves
 * their digest for the nearest error boundary. Only allow-listed public
 * failure fields cross that boundary; provider details never do.
 */
export function gameDetailError(failure: ApiFailure): BoundaryError {
  const details = new URLSearchParams();
  if (failure.retryAfterSeconds !== undefined) {
    details.set("retryAfterSeconds", String(failure.retryAfterSeconds));
  }
  if (failure.requestId) {
    details.set("requestId", failure.requestId);
  }
  const suffix = details.size > 0 ? `?${details}` : "";

  return Object.assign(new Error("Could not load game detail"), {
    digest: `${DIGEST_PREFIX}${failure.code}${suffix}`,
  });
}

export function failureFromGameDetailError(error: BoundaryError): ApiFailure {
  const payload = error.digest?.startsWith(DIGEST_PREFIX)
    ? error.digest.slice(DIGEST_PREFIX.length)
    : "";
  const separator = payload.indexOf("?");
  const code = separator === -1 ? payload : payload.slice(0, separator);

  if (!isApiFailureCode(code)) {
    return { code: "UNKNOWN" };
  }

  const details = new URLSearchParams(
    separator === -1 ? "" : payload.slice(separator + 1),
  );
  const rawRetryAfter = details.get("retryAfterSeconds");
  const retryAfter = rawRetryAfter === null ? undefined : Number(rawRetryAfter);
  const requestId = details.get("requestId") || undefined;

  return {
    code,
    retryAfterSeconds:
      retryAfter !== undefined &&
      Number.isInteger(retryAfter) &&
      retryAfter >= 0
        ? retryAfter
        : undefined,
    requestId,
  };
}

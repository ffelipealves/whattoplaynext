import { useTranslations } from "next-intl";

import type { ApiFailure, ApiFailureCode } from "@/lib/api-failure";
import { Link } from "@/i18n/navigation";

import { withBrowseParams, type BrowseParams } from "./browse-params";

type SearchFailureProps = {
  failure: ApiFailure;
  /** The criteria to retry with: the same search, requested again. */
  params: BrowseParams;
};

type FailureCopy = { title: string; description: string };

/**
 * One distinct explanation per state the API can report. Codes this surface
 * cannot produce (a missing game, a rejected method) share the generic copy
 * rather than inventing an explanation that would never be seen.
 */
const COPY: Record<ApiFailureCode, FailureCopy> = {
  VALIDATION_ERROR: {
    title: "validationTitle",
    description: "validationDescription",
  },
  INVALID_QUERY: {
    title: "validationTitle",
    description: "validationDescription",
  },
  RATE_LIMITED: {
    title: "rateLimitedTitle",
    description: "rateLimitedDescription",
  },
  UPSTREAM_UNAVAILABLE: {
    title: "unavailableTitle",
    description: "unavailableDescription",
  },
  UPSTREAM_TIMEOUT: {
    title: "timeoutTitle",
    description: "timeoutDescription",
  },
  UPSTREAM_INVALID_RESPONSE: {
    title: "invalidResponseTitle",
    description: "invalidResponseDescription",
  },
  UNREACHABLE: {
    title: "unreachableTitle",
    description: "unreachableDescription",
  },
  INTERNAL_ERROR: { title: "genericTitle", description: "genericDescription" },
  GAME_NOT_FOUND: { title: "genericTitle", description: "genericDescription" },
  NOT_FOUND: { title: "genericTitle", description: "genericDescription" },
  METHOD_NOT_ALLOWED: {
    title: "genericTitle",
    description: "genericDescription",
  },
  UNKNOWN: { title: "genericTitle", description: "genericDescription" },
};

/**
 * Repeating a query the API rejected cannot change the answer: the visitor has
 * to change the criteria instead, so those states get no retry affordance.
 */
const REJECTED_CRITERIA: ReadonlySet<ApiFailureCode> = new Set([
  "VALIDATION_ERROR",
  "INVALID_QUERY",
]);

// INTERNAL_ERROR is deliberately absent from the distinct titles above but
// still recoverable: retrying a server-side fault is reasonable.
export function SearchFailure({ failure, params }: SearchFailureProps) {
  const t = useTranslations("Failure");
  const copy = COPY[failure.code];
  const isRecoverable = !REJECTED_CRITERIA.has(failure.code);

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl border border-[#17203a]/15 bg-white px-6 py-16 text-center"
      role="alert"
    >
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        {t(copy.title)}
      </h2>
      <p className="text-sm text-[#17203a]/65">{t(copy.description)}</p>

      {failure.retryAfterSeconds !== undefined && (
        <p className="text-sm font-semibold text-[#17203a]/75">
          {t("rateLimitedRetryIn", { seconds: failure.retryAfterSeconds })}
        </p>
      )}

      {isRecoverable && (
        // Spelling the criteria out keeps every applied filter on the retry
        // and makes this a real link: an empty href is not exposed as one.
        <Link
          className="mt-2 text-sm font-semibold text-[#3157d5] underline underline-offset-4"
          href={{ pathname: "/games", query: withBrowseParams(params, {}) }}
        >
          {t("retryLabel")}
        </Link>
      )}

      {failure.requestId && (
        <p className="mt-2 text-xs text-[#17203a]/45">
          {t("requestIdLabel", { requestId: failure.requestId })}
        </p>
      )}
    </div>
  );
}

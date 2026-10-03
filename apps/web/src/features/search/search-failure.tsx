import { useTranslations } from "next-intl";

import type { ApiFailure } from "@/lib/api-failure";
import { failureCopy, isRecoverableFailure } from "@/lib/failure-presentation";
import { Link } from "@/i18n/navigation";

import { withBrowseParams, type BrowseParams } from "./browse-params";

type SearchFailureProps = {
  failure: ApiFailure;
  /** The criteria to retry with: the same search, requested again. */
  params: BrowseParams;
};

export function SearchFailure({ failure, params }: SearchFailureProps) {
  const t = useTranslations("Failure");
  const copy = failureCopy(failure.code);
  const isRecoverable = isRecoverableFailure(failure.code);

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-16 text-center"
      role="alert"
    >
      <meta content="noindex" name="robots" />
      <h2 className="font-display text-lg font-semibold">{t(copy.title)}</h2>
      <p className="text-sm text-muted-foreground">{t(copy.description)}</p>

      {failure.retryAfterSeconds !== undefined && (
        <p className="text-sm font-semibold text-muted-foreground">
          {t("rateLimitedRetryIn", { seconds: failure.retryAfterSeconds })}
        </p>
      )}

      {isRecoverable && (
        // Spelling the criteria out keeps every applied filter on the retry
        // and makes this a real link: an empty href is not exposed as one.
        <Link
          className="mt-2 text-sm font-semibold text-primary underline underline-offset-4"
          href={{ pathname: "/", query: withBrowseParams(params, {}) }}
        >
          {t("retryLabel")}
        </Link>
      )}

      {failure.requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("requestIdLabel", { requestId: failure.requestId })}
        </p>
      )}
    </div>
  );
}

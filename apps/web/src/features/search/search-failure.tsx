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
      className="flex flex-col items-center gap-2 rounded-2xl border border-[#17203a]/15 bg-white px-6 py-16 text-center"
      role="alert"
    >
      <meta content="noindex" name="robots" />
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        {t(copy.title)}
      </h2>
      <p className="text-sm text-[#17203a]/75">{t(copy.description)}</p>

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
        <p className="mt-2 text-xs text-[#17203a]/75">
          {t("requestIdLabel", { requestId: failure.requestId })}
        </p>
      )}
    </div>
  );
}

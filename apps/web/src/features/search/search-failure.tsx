import { useTranslations } from "next-intl";
import { CloudOffIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

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
      className="flex flex-col items-center gap-2 rounded-3xl border border-ink-700 bg-card px-6 py-20 text-center"
      role="alert"
    >
      <meta content="noindex" name="robots" />
      <span
        aria-hidden
        className="mb-3 grid size-14 place-items-center rounded-2xl bg-ink-850 text-ember-400"
      >
        <CloudOffIcon className="size-6" />
      </span>
      <h2 className="font-display text-2xl font-bold text-ink-50">
        {t(copy.title)}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {t(copy.description)}
      </p>

      {failure.retryAfterSeconds !== undefined && (
        <p className="text-sm font-semibold text-muted-foreground">
          {t("rateLimitedRetryIn", { seconds: failure.retryAfterSeconds })}
        </p>
      )}

      {isRecoverable && (
        // Spelling the criteria out keeps every applied filter on the retry
        // and makes this a real link: an empty href is not exposed as one.
        <Link
          className={buttonVariants({ className: "mt-4", variant: "outline" })}
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

"use client";

import { useTranslations } from "next-intl";
import { CloudOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ApiFailure } from "@/lib/api-failure";
import { failureCopy, isRecoverableFailure } from "@/lib/failure-presentation";
import { GameFailureAnalytics } from "@/features/analytics/trackers";

type GameDetailFailureProps = {
  failure: ApiFailure;
  retry: () => void;
};

/**
 * Why a game could not be shown, and a retry when one could help. The page
 * and the modal share it; only the frame around it differs.
 */
export function GameFailureNotice({
  failure,
  retry,
  headingLevel = 1,
}: GameDetailFailureProps & { headingLevel?: 1 | 2 }) {
  const t = useTranslations("Failure");
  const copy = failureCopy(failure.code);
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-3xl border border-ink-700 bg-card px-6 py-20 text-center"
      role="alert"
    >
      <GameFailureAnalytics code={failure.code} />
      <span
        aria-hidden
        className="mb-3 grid size-14 place-items-center rounded-2xl bg-ink-850 text-ember-400"
      >
        <CloudOffIcon className="size-6" />
      </span>
      <Heading className="font-display text-2xl font-bold text-ink-50">
        {t(copy.title)}
      </Heading>
      <p className="max-w-md text-sm text-muted-foreground">
        {t(copy.description)}
      </p>
      {failure.retryAfterSeconds !== undefined && (
        <p className="text-sm font-semibold text-muted-foreground">
          {t("rateLimitedRetryIn", {
            seconds: failure.retryAfterSeconds,
          })}
        </p>
      )}
      {isRecoverableFailure(failure.code) && (
        <Button
          className="mt-4"
          onClick={retry}
          type="button"
          variant="outline"
        >
          {t("retryLabel")}
        </Button>
      )}
      {failure.requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("requestIdLabel", { requestId: failure.requestId })}
        </p>
      )}
    </div>
  );
}

export function GameDetailFailure({ failure, retry }: GameDetailFailureProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <meta content="noindex" name="robots" />
      <GameFailureNotice failure={failure} retry={retry} />
    </main>
  );
}

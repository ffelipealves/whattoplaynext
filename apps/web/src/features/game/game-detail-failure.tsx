"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ApiFailure } from "@/lib/api-failure";
import { failureCopy, isRecoverableFailure } from "@/lib/failure-presentation";
import { GameFailureAnalytics } from "@/features/analytics/trackers";

type GameDetailFailureProps = {
  failure: ApiFailure;
  retry: () => void;
};

export function GameDetailFailure({ failure, retry }: GameDetailFailureProps) {
  const t = useTranslations("Failure");
  const copy = failureCopy(failure.code);

  return (
    <main className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
      <GameFailureAnalytics code={failure.code} />
      <meta content="noindex" name="robots" />
      <div
        className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-16 text-center"
        role="alert"
      >
        <h1 className="font-display text-lg font-semibold">{t(copy.title)}</h1>
        <p className="text-sm text-muted-foreground">{t(copy.description)}</p>
        {failure.retryAfterSeconds !== undefined && (
          <p className="text-sm font-semibold text-muted-foreground">
            {t("rateLimitedRetryIn", {
              seconds: failure.retryAfterSeconds,
            })}
          </p>
        )}
        {isRecoverableFailure(failure.code) && (
          <Button className="mt-3" onClick={retry} type="button">
            {t("retryLabel")}
          </Button>
        )}
        {failure.requestId && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("requestIdLabel", { requestId: failure.requestId })}
          </p>
        )}
      </div>
    </main>
  );
}

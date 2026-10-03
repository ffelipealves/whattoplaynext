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

export function GameDetailFailure({ failure, retry }: GameDetailFailureProps) {
  const t = useTranslations("Failure");
  const copy = failureCopy(failure.code);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <GameFailureAnalytics code={failure.code} />
      <meta content="noindex" name="robots" />
      <div
        className="flex flex-col items-center gap-2 rounded-3xl border border-ink-700 bg-card px-6 py-20 text-center"
        role="alert"
      >
        <span
          aria-hidden
          className="mb-3 grid size-14 place-items-center rounded-2xl bg-ink-850 text-ember-400"
        >
          <CloudOffIcon className="size-6" />
        </span>
        <h1 className="font-display text-2xl font-bold text-ink-50">
          {t(copy.title)}
        </h1>
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
    </main>
  );
}

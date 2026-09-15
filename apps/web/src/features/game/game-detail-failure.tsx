"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ApiFailure } from "@/lib/api-failure";
import { failureCopy, isRecoverableFailure } from "@/lib/failure-presentation";

type GameDetailFailureProps = {
  failure: ApiFailure;
  retry: () => void;
};

export function GameDetailFailure({ failure, retry }: GameDetailFailureProps) {
  const t = useTranslations("Failure");
  const copy = failureCopy(failure.code);

  return (
    <main className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
      <meta content="noindex" name="robots" />
      <div
        className="flex flex-col items-center gap-2 rounded-2xl border border-[#17203a]/15 bg-white px-6 py-16 text-center"
        role="alert"
      >
        <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          {t(copy.title)}
        </h1>
        <p className="text-sm text-[#17203a]/65">{t(copy.description)}</p>
        {failure.retryAfterSeconds !== undefined && (
          <p className="text-sm font-semibold text-[#17203a]/75">
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
          <p className="mt-2 text-xs text-[#17203a]/45">
            {t("requestIdLabel", { requestId: failure.requestId })}
          </p>
        )}
      </div>
    </main>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { CompassIcon } from "lucide-react";

import type { ApiFailure } from "@/lib/api-failure";
import { useRouter } from "@/i18n/navigation";

import { GameFailureNotice } from "./game-detail-failure";

/** A game the modal could not show: not found, or a failure worth retrying. */
export function GameModalFailure({ failure }: { failure: ApiFailure }) {
  const t = useTranslations("Game");
  const router = useRouter();

  if (failure.code === "GAME_NOT_FOUND") {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
        <span
          aria-hidden
          className="mb-3 grid size-14 place-items-center rounded-2xl bg-ink-850 text-ember-400"
        >
          <CompassIcon className="size-6" />
        </span>
        <h2 className="font-display text-2xl font-bold text-ink-50">
          {t("notFoundTitle")}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("notFoundDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 pt-16 sm:p-8 sm:pt-16">
      <GameFailureNotice
        failure={failure}
        headingLevel={2}
        retry={() => router.refresh()}
      />
    </div>
  );
}

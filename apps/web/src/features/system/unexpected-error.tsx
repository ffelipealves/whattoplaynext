"use client";

import { useTranslations } from "next-intl";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type UnexpectedErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export function UnexpectedError({ retry }: UnexpectedErrorProps) {
  const t = useTranslations("System");

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <meta content="noindex" name="robots" />
      <div
        className="flex flex-col items-center gap-2 rounded-3xl border border-ink-700 bg-card px-6 py-20 text-center"
        role="alert"
      >
        <span
          aria-hidden
          className="mb-3 grid size-14 place-items-center rounded-2xl bg-ink-850 text-ember-400"
        >
          <TriangleAlertIcon className="size-6" />
        </span>
        <h1 className="font-display text-2xl font-bold text-ink-50">
          {t("unexpectedTitle")}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("unexpectedDescription")}
        </p>
        <Button
          className="mt-4"
          onClick={retry}
          type="button"
          variant="outline"
        >
          {t("retryLabel")}
        </Button>
      </div>
    </main>
  );
}

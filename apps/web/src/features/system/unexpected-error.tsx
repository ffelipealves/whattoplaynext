"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type UnexpectedErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export function UnexpectedError({ retry }: UnexpectedErrorProps) {
  const t = useTranslations("System");

  return (
    <main className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
      <meta content="noindex" name="robots" />
      <div
        className="flex flex-col items-center gap-2 rounded-2xl border border-[#17203a]/15 bg-white px-6 py-16 text-center"
        role="alert"
      >
        <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          {t("unexpectedTitle")}
        </h1>
        <p className="text-sm text-[#17203a]/75">
          {t("unexpectedDescription")}
        </p>
        <Button className="mt-3" onClick={retry} type="button">
          {t("retryLabel")}
        </Button>
      </div>
    </main>
  );
}

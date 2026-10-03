"use client";

import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LINK_CLASS_NAME =
  "inline-flex h-11 shrink-0 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium text-ink-100 transition-colors hover:border-ink-700 sm:px-4";

function useAlternateLocale() {
  const locale = useLocale();
  return routing.locales.find((candidate) => candidate !== locale)!;
}

/** Switches language on the page being viewed, search included. */
function SamePageLink() {
  const alternateLocale = useAlternateLocale();
  const t = useTranslations("Locale");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query: Record<string, string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    query[key] = searchParams.getAll(key);
  }

  return (
    <Link
      className={LINK_CLASS_NAME}
      href={{ pathname, query }}
      locale={alternateLocale}
    >
      {t(alternateLocale)}
    </Link>
  );
}

export function LanguageSwitch() {
  const alternateLocale = useAlternateLocale();
  const t = useTranslations("Locale");

  return (
    <nav aria-label={t("navLabel")} className="ml-auto">
      <Suspense
        fallback={
          <Link className={LINK_CLASS_NAME} href="/" locale={alternateLocale}>
            {t(alternateLocale)}
          </Link>
        }
      >
        <SamePageLink />
      </Suspense>
    </nav>
  );
}

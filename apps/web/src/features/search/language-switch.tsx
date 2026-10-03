"use client";

import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { getPathname, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LINK_CLASS_NAME =
  "inline-flex h-11 shrink-0 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium text-ink-100 transition-colors hover:border-ink-700 sm:px-4";

function useAlternateLocale() {
  const locale = useLocale();
  return routing.locales.find((candidate) => candidate !== locale)!;
}

/**
 * A plain link, so switching language is a full page load: every message
 * changes anyway, and a client navigation from a game page to the same game
 * in the other language would otherwise be intercepted into the modal.
 */
function LanguageLink({ href }: { href: string }) {
  const alternateLocale = useAlternateLocale();
  const t = useTranslations("Locale");

  return (
    <a className={LINK_CLASS_NAME} href={href} hrefLang={alternateLocale}>
      {t(alternateLocale)}
    </a>
  );
}

/** Switches language on the page being viewed, search included. */
function SamePageLink() {
  const alternateLocale = useAlternateLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query: Record<string, string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    query[key] = searchParams.getAll(key);
  }

  return (
    <LanguageLink
      href={getPathname({ href: { pathname, query }, locale: alternateLocale })}
    />
  );
}

export function LanguageSwitch() {
  const alternateLocale = useAlternateLocale();
  const t = useTranslations("Locale");

  return (
    <nav aria-label={t("navLabel")} className="ml-auto">
      <Suspense
        fallback={
          <LanguageLink
            href={getPathname({ href: "/", locale: alternateLocale })}
          />
        }
      >
        <SamePageLink />
      </Suspense>
    </nav>
  );
}

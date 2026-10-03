import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** The site's name is the page heading: the home page is the search itself. */
export function SiteHeader() {
  const locale = useLocale();
  const t = useTranslations("Locale");

  const alternateLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  )!;

  return (
    <header className="flex items-center justify-between gap-4">
      <Link
        className="flex items-center gap-3 rounded-sm font-semibold tracking-[-0.02em]"
        href="/"
      >
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-full bg-primary font-display text-sm text-primary-foreground"
        >
          W
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          What To Play Next
        </h1>
      </Link>

      <nav aria-label={t("navLabel")}>
        <Link
          className="rounded-full border border-ink-700 px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:bg-ink-850"
          href="/"
          locale={alternateLocale}
        >
          {t(alternateLocale)}
        </Link>
      </nav>
    </header>
  );
}

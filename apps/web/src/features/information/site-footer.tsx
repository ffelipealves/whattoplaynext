import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function IgdbAttribution({ className = "" }: { className?: string }) {
  const t = useTranslations("Footer");

  return (
    <p className={className}>
      {t("attributionLead")}{" "}
      <a
        className="font-semibold text-ink-300 underline underline-offset-4 transition-colors hover:text-ember-300"
        href="https://www.igdb.com/"
      >
        IGDB
      </a>
      .
    </p>
  );
}

const FOOTER_LINK_CLASS_NAME =
  "text-ink-300 underline-offset-4 transition-colors hover:text-ember-300 hover:underline";

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-360 flex-col gap-5 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8">
        <div>
          <nav aria-label={t("informationNavLabel")}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
              <li>
                <Link className={FOOTER_LINK_CLASS_NAME} href="/about">
                  {t("aboutLink")}
                </Link>
              </li>
              <li>
                <Link className={FOOTER_LINK_CLASS_NAME} href="/privacy">
                  {t("privacyLink")}
                </Link>
              </li>
              <li>
                <Link className={FOOTER_LINK_CLASS_NAME} href="/terms">
                  {t("termsLink")}
                </Link>
              </li>
            </ul>
          </nav>
          <p className="mt-3">
            <span className="font-display font-bold text-ink-300">
              What To Play Next
            </span>{" "}
            — {t("draftStatus")}
          </p>
        </div>
        <IgdbAttribution />
      </div>
    </footer>
  );
}

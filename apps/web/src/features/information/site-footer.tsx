import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function IgdbAttribution({ className = "" }: { className?: string }) {
  const t = useTranslations("Footer");

  return (
    <p className={className}>
      {t("attributionLead")}{" "}
      <a
        className="font-semibold underline underline-offset-4"
        href="https://www.igdb.com/"
      >
        IGDB
      </a>
      .
    </p>
  );
}

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="border-t border-[#17203a]/15 bg-white px-5 py-8 text-[#17203a] sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[88rem] flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav aria-label={t("informationNavLabel")}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <li>
                <Link
                  className="underline-offset-4 hover:underline"
                  href="/about"
                >
                  {t("aboutLink")}
                </Link>
              </li>
              <li>
                <Link
                  className="underline-offset-4 hover:underline"
                  href="/privacy"
                >
                  {t("privacyLink")}
                </Link>
              </li>
              <li>
                <Link
                  className="underline-offset-4 hover:underline"
                  href="/terms"
                >
                  {t("termsLink")}
                </Link>
              </li>
            </ul>
          </nav>
          <p className="mt-3 text-xs text-[#17203a]/55">{t("draftStatus")}</p>
        </div>
        <IgdbAttribution className="text-sm text-[#17203a]/65" />
      </div>
    </footer>
  );
}

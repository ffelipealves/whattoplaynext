import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

import type { CatalogStatus } from "./get-catalog-status";

type LandingPageProps = {
  catalogStatus: CatalogStatus;
};

export function LandingPage({ catalogStatus }: LandingPageProps) {
  const locale = useLocale();
  const t = useTranslations("Landing");
  const localeName = useTranslations("Locale");

  const alternateLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  )!;

  const catalogStatusText = catalogStatus.reachable
    ? t("catalogOnline", {
        platforms: catalogStatus.platformCount,
        genres: catalogStatus.genreCount,
        modes: catalogStatus.gameModeCount,
      })
    : t("catalogOffline");

  const constraints = [
    {
      label: t("constraintPlatformLabel"),
      value: t("constraintPlatformValue"),
    },
    { label: t("constraintTimeLabel"), value: t("constraintTimeValue") },
    { label: t("constraintModeLabel"), value: t("constraintModeValue") },
    { label: t("constraintRatingLabel"), value: t("constraintRatingValue") },
  ];

  const principles = [
    {
      title: t("principleVisibleTitle"),
      description: t("principleVisibleDescription"),
    },
    {
      title: t("principleMissingTitle"),
      description: t("principleMissingDescription"),
    },
    {
      title: t("principleZeroTitle"),
      description: t("principleZeroDescription"),
    },
  ];

  return (
    <main className="catalog-grid min-h-screen overflow-hidden px-5 py-5 sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[88rem] flex-col overflow-hidden rounded-[2rem] border border-[#17203a]/15 bg-white shadow-[0_30px_90px_rgb(23_32_58_/_12%)]">
        <header className="flex items-center justify-between border-b border-[#17203a]/15 px-5 py-4 sm:px-8">
          <Link
            className="flex items-center gap-3 rounded-sm font-semibold tracking-[-0.02em]"
            href="/"
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#17203a] font-[family-name:var(--font-display)] text-sm text-white">
              W
            </span>
            <span>What To Play Next</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              className="rounded-full border border-[#17203a]/20 px-4 py-2 text-sm font-semibold transition-colors hover:border-[#3157d5] hover:bg-[#dce6fb]/50"
              href="/games"
            >
              {t("browseGamesLink")}
            </Link>

            <nav aria-label={t("languageNavLabel")}>
              <Link
                className="rounded-full border border-[#17203a]/20 px-4 py-2 text-sm font-semibold transition-colors hover:border-[#3157d5] hover:bg-[#dce6fb]/50"
                href="/"
                locale={alternateLocale}
              >
                {localeName(alternateLocale)}
              </Link>
            </nav>
          </div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[minmax(0,1.12fr)_minmax(24rem,0.88fr)]">
          <section className="flex flex-col justify-between px-6 py-12 sm:px-10 sm:py-16 lg:px-16 lg:py-20">
            <div>
              <p className="mb-8 flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-[#3157d5] uppercase">
                <span className="h-px w-10 bg-[#3157d5]" />
                {t("eyebrow")}
              </p>

              <h1
                aria-label={`${t("titleLead")} ${t("titleEmphasis")} ${t("titleEnd")}`}
                className="max-w-4xl font-[family-name:var(--font-display)] text-[clamp(3.7rem,8vw,8rem)] leading-[0.83] font-semibold tracking-[-0.075em]"
              >
                <span className="block">{t("titleLead")}</span>
                <span className="block text-[#3157d5]">
                  {t("titleEmphasis")}
                </span>
                <span className="block">{t("titleEnd")}</span>
              </h1>

              <p className="mt-9 max-w-2xl text-lg leading-8 text-[#17203a]/72 sm:text-xl">
                {t("description")}
              </p>

              <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <a
                  className="rounded-full bg-[#ff694f] px-6 py-3.5 font-bold text-[#17203a] shadow-[0_8px_0_#17203a] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_4px_0_#17203a]"
                  href="#criteria"
                >
                  {t("primaryAction")}
                </a>
                <p
                  aria-live="polite"
                  className="text-sm font-medium text-[#17203a]/62"
                >
                  {catalogStatusText}
                </p>
              </div>
            </div>

            <ol className="mt-16 grid gap-6 border-t border-[#17203a]/15 pt-8 sm:grid-cols-3">
              {principles.map((principle, index) => (
                <li key={principle.title}>
                  <p className="mb-3 text-xs font-bold tracking-[0.16em] text-[#3157d5]">
                    0{index + 1}
                  </p>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.025em]">
                    {principle.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#17203a]/75">
                    {principle.description}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <aside
            aria-label={t("exampleLabel")}
            className="relative flex min-h-[36rem] items-center justify-center overflow-hidden border-t border-[#17203a]/15 bg-[#3157d5] p-6 sm:p-10 lg:min-h-0 lg:border-t-0 lg:border-l"
            id="criteria"
          >
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,#fff_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative w-full max-w-xl rotate-[-1.5deg] rounded-[1.75rem] border-2 border-[#17203a] bg-[#f2f6ff] p-5 shadow-[14px_16px_0_#17203a] sm:p-7">
              <div className="mb-6 flex items-center justify-between border-b border-[#17203a]/20 pb-5">
                <p className="text-xs font-bold tracking-[0.18em] text-[#3157d5] uppercase">
                  {t("exampleLabel")}
                </p>
                <span className="rounded-full bg-[#17203a] px-3 py-1 text-[0.7rem] font-bold tracking-[0.14em] text-white uppercase">
                  {t("exampleBadge")}
                </span>
              </div>

              <dl className="space-y-3">
                {constraints.map((constraint) => (
                  <div
                    className="grid grid-cols-[7rem_1fr] items-center rounded-2xl border border-[#17203a]/15 bg-white px-4 py-4 sm:grid-cols-[8rem_1fr]"
                    key={constraint.label}
                  >
                    <dt className="text-xs font-bold tracking-[0.12em] text-[#17203a]/52 uppercase">
                      {constraint.label}
                    </dt>
                    <dd className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.02em]">
                      {constraint.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="relative mt-6 overflow-hidden rounded-2xl bg-[#17203a] px-5 py-5 text-white">
                <div className="constraint-scan absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[#ff694f]/45 to-transparent" />
                <p className="relative text-xs font-bold tracking-[0.13em] text-[#dce6fb]/70 uppercase">
                  {t("resultLabel")}
                </p>
                <p className="relative mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.03em]">
                  {t("resultValue")}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

import { useTranslations } from "next-intl";

import { ResultCard } from "./result-card";
import type { SearchResult } from "./get-search-results";

type ResultsGridProps = {
  result: SearchResult;
  name?: string;
  /**
   * Steers the zero-result advice: with filters applied, relaxing one of them
   * is the useful suggestion, not retyping the title.
   */
  hasActiveFilters?: boolean;
};

export function ResultsGrid({
  result,
  name,
  hasActiveFilters,
}: ResultsGridProps) {
  const t = useTranslations("Search");

  if (!result.ok) {
    return (
      <div
        className="flex flex-col items-center gap-2 rounded-2xl border border-[#17203a]/15 bg-white px-6 py-16 text-center"
        role="alert"
      >
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
          {t("errorTitle")}
        </p>
        <p className="text-sm text-[#17203a]/65">{t("errorDescription")}</p>
        <a
          className="mt-2 text-sm font-semibold text-[#3157d5] underline underline-offset-4"
          href=""
        >
          {t("retryLabel")}
        </a>
      </div>
    );
  }

  if (result.page.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#17203a]/15 bg-white px-6 py-16 text-center">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
          {name
            ? t("zeroResultsTitleWithName", { name })
            : t("zeroResultsTitle")}
        </p>
        <p className="text-sm text-[#17203a]/65">
          {hasActiveFilters
            ? t("zeroResultsFilterDescription")
            : t("zeroResultsDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {result.page.items.map((game) => (
        <ResultCard game={game} key={game.id} />
      ))}
    </div>
  );
}

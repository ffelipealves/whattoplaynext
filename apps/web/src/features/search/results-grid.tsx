import { useTranslations } from "next-intl";

import { activeFilters } from "./active-filters";
import { ResultCard } from "./result-card";
import { SearchFailure } from "./search-failure";
import type { BrowseParams } from "./browse-params";
import type { SearchResult } from "./get-search-results";

type ResultsGridProps = {
  result: SearchResult;
  /** The criteria behind this result: what to retry with, and what to
   * suggest relaxing when nothing matched. */
  params: BrowseParams;
};

export function ResultsGrid({ result, params }: ResultsGridProps) {
  const t = useTranslations("Search");

  if (!result.ok) {
    return <SearchFailure failure={result.failure} params={params} />;
  }

  const name = params.name;
  const hasActiveFilters = activeFilters(params).length > 0;

  if (result.page.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#17203a]/15 bg-white px-6 py-16 text-center">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
          {name
            ? t("zeroResultsTitleWithName", { name })
            : t("zeroResultsTitle")}
        </p>
        <p className="text-sm text-[#17203a]/75">
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

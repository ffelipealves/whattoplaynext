import { useTranslations } from "next-intl";
import { SearchXIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { activeFilters } from "./active-filters";
import { ResultCard, ResultRow } from "./result-card";
import { SearchFailure } from "./search-failure";
import {
  clearedFilters,
  withBrowseParams,
  type BrowseParams,
} from "./browse-params";
import type { SearchResult } from "./get-search-results";

type ResultsGridProps = {
  result: SearchResult;
  /** The criteria behind this result: what to retry with, and what to
   * suggest relaxing when nothing matched. */
  params: BrowseParams;
};

/**
 * An exact zero, said plainly, with the one change most likely to help as a
 * link: dropping the filters (keeping the name), or dropping the name when it
 * was the only criterion. Nothing approximate is shown in its place.
 */
function ZeroResults({ params }: { params: BrowseParams }) {
  const t = useTranslations("Search");
  const name = params.name;
  const hasActiveFilters = activeFilters(params).length > 0;

  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-700 px-6 py-20 text-center">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-2xl bg-ink-850 text-ember-400"
      >
        <SearchXIcon className="size-6" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-bold text-ink-50">
        {name ? t("zeroResultsTitleWithName", { name }) : t("zeroResultsTitle")}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasActiveFilters
          ? t("zeroResultsFilterDescription")
          : t("zeroResultsDescription")}
      </p>
      {(hasActiveFilters || name) && (
        <Link
          className={buttonVariants({ className: "mt-6" })}
          href={{
            pathname: "/",
            query: withBrowseParams(
              params,
              hasActiveFilters
                ? { ...clearedFilters(), page: 1 }
                : { name: undefined, page: 1 },
            ),
          }}
        >
          {hasActiveFilters
            ? name
              ? t("zeroResultsWithoutFilters", { name })
              : t("zeroResultsClearFilters")
            : t("zeroResultsShowAll")}
        </Link>
      )}
    </div>
  );
}

export function ResultsGrid({ result, params }: ResultsGridProps) {
  if (!result.ok) {
    return <SearchFailure failure={result.failure} params={params} />;
  }

  if (result.page.items.length === 0) {
    return <ZeroResults params={params} />;
  }

  if (params.view === "list") {
    return (
      <ul className="flex flex-col gap-3">
        {result.page.items.map((game) => (
          <li key={game.id}>
            <ResultRow game={game} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4 2xl:grid-cols-5">
      {result.page.items.map((game) => (
        <li className="flex" key={game.id}>
          <div className="w-full">
            <ResultCard game={game} />
          </div>
        </li>
      ))}
    </ul>
  );
}

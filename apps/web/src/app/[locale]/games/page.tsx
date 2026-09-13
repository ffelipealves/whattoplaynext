import { getTranslations } from "next-intl/server";

import { getFilterMetadata } from "@/features/catalog/get-filter-metadata";
import { ActiveFilterChips } from "@/features/search/active-filter-chips";
import { activeFilters } from "@/features/search/active-filters";
import {
  filterBoundsFrom,
  parseBrowseParams,
} from "@/features/search/browse-params";
import { DurationNotice } from "@/features/search/duration-notice";
import { FilterDrawer } from "@/features/search/filter-drawer";
import { FilterSidebar } from "@/features/search/filter-sidebar";
import { getSearchResults } from "@/features/search/get-search-results";
import { NameSearchForm } from "@/features/search/name-search-form";
import { PaginationLinks } from "@/features/search/pagination-links";
import { ResultsGrid } from "@/features/search/results-grid";
import { SortLinks } from "@/features/search/sort-links";

export const dynamic = "force-dynamic";

export default async function GamesPage({
  searchParams,
}: PageProps<"/[locale]/games">) {
  // The filter metadata publishes the allow-listed ids and bounds the URL is
  // validated against, so it is read before the criteria are parsed (it is a
  // long-cached catalog call) rather than alongside the results.
  const [rawSearchParams, filters] = await Promise.all([
    searchParams,
    getFilterMetadata(),
  ]);
  const metadata = filters.ok ? filters.metadata : undefined;
  const params = parseBrowseParams(
    rawSearchParams,
    metadata && filterBoundsFrom(metadata),
  );
  const result = await getSearchResults(params);
  const t = await getTranslations("Search");
  const hasActiveFilters = activeFilters(params).length > 0;
  const durationWasNarrowed =
    result.ok && Boolean(result.page.meta.excludedUnknownDuration);

  return (
    <main className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-[-0.02em]">
        {t("heading")}
      </h1>

      <div className="mt-6">
        <NameSearchForm
          minimumQueryLength={metadata?.limits.minimumAutocompleteLength}
          params={params}
        />
      </div>

      <div className="mt-8 flex gap-8">
        <FilterSidebar metadata={metadata} params={params} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <FilterDrawer metadata={metadata} params={params} />
              <SortLinks params={params} />
            </div>
            {result.ok && (
              <p className="text-sm font-semibold text-[#17203a]/60">
                {t("resultsCount", {
                  count: result.page.pagination.totalItems,
                })}
              </p>
            )}
          </div>

          {(hasActiveFilters || durationWasNarrowed) && (
            <div className="mt-4 space-y-4">
              <ActiveFilterChips metadata={metadata} params={params} />
              {result.ok && <DurationNotice meta={result.page.meta} />}
            </div>
          )}

          <div className="mt-6">
            <ResultsGrid
              hasActiveFilters={hasActiveFilters}
              name={params.name}
              result={result}
            />
          </div>

          {result.ok && (
            <div className="mt-8">
              <PaginationLinks
                params={params}
                totalPages={result.page.pagination.totalPages}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

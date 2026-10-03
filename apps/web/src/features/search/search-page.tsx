import { useTranslations } from "next-intl";

import type { FilterMetadataResult } from "@/features/catalog/get-filter-metadata";
import { StaleDataNotice } from "@/features/catalog/stale-data-notice";
import { SearchAnalytics } from "@/features/analytics/trackers";
import type { FilterCategory } from "@/features/analytics/events";

import { ActiveFilterChips } from "./active-filter-chips";
import { activeFilters } from "./active-filters";
import { DurationNotice } from "./duration-notice";
import { FilterDrawer } from "./filter-drawer";
import { FilterSidebar } from "./filter-sidebar";
import { IgnoredCriteria } from "./ignored-criteria";
import { NameSearchForm } from "./name-search-form";
import { PaginationLinks } from "./pagination-links";
import { ResultsGrid } from "./results-grid";
import { SiteHeader } from "./site-header";
import { SortLinks } from "./sort-links";
import type { BrowseParamIssue, BrowseParams } from "./browse-params";
import type { SearchResult } from "./get-search-results";

type SearchPageProps = {
  params: BrowseParams;
  issues: BrowseParamIssue[];
  result: SearchResult;
  filters: FilterMetadataResult;
};

/**
 * Everything the search route renders, given data someone else fetched.
 *
 * Split from the route so the whole page — both layouts, every state — can be
 * rendered in a test and checked for accessibility as it actually ships,
 * rather than against a rebuilt approximation of it.
 */
export function SearchPage({
  params,
  issues,
  result,
  filters,
}: SearchPageProps) {
  const t = useTranslations("Search");
  const metadata = filters.ok ? filters.metadata : undefined;
  const hasActiveFilters = activeFilters(params).length > 0;
  const durationWasNarrowed =
    result.ok && Boolean(result.page.meta.excludedUnknownDuration);

  return (
    <main className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-12">
      <SearchAnalytics
        categories={filterCategories(params)}
        direction={params.direction}
        filtersFailure={filters.ok ? undefined : filters.failure.code}
        result={
          result.ok
            ? {
                ok: true,
                totalItems: result.page.pagination.totalItems,
                stale: result.page.meta.dataMayBeStale,
              }
            : { ok: false, code: result.failure.code }
        }
        searchKey={searchKey(params)}
        sort={params.sort}
      />
      <SiteHeader />

      {issues.length > 0 && (
        <div className="mt-6">
          <IgnoredCriteria issues={issues} />
        </div>
      )}

      <div className="mt-6">
        <NameSearchForm
          minimumQueryLength={metadata?.limits.minimumAutocompleteLength}
          params={params}
        />
      </div>

      <div className="mt-8 flex gap-8">
        <FilterSidebar filters={filters} params={params} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <FilterDrawer filters={filters} params={params} />
              <SortLinks params={params} />
            </div>
            {/* Applying a filter is a client navigation: without a live
                region the results change with nothing said about it. The
                region is always present so a later change is announced. */}
            <p
              aria-live="polite"
              className="text-sm font-semibold text-[#17203a]/75"
              role="status"
            >
              {result.ok
                ? t("resultsCount", {
                    count: result.page.pagination.totalItems,
                  })
                : ""}
            </p>
          </div>

          {(hasActiveFilters || durationWasNarrowed) && (
            <div className="mt-4 space-y-4">
              <ActiveFilterChips metadata={metadata} params={params} />
              {result.ok && <DurationNotice meta={result.page.meta} />}
            </div>
          )}

          {result.ok && result.page.meta.dataMayBeStale && (
            <div className="mt-4">
              <StaleDataNotice meta={result.page.meta} />
            </div>
          )}

          <div className="mt-6">
            <ResultsGrid params={params} result={result} />
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

/** Which kinds of criteria a search used, never their values. */
function filterCategories(params: BrowseParams): FilterCategory[] {
  const used: [FilterCategory, boolean][] = [
    ["name", Boolean(params.name)],
    ["platform", params.platformIds.length > 0],
    ["genre", params.genreIds.length > 0],
    ["release", Boolean(params.releaseFrom || params.releaseTo)],
    ["rating", params.minimumRating !== undefined],
    ["mode", params.gameModeIds.length > 0],
    [
      "duration",
      params.minimumDurationHours !== undefined ||
        params.maximumDurationHours !== undefined,
    ],
  ];
  return used.filter(([, isUsed]) => isUsed).map(([category]) => category);
}

/**
 * Identifies the submitted criteria so a new search can be told from a page
 * or sort change. Compared in the browser's memory only; never sent.
 */
function searchKey(params: BrowseParams): string {
  return JSON.stringify({
    ...params,
    page: undefined,
    sort: undefined,
    direction: undefined,
  });
}

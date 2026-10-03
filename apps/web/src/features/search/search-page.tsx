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
import { PaginationLinks } from "./pagination-links";
import { ResultsGrid } from "./results-grid";
import { SortLinks } from "./sort-links";
import {
  MAX_PAGE,
  type BrowseParamIssue,
  type BrowseParams,
} from "./browse-params";
import type { GamePage, SearchResult } from "./get-search-results";

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
  const applied = activeFilters(params);
  const hasActiveFilters = applied.length > 0;
  const durationWasNarrowed =
    result.ok && Boolean(result.page.meta.excludedUnknownDuration);
  // A lone genre names the page after itself, as a genre chip would.
  const onlyFilter = applied.length === 1 ? applied[0] : undefined;
  const genreId = onlyFilter?.kind === "genre" ? onlyFilter.id : undefined;
  const genreLabel = metadata?.genres.find(
    (genre) => genre.id === genreId,
  )?.label;
  const heading = params.name
    ? t("headingName", { name: params.name })
    : (genreLabel ??
      (hasActiveFilters ? t("headingFiltered") : t("headingAll")));

  return (
    <main className="mx-auto max-w-360 px-4 pb-16 sm:px-6 lg:px-8">
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

      <div className="mt-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:gap-14">
        <FilterSidebar filters={filters} params={params} />

        <section aria-labelledby="results-heading" className="min-w-0">
          <h1
            className="font-display text-3xl font-extrabold tracking-tight text-ink-50 sm:text-4xl"
            id="results-heading"
          >
            {heading}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {/* Applying a filter is a client navigation: without a live
                region the results change with nothing said about it. The
                region is always present so a later change is announced. */}
            <span aria-live="polite" role="status">
              {result.ok
                ? t.rich("resultsCount", {
                    count: result.page.pagination.totalItems,
                    number: (chunks) => (
                      <span className="font-mono text-ink-100 tabular-nums">
                        {chunks}
                      </span>
                    ),
                  })
                : ""}
            </span>
            {result.ok && reachablePages(result.page) > 1 && (
              <>
                {" · "}
                {t("pageStatus", {
                  page: result.page.pagination.page,
                  totalPages: reachablePages(result.page),
                })}
              </>
            )}
          </p>

          {issues.length > 0 && (
            <div className="mt-6">
              <IgnoredCriteria issues={issues} />
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <FilterDrawer filters={filters} params={params} />
            <SortLinks params={params} />
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
        </section>
      </div>
    </main>
  );
}

/** Only the first MAX_PAGE pages can be reached, so that is the count shown. */
function reachablePages(page: GamePage): number {
  return Math.min(page.pagination.totalPages, MAX_PAGE);
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

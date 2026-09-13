import { useTranslations } from "next-intl";

import type { FilterMetadata } from "@/features/catalog/get-filter-metadata";

import { ActiveFilterChips } from "./active-filter-chips";
import { activeFilters } from "./active-filters";
import { DurationNotice } from "./duration-notice";
import { FilterDrawer } from "./filter-drawer";
import { FilterSidebar } from "./filter-sidebar";
import { IgnoredCriteria } from "./ignored-criteria";
import { NameSearchForm } from "./name-search-form";
import { PaginationLinks } from "./pagination-links";
import { ResultsGrid } from "./results-grid";
import { SortLinks } from "./sort-links";
import type { BrowseParamIssue, BrowseParams } from "./browse-params";
import type { SearchResult } from "./get-search-results";

type SearchPageProps = {
  params: BrowseParams;
  issues: BrowseParamIssue[];
  result: SearchResult;
  /** Absent when `GET /api/v1/filters` failed for this request. */
  metadata?: FilterMetadata;
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
  metadata,
}: SearchPageProps) {
  const t = useTranslations("Search");
  const hasActiveFilters = activeFilters(params).length > 0;
  const durationWasNarrowed =
    result.ok && Boolean(result.page.meta.excludedUnknownDuration);

  return (
    <main className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-[-0.02em]">
        {t("heading")}
      </h1>

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
        <FilterSidebar metadata={metadata} params={params} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <FilterDrawer metadata={metadata} params={params} />
              <SortLinks params={params} />
            </div>
            {/* Applying a filter is a client navigation: without a live
                region the results change with nothing said about it. The
                region is always present so a later change is announced. */}
            <p
              aria-live="polite"
              className="text-sm font-semibold text-[#17203a]/60"
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

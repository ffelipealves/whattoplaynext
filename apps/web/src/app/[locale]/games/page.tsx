import { getTranslations } from "next-intl/server";

import { parseBrowseParams } from "@/features/search/browse-params";
import { getSearchResults } from "@/features/search/get-search-results";
import { NameSearchForm } from "@/features/search/name-search-form";
import { PaginationLinks } from "@/features/search/pagination-links";
import { ResultsGrid } from "@/features/search/results-grid";
import { SortLinks } from "@/features/search/sort-links";

export const dynamic = "force-dynamic";

export default async function GamesPage({
  searchParams,
}: PageProps<"/[locale]/games">) {
  const params = parseBrowseParams(await searchParams);
  const result = await getSearchResults(params);
  const t = await getTranslations("Search");

  return (
    <main className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-[-0.02em]">
        {t("heading")}
      </h1>

      <div className="mt-6">
        <NameSearchForm params={params} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <SortLinks params={params} />
        {result.ok && (
          <p className="text-sm font-semibold text-[#17203a]/60">
            {t("resultsCount", { count: result.page.pagination.totalItems })}
          </p>
        )}
      </div>

      <div className="mt-6">
        <ResultsGrid name={params.name} result={result} />
      </div>

      {result.ok && (
        <div className="mt-8">
          <PaginationLinks
            params={params}
            totalPages={result.page.pagination.totalPages}
          />
        </div>
      )}
    </main>
  );
}

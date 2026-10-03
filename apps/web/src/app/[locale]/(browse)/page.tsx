import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getFilterMetadata } from "@/features/catalog/get-filter-metadata";
import {
  FeaturedGames,
  FeaturedSkeleton,
} from "@/features/featured/featured-games";
import { activeFilters } from "@/features/search/active-filters";
import {
  filterBoundsFrom,
  readBrowseParams,
  type BrowseParams,
} from "@/features/search/browse-params";
import { getSearchResults } from "@/features/search/get-search-results";
import { SearchPage } from "@/features/search/search-page";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type HomePageMetadataProps = {
  params: Promise<{ locale: "en" | "pt-br" }>;
  searchParams: PageProps<"/[locale]">["searchParams"];
};

export async function generateMetadata({
  params,
  searchParams,
}: HomePageMetadataProps): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: "Metadata" });

  const metadata = buildPageMetadata({
    description: t("homeDescription"),
    locale,
    path: "",
    title: t("homeTitle"),
  });

  // The bare home page is the indexable entry point. A search with any
  // parameters is one of many views of it, so it stays out of the index and
  // its canonical still points at the home page.
  const isSearch = Object.keys(query).length > 0;

  return {
    ...metadata,
    robots: isSearch ? { follow: true, index: false } : undefined,
    title: { absolute: `${t("homeTitle")} | What To Play Next` },
  };
}

export default async function LocaleHomePage({
  searchParams,
}: PageProps<"/[locale]">) {
  // The filter metadata publishes the allow-listed ids and bounds the URL is
  // validated against, so it is read before the criteria are parsed (it is a
  // long-cached catalog call) rather than alongside the results.
  const [rawSearchParams, filters] = await Promise.all([
    searchParams,
    getFilterMetadata(),
  ]);
  const metadata = filters.ok ? filters.metadata : undefined;
  const { params, issues } = readBrowseParams(
    rawSearchParams,
    metadata && filterBoundsFrom(metadata),
  );

  const result = await getSearchResults(params);
  const featuredIds =
    isLanding(params) && result.ok
      ? result.page.items.slice(0, FEATURED_COUNT).map((game) => game.id)
      : [];

  return (
    <SearchPage
      featured={
        featuredIds.length > 0 && (
          // Streamed after the results, so they never wait on it.
          <Suspense fallback={<FeaturedSkeleton />}>
            <FeaturedGames ids={featuredIds} />
          </Suspense>
        )
      }
      filters={filters}
      issues={issues}
      params={params}
      result={result}
    />
  );
}

/** The most popular games, featured above the results on the landing view. */
const FEATURED_COUNT = 4;

/**
 * The bare home page: nothing searched or filtered, the default sort, the
 * first page. Its first results are the most popular games, which is what
 * the featured section shows; any other search has results of its own to
 * look at.
 */
function isLanding(params: BrowseParams): boolean {
  return (
    !params.name &&
    activeFilters(params).length === 0 &&
    params.sort === "popularity" &&
    params.page === 1
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getFilterMetadata } from "@/features/catalog/get-filter-metadata";
import {
  filterBoundsFrom,
  readBrowseParams,
} from "@/features/search/browse-params";
import { getSearchResults } from "@/features/search/get-search-results";
import { SearchPage } from "@/features/search/search-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/games">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    description: t("searchDescription"),
    robots: { follow: true, index: false },
    title: t("searchTitle"),
  };
}

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
  const { params, issues } = readBrowseParams(
    rawSearchParams,
    metadata && filterBoundsFrom(metadata),
  );

  return (
    <SearchPage
      filters={filters}
      issues={issues}
      params={params}
      result={await getSearchResults(params)}
    />
  );
}

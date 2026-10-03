import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getFilterMetadata } from "@/features/catalog/get-filter-metadata";
import {
  filterBoundsFrom,
  readBrowseParams,
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

  return (
    <SearchPage
      filters={filters}
      issues={issues}
      params={params}
      result={await getSearchResults(params)}
    />
  );
}

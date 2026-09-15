import { getFilterMetadata } from "@/features/catalog/get-filter-metadata";
import {
  filterBoundsFrom,
  readBrowseParams,
} from "@/features/search/browse-params";
import { getSearchResults } from "@/features/search/get-search-results";
import { SearchPage } from "@/features/search/search-page";

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
  const { params, issues } = readBrowseParams(
    rawSearchParams,
    metadata && filterBoundsFrom(metadata),
  );

  return (
    <SearchPage
      issues={issues}
      metadata={metadata}
      params={params}
      result={await getSearchResults(params)}
    />
  );
}

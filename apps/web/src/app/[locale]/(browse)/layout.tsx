import { getFilterMetadata } from "@/features/catalog/get-filter-metadata";
import { SiteHeader } from "@/features/search/site-header";

/**
 * The header lives here rather than in the page so it stays put while a new
 * search loads. The metadata call is the page's own, memoized per render.
 */
export default async function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const filters = await getFilterMetadata();

  return (
    <>
      <SiteHeader
        minimumQueryLength={
          filters.ok
            ? filters.metadata.limits.minimumAutocompleteLength
            : undefined
        }
      />
      {children}
    </>
  );
}

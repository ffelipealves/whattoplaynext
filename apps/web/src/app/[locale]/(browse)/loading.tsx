import { Skeleton } from "@/components/ui/skeleton";
import { ResultsSkeleton } from "@/features/search/results-skeleton";

/** Mirrors the search page's columns so nothing shifts when results arrive. */
export default function SearchLoading() {
  return (
    <main className="mx-auto max-w-360 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mt-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:gap-14">
        <div aria-hidden className="hidden lg:block" />
        <div className="min-w-0">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-40 rounded-full" />
          <div className="mt-8">
            <ResultsSkeleton />
          </div>
        </div>
      </div>
    </main>
  );
}

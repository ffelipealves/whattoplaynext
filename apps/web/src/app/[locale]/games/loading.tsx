import { ResultsSkeleton } from "@/features/search/results-skeleton";

export default function GamesLoading() {
  return (
    <main className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-12">
      <ResultsSkeleton />
    </main>
  );
}

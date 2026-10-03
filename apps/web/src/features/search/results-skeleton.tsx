import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_COUNT = 24;

/** The shape of a page of result cards, while the real one loads. */
export function ResultsSkeleton() {
  const t = useTranslations("Search");

  return (
    <div
      aria-label={t("loadingLabel")}
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4 2xl:grid-cols-5"
      role="status"
    >
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <div className="flex flex-col gap-2" key={index}>
          <Skeleton className="aspect-2/3 w-full rounded-2xl" />
          <Skeleton className="mt-1 h-4 w-3/4 rounded-full" />
          <Skeleton className="h-3 w-1/2 rounded-full" />
          <Skeleton className="h-3 w-2/3 rounded-full" />
        </div>
      ))}
    </div>
  );
}

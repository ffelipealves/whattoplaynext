import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_COUNT = 24;

export function ResultsSkeleton() {
  const t = useTranslations("Search");

  return (
    <div
      aria-label={t("loadingLabel")}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      role="status"
    >
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <div className="flex flex-col gap-2" key={index}>
          <Skeleton className="aspect-[264/374] w-full rounded-2xl" />
          <Skeleton className="h-4 w-3/4 rounded-full" />
          <Skeleton className="h-3 w-1/3 rounded-full" />
        </div>
      ))}
    </div>
  );
}

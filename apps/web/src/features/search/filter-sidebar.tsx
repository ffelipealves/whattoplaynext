import { useTranslations } from "next-intl";

import type { FilterMetadata } from "@/features/catalog/get-filter-metadata";

import { FilterForm } from "./filter-form";
import { filterSignature, type BrowseParams } from "./browse-params";

type FilterPanelProps = {
  params: BrowseParams;
  /** Absent when `GET /api/v1/filters` failed for this request. */
  metadata?: FilterMetadata;
};

/**
 * Says plainly that the options could not be loaded, rather than rendering an
 * empty filter form that would look like a catalog with nothing in it.
 */
export function FiltersUnavailable() {
  const t = useTranslations("Filters");

  return (
    <div
      className="rounded-2xl border border-[#17203a]/15 bg-white px-4 py-5"
      role="alert"
    >
      <p className="text-sm font-semibold text-[#17203a]">
        {t("unavailableTitle")}
      </p>
      <p className="mt-1 text-xs text-[#17203a]/65">
        {t("unavailableDescription")}
      </p>
    </div>
  );
}

/** The desktop layout: filters stay visible beside the results. */
export function FilterSidebar({ metadata, params }: FilterPanelProps) {
  const t = useTranslations("Filters");

  return (
    <aside
      aria-label={t("heading")}
      className="hidden lg:block lg:w-64 lg:shrink-0"
    >
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.01em]">
        {t("heading")}
      </h2>
      <div className="mt-4">
        {metadata ? (
          <FilterForm
            key={filterSignature(params)}
            metadata={metadata}
            params={params}
          />
        ) : (
          <FiltersUnavailable />
        )}
      </div>
    </aside>
  );
}

export type { FilterPanelProps };

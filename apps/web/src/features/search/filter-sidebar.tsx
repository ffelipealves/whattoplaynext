import { useTranslations } from "next-intl";

import type { FilterMetadataResult } from "@/features/catalog/get-filter-metadata";
import { failureCopy } from "@/lib/failure-presentation";

import { FilterForm } from "./filter-form";
import { filterSignature, type BrowseParams } from "./browse-params";

type FilterPanelProps = {
  params: BrowseParams;
  filters: FilterMetadataResult;
};

/**
 * Says plainly that the options could not be loaded, rather than rendering an
 * empty filter form that would look like a catalog with nothing in it.
 */
export function FiltersUnavailable({
  failure,
}: {
  failure: Extract<FilterMetadataResult, { ok: false }>["failure"];
}) {
  const t = useTranslations("Failure");
  const copy = failureCopy(failure.code);

  return (
    <div
      className="rounded-2xl border border-[#17203a]/15 bg-white px-4 py-5"
      role="alert"
    >
      <meta content="noindex" name="robots" />
      <p className="text-sm font-semibold text-[#17203a]">{t(copy.title)}</p>
      <p className="mt-1 text-xs text-[#17203a]/75">{t(copy.description)}</p>
      {failure.retryAfterSeconds !== undefined && (
        <p className="mt-2 text-xs font-semibold text-[#17203a]/75">
          {t("rateLimitedRetryIn", {
            seconds: failure.retryAfterSeconds,
          })}
        </p>
      )}
      {failure.requestId && (
        <p className="mt-2 text-xs text-[#17203a]/75">
          {t("requestIdLabel", { requestId: failure.requestId })}
        </p>
      )}
    </div>
  );
}

/** The desktop layout: filters stay visible beside the results. */
export function FilterSidebar({ filters, params }: FilterPanelProps) {
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
        {filters.ok ? (
          <FilterForm
            key={filterSignature(params)}
            metadata={filters.metadata}
            params={params}
          />
        ) : (
          <FiltersUnavailable failure={filters.failure} />
        )}
      </div>
    </aside>
  );
}

export type { FilterPanelProps };

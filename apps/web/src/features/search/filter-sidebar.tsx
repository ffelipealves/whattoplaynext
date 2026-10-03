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
      className="rounded-2xl border border-border bg-card px-4 py-5"
      role="alert"
    >
      <meta content="noindex" name="robots" />
      <p className="text-sm font-semibold text-foreground">{t(copy.title)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(copy.description)}
      </p>
      {failure.retryAfterSeconds !== undefined && (
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          {t("rateLimitedRetryIn", {
            seconds: failure.retryAfterSeconds,
          })}
        </p>
      )}
      {failure.requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("requestIdLabel", { requestId: failure.requestId })}
        </p>
      )}
    </div>
  );
}

/**
 * The desktop layout: filters stay visible beside the results, pinned under
 * the header with a scroll of their own, so Apply is always in reach.
 */
export function FilterSidebar({ filters, params }: FilterPanelProps) {
  const t = useTranslations("Filters");

  return (
    <aside aria-label={t("heading")} className="hidden lg:block">
      <div className="scrollbar-thin sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-3">
        <h2 className="mb-5 font-display text-lg font-bold text-ink-50">
          {t("heading")}
        </h2>
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

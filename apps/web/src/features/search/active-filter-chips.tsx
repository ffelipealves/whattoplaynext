import { useTranslations } from "next-intl";
import { XIcon } from "lucide-react";

import type {
  CatalogOption,
  FilterMetadata,
} from "@/features/catalog/get-filter-metadata";
import { Link } from "@/i18n/navigation";

import {
  activeFilters,
  withoutFilter,
  type ActiveFilter,
} from "./active-filters";
import {
  withBrowseParams,
  type BrowseParams,
  type DurationKind,
} from "./browse-params";

type Translate = ReturnType<typeof useTranslations<"Filters">>;

const DURATION_KIND_LABEL_KEYS: Record<DurationKind, string> = {
  fast: "durationKindFast",
  normal: "durationKindNormal",
  completionist: "durationKindCompletionist",
};

type ActiveFilterChipsProps = {
  params: BrowseParams;
  /**
   * Supplies the catalog's own labels. When the filters call failed the chips
   * still render, falling back to the raw id: showing an applied criterion by
   * its id is honest, silently hiding it would not be.
   */
  metadata?: FilterMetadata;
};

function labelFor(options: CatalogOption[] | undefined, id: string): string {
  return options?.find((option) => option.id === id)?.label ?? id;
}

function describe(
  filter: ActiveFilter,
  t: Translate,
  metadata: FilterMetadata | undefined,
): string {
  switch (filter.kind) {
    case "platform":
      return t("chipPlatform", {
        label: labelFor(metadata?.platforms, filter.id),
      });
    case "genre":
      return t("chipGenre", { label: labelFor(metadata?.genres, filter.id) });
    case "gameMode":
      return t("chipGameMode", {
        label: labelFor(metadata?.gameModes, filter.id),
      });
    case "release":
      return t("chipRelease", {
        range:
          filter.from && filter.to
            ? t("releaseRangeBoth", { from: filter.from, to: filter.to })
            : filter.from
              ? t("releaseRangeFrom", { from: filter.from })
              : t("releaseRangeTo", { to: filter.to! }),
      });
    case "rating":
      return t("chipRating", { value: filter.minimumRating });
    case "duration":
      return t("chipDuration", {
        kind: t(DURATION_KIND_LABEL_KEYS[filter.durationKind]),
        range:
          filter.minimumHours !== undefined && filter.maximumHours !== undefined
            ? t("durationRangeBoth", {
                minimum: filter.minimumHours,
                maximum: filter.maximumHours,
              })
            : filter.minimumHours !== undefined
              ? t("durationRangeMinimum", { minimum: filter.minimumHours })
              : t("durationRangeMaximum", { maximum: filter.maximumHours! }),
      });
  }
}

function keyFor(filter: ActiveFilter): string {
  return filter.kind === "platform" ||
    filter.kind === "genre" ||
    filter.kind === "gameMode"
    ? `${filter.kind}-${filter.id}`
    : filter.kind;
}

export function ActiveFilterChips({
  params,
  metadata,
}: ActiveFilterChipsProps) {
  const t = useTranslations("Filters");
  const filters = activeFilters(params);

  if (filters.length === 0) {
    return null;
  }

  return (
    <nav aria-label={t("activeNavLabel")} className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const label = describe(filter, t, metadata);
        return (
          // Removing one criterion is a plain URL, so it keeps working without
          // client JS exactly like the sort and pagination links.
          <Link
            aria-label={t("removeChipLabel", { label })}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#17203a]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#17203a] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
            href={{
              pathname: "/games",
              query: withBrowseParams(params, {
                ...withoutFilter(params, filter),
                page: 1,
              }),
            }}
            key={keyFor(filter)}
          >
            <span>{label}</span>
            <XIcon aria-hidden className="size-3.5" />
          </Link>
        );
      })}
    </nav>
  );
}

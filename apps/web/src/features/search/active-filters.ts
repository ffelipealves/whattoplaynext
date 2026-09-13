import {
  DEFAULT_DURATION_KIND,
  type BrowseParams,
  type DurationKind,
  type FilterCriteria,
} from "./browse-params";

/**
 * One applied criterion, as the chip row shows it: a single id for the
 * multi-value categories, and one entry covering both bounds of the release
 * and duration ranges.
 */
export type ActiveFilter =
  | { kind: "platform"; id: string }
  | { kind: "genre"; id: string }
  | { kind: "gameMode"; id: string }
  | { kind: "release"; from?: string; to?: string }
  | { kind: "rating"; minimumRating: number }
  | {
      kind: "duration";
      durationKind: DurationKind;
      minimumHours?: number;
      maximumHours?: number;
    };

/**
 * Describes exactly what is applied, so a chip row and an active-filter count
 * cannot drift apart: the count is the length of this list.
 */
export function activeFilters(params: BrowseParams): ActiveFilter[] {
  const filters: ActiveFilter[] = [
    ...params.platformIds.map((id): ActiveFilter => ({ kind: "platform", id })),
    ...params.genreIds.map((id): ActiveFilter => ({ kind: "genre", id })),
    ...params.gameModeIds.map((id): ActiveFilter => ({ kind: "gameMode", id })),
  ];

  if (params.releaseFrom || params.releaseTo) {
    filters.push({
      kind: "release",
      from: params.releaseFrom,
      to: params.releaseTo,
    });
  }
  if (params.minimumRating !== undefined) {
    filters.push({ kind: "rating", minimumRating: params.minimumRating });
  }
  if (
    params.minimumDurationHours !== undefined ||
    params.maximumDurationHours !== undefined
  ) {
    filters.push({
      kind: "duration",
      durationKind: params.durationKind,
      minimumHours: params.minimumDurationHours,
      maximumHours: params.maximumDurationHours,
    });
  }

  // A duration kind with no bound narrows nothing on its own (it only selects
  // which measure the duration sort reads), so it is deliberately not a chip.
  return filters;
}

/**
 * The overrides that clear one applied criterion and nothing else, for a chip's
 * remove link.
 */
export function withoutFilter(
  params: BrowseParams,
  filter: ActiveFilter,
): Partial<FilterCriteria> {
  switch (filter.kind) {
    case "platform":
      return {
        platformIds: params.platformIds.filter((id) => id !== filter.id),
      };
    case "genre":
      return { genreIds: params.genreIds.filter((id) => id !== filter.id) };
    case "gameMode":
      return {
        gameModeIds: params.gameModeIds.filter((id) => id !== filter.id),
      };
    case "release":
      return { releaseFrom: undefined, releaseTo: undefined };
    case "rating":
      return { minimumRating: undefined };
    case "duration":
      return {
        durationKind: DEFAULT_DURATION_KIND,
        minimumDurationHours: undefined,
        maximumDurationHours: undefined,
      };
  }
}

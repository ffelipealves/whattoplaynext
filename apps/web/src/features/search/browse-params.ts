import { z } from "zod";

export const sortOptionSchema = z.enum([
  "popularity",
  "rating",
  "release-date",
  "duration",
  "title",
]);
export type SortOption = z.infer<typeof sortOptionSchema>;

export const sortDirectionSchema = z.enum(["asc", "desc"]);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export const durationKindSchema = z.enum(["fast", "normal", "completionist"]);
export type DurationKind = z.infer<typeof durationKindSchema>;

export const DEFAULT_DURATION_KIND: DurationKind = "normal";

export const MIN_PAGE = 1;
export const MAX_PAGE = 100;
export const MAX_NAME_LENGTH = 100;
export const MIN_RATING = 0;
export const MAX_RATING = 100;
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 1000;

/**
 * The subset of `GET /api/v1/filters` this parser needs: the allow-listed ids
 * and published numeric limits. Passing it keeps the frontend from carrying a
 * second copy of the API's enums; when the filters call is unavailable the
 * parser falls back to shape-only validation and lets the API reject anything
 * it does not allow-list.
 */
export type FilterBounds = {
  platformIds: readonly string[];
  genreIds: readonly string[];
  gameModeIds: readonly string[];
  maximumNameLength: number;
  minimumDurationHours: number;
  maximumDurationHours: number;
};

/** Structured criteria the filter sidebar owns, as opposed to name and sort. */
export type FilterCriteria = {
  platformIds: string[];
  genreIds: string[];
  gameModeIds: string[];
  releaseFrom?: string;
  releaseTo?: string;
  minimumRating?: number;
  durationKind: DurationKind;
  minimumDurationHours?: number;
  maximumDurationHours?: number;
};

export type BrowseParams = FilterCriteria & {
  name?: string;
  sort: SortOption;
  direction: SortDirection;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function allValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function defaultDirectionFor(sort: SortOption): SortDirection {
  return sort === "title" || sort === "duration" ? "asc" : "desc";
}

/**
 * Builds the parser's bounds from a published `GET /api/v1/filters` response.
 * Kept structural so this module does not depend on the catalog feature.
 */
export function filterBoundsFrom(metadata: {
  platforms: readonly { id: string }[];
  genres: readonly { id: string }[];
  gameModes: readonly { id: string }[];
  limits: {
    maximumNameLength: number;
    minimumDurationHours: number;
    maximumDurationHours: number;
  };
}): FilterBounds {
  return {
    platformIds: metadata.platforms.map((option) => option.id),
    genreIds: metadata.genres.map((option) => option.id),
    gameModeIds: metadata.gameModes.map((option) => option.id),
    maximumNameLength: metadata.limits.maximumNameLength,
    minimumDurationHours: metadata.limits.minimumDurationHours,
    maximumDurationHours: metadata.limits.maximumDurationHours,
  };
}

/**
 * Identifies one applied filter selection. The filter form keeps a draft that
 * the URL does not know about, so it must remount whenever the applied
 * selection changes underneath it — after a chip removal, Clear-all, or
 * back/forward navigation — instead of showing a draft for a search that is no
 * longer on screen. Name, sort, and page deliberately do not take part: a
 * half-built selection survives paging and sorting.
 */
export function filterSignature(params: BrowseParams): string {
  return JSON.stringify([
    params.platformIds,
    params.genreIds,
    params.gameModeIds,
    params.releaseFrom,
    params.releaseTo,
    params.minimumRating,
    params.durationKind,
    params.minimumDurationHours,
    params.maximumDurationHours,
  ]);
}

/** Every structured filter back to its unset value. */
export function clearedFilters(): FilterCriteria {
  return {
    platformIds: [],
    genreIds: [],
    gameModeIds: [],
    releaseFrom: undefined,
    releaseTo: undefined,
    minimumRating: undefined,
    durationKind: DEFAULT_DURATION_KIND,
    minimumDurationHours: undefined,
    maximumDurationHours: undefined,
  };
}

function nameSchemaFor(maximumLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maximumLength)
    .optional()
    .catch(undefined);
}

// z.coerce.number().catch(fallback) substitutes one fixed value for *any*
// failure, out-of-range included, so it cannot express "clamp to the
// nearest bound." A non-numeric page still falls back to the schema's
// invalid-input default; only in-range-but-out-of-bounds values are clamped.
const pageInputSchema = z.coerce.number().int().catch(MIN_PAGE);

function clampPage(value: number): number {
  return Math.min(Math.max(value, MIN_PAGE), MAX_PAGE);
}

// Ids are lowercase, hyphenated, and short by contract (`pc`,
// `turn-based-strategy-tbs`); anything else cannot be a published id.
const idShapeSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(64);

/**
 * Parses repeated id params (`?platform=pc&platform=nintendo-switch`) into one
 * deduplicated selection. With an allow-list the result follows the catalog's
 * own order, so the same selection always produces the same URL regardless of
 * the order the visitor checked the boxes in.
 */
function parseIds(
  raw: string | string[] | undefined,
  allowed: readonly string[] | undefined,
): string[] {
  const selected = new Set(
    allValues(raw)
      .map((value) => value.trim())
      .filter((value) => idShapeSchema.safeParse(value).success),
  );

  if (!allowed) {
    return Array.from(selected);
  }
  return allowed.filter((id) => selected.has(id));
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  // The regex alone accepts month 13 and February 30th; round-tripping through
  // Date is what actually rejects a day that does not exist.
  .refine((value) => {
    const parsed = new Date(value);
    return (
      !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
    );
  });

function parseIsoDate(raw: string | string[] | undefined): string | undefined {
  const result = isoDateSchema.safeParse(firstValue(raw));
  return result.success ? result.data : undefined;
}

function parseRating(raw: string | string[] | undefined): number | undefined {
  const result = z.coerce
    .number()
    .min(MIN_RATING)
    .max(MAX_RATING)
    .safeParse(firstValue(raw));
  if (!result.success || result.data === MIN_RATING) {
    // A zero minimum excludes nothing, so it is an unset filter rather than a
    // criterion worth carrying in the URL or showing as a chip.
    return undefined;
  }
  return result.data;
}

function parseDurationHours(
  raw: string | string[] | undefined,
  bounds: Pick<FilterBounds, "minimumDurationHours" | "maximumDurationHours">,
): number | undefined {
  const result = z.coerce
    .number()
    .min(bounds.minimumDurationHours)
    .max(bounds.maximumDurationHours)
    // The API rejects bounds that do not resolve to whole seconds; mirroring
    // that here avoids forwarding a guaranteed-invalid request.
    .refine((value) => Number.isInteger(value * 3600))
    .safeParse(firstValue(raw));
  return result.success ? result.data : undefined;
}

/**
 * Parses raw URL search params against the same bounds the API enforces.
 * Invalid values fall back to a sensible default and out-of-range pages are
 * clamped to the nearest bound, rather than forwarding a guaranteed-invalid
 * request; full validation-error surfacing for a deliberately malformed
 * shared link is a later increment's concern.
 */
export function parseBrowseParams(
  searchParams: RawSearchParams,
  bounds?: FilterBounds,
): BrowseParams {
  const durationBounds = {
    minimumDurationHours: bounds?.minimumDurationHours ?? MIN_DURATION_HOURS,
    maximumDurationHours: bounds?.maximumDurationHours ?? MAX_DURATION_HOURS,
  };

  const name = nameSchemaFor(
    bounds?.maximumNameLength ?? MAX_NAME_LENGTH,
  ).parse(firstValue(searchParams.name));
  const sort = sortOptionSchema
    .catch("popularity")
    .parse(firstValue(searchParams.sort));
  const direction = sortDirectionSchema
    .catch(defaultDirectionFor(sort))
    .parse(firstValue(searchParams.direction));
  const page = clampPage(pageInputSchema.parse(firstValue(searchParams.page)));

  let releaseFrom = parseIsoDate(searchParams.releaseFrom);
  let releaseTo = parseIsoDate(searchParams.releaseTo);
  if (releaseFrom && releaseTo && releaseFrom > releaseTo) {
    // An inverted range is not a narrower filter, it is a contradiction the
    // API rejects outright; drop it rather than guess which bound was meant.
    releaseFrom = undefined;
    releaseTo = undefined;
  }

  let minimumDurationHours = parseDurationHours(
    searchParams.minimumDurationHours,
    durationBounds,
  );
  let maximumDurationHours = parseDurationHours(
    searchParams.maximumDurationHours,
    durationBounds,
  );
  if (
    minimumDurationHours !== undefined &&
    maximumDurationHours !== undefined &&
    minimumDurationHours > maximumDurationHours
  ) {
    minimumDurationHours = undefined;
    maximumDurationHours = undefined;
  }

  return {
    name,
    platformIds: parseIds(searchParams.platform, bounds?.platformIds),
    genreIds: parseIds(searchParams.genre, bounds?.genreIds),
    gameModeIds: parseIds(searchParams.gameMode, bounds?.gameModeIds),
    releaseFrom,
    releaseTo,
    minimumRating: parseRating(searchParams.minimumRating),
    durationKind: durationKindSchema
      .catch(DEFAULT_DURATION_KIND)
      .parse(firstValue(searchParams.durationKind)),
    minimumDurationHours,
    maximumDurationHours,
    sort,
    direction,
    page,
  };
}

/**
 * Builds the query object for a link that keeps the current criteria except
 * for the given overrides — for example, changing only the page while
 * preserving an active name search, sort, and filters. Multi-value categories
 * become repeated params, which is how the API expresses OR within a category
 * and AND across categories.
 */
export function withBrowseParams(
  params: BrowseParams,
  overrides: Partial<BrowseParams>,
): Record<string, string | string[]> {
  const merged = { ...params, ...overrides };
  const query: Record<string, string | string[]> = {
    sort: merged.sort,
    direction: merged.direction,
    page: String(merged.page),
  };
  if (merged.name) {
    query.name = merged.name;
  }
  if (merged.platformIds.length > 0) {
    query.platform = merged.platformIds;
  }
  if (merged.genreIds.length > 0) {
    query.genre = merged.genreIds;
  }
  if (merged.gameModeIds.length > 0) {
    query.gameMode = merged.gameModeIds;
  }
  if (merged.releaseFrom) {
    query.releaseFrom = merged.releaseFrom;
  }
  if (merged.releaseTo) {
    query.releaseTo = merged.releaseTo;
  }
  if (merged.minimumRating !== undefined) {
    query.minimumRating = String(merged.minimumRating);
  }
  if (merged.durationKind !== DEFAULT_DURATION_KIND) {
    query.durationKind = merged.durationKind;
  }
  if (merged.minimumDurationHours !== undefined) {
    query.minimumDurationHours = String(merged.minimumDurationHours);
  }
  if (merged.maximumDurationHours !== undefined) {
    query.maximumDurationHours = String(merged.maximumDurationHours);
  }
  return query;
}

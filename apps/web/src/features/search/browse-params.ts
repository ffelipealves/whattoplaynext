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

export const MIN_PAGE = 1;
export const MAX_PAGE = 100;
export const MAX_NAME_LENGTH = 100;

export type BrowseParams = {
  name?: string;
  sort: SortOption;
  direction: SortDirection;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function defaultDirectionFor(sort: SortOption): SortDirection {
  return sort === "title" || sort === "duration" ? "asc" : "desc";
}

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_NAME_LENGTH)
  .optional()
  .catch(undefined);

// z.coerce.number().catch(fallback) substitutes one fixed value for *any*
// failure, out-of-range included, so it cannot express "clamp to the
// nearest bound." A non-numeric page still falls back to the schema's
// invalid-input default; only in-range-but-out-of-bounds values are clamped.
const pageInputSchema = z.coerce.number().int().catch(MIN_PAGE);

function clampPage(value: number): number {
  return Math.min(Math.max(value, MIN_PAGE), MAX_PAGE);
}

/**
 * Parses raw URL search params against the same bounds the API enforces.
 * Invalid values fall back to a sensible default and out-of-range pages are
 * clamped to the nearest bound, rather than forwarding a guaranteed-invalid
 * request; full validation-error surfacing for a deliberately malformed
 * shared link is a later increment's concern.
 */
export function parseBrowseParams(searchParams: RawSearchParams): BrowseParams {
  const name = nameSchema.parse(firstValue(searchParams.name));
  const sort = sortOptionSchema
    .catch("popularity")
    .parse(firstValue(searchParams.sort));
  const direction = sortDirectionSchema
    .catch(defaultDirectionFor(sort))
    .parse(firstValue(searchParams.direction));
  const page = clampPage(pageInputSchema.parse(firstValue(searchParams.page)));

  return { name, sort, direction, page };
}

/**
 * Builds the query object for a link that keeps the current criteria except
 * for the given overrides — for example, changing only the page while
 * preserving an active name search and sort.
 */
export function withBrowseParams(
  params: BrowseParams,
  overrides: Partial<BrowseParams>,
): Record<string, string> {
  const merged = { ...params, ...overrides };
  const query: Record<string, string> = {
    sort: merged.sort,
    direction: merged.direction,
    page: String(merged.page),
  };
  if (merged.name) {
    query.name = merged.name;
  }
  return query;
}

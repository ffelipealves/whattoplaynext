/**
 * The only analytics events and properties this application may send.
 *
 * FR-049 decides what is measured and FR-050 what never is: no search text,
 * game titles, slugs, or IDs, no full URLs or query strings, no filter values,
 * addresses, request IDs, provider text, or error messages. Types keep call
 * sites honest; `sanitizeEvent` enforces the same allow-list at run time, so a
 * value that slips past the types is dropped rather than sent.
 */

type Value = string | number | boolean;

const LOCALES = ["en", "pt-br"] as const;
const FILTER_CATEGORIES = [
  "name",
  "platform",
  "genre",
  "release",
  "rating",
  "mode",
  "duration",
] as const;
const SORTS = ["popularity", "rating", "release-date", "duration", "title"];
const DIRECTIONS = ["asc", "desc"];
const RESULT_BUCKETS = ["0", "1-24", "25-240", "241-2400", "2400+"] as const;
const RESPONSE_BUCKETS = ["<0.5s", "0.5-2.5s", "2.5-10s", "10s+"] as const;
const SINCE_SEARCH_BUCKETS = ["<30s", "30s-2m", "2-10m", "10m+"] as const;
const ENTRIES = ["search-result", "direct"] as const;
const LINK_CATEGORIES = [
  "official",
  "wikipedia",
  "twitch",
  "youtube",
  "steam",
  "epic",
  "gog",
  "discord",
  "other",
] as const;
const SURFACES = ["search", "game", "filters"] as const;
const FAILURE_CODES = [
  "GAME_NOT_FOUND",
  "INTERNAL_ERROR",
  "INVALID_QUERY",
  "METHOD_NOT_ALLOWED",
  "NOT_FOUND",
  "RATE_LIMITED",
  "UPSTREAM_INVALID_RESPONSE",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_UNAVAILABLE",
  "VALIDATION_ERROR",
  "UNREACHABLE",
  "UNKNOWN",
] as const;

export type Locale = (typeof LOCALES)[number];
export type FilterCategory = (typeof FILTER_CATEGORIES)[number];
export type ResultBucket = (typeof RESULT_BUCKETS)[number];
export type ResponseBucket = (typeof RESPONSE_BUCKETS)[number];
export type SinceSearchBucket = (typeof SINCE_SEARCH_BUCKETS)[number];
export type Entry = (typeof ENTRIES)[number];
export type LinkCategory = (typeof LINK_CATEGORIES)[number];
export type Surface = (typeof SURFACES)[number];
export type FailureCode = (typeof FAILURE_CODES)[number];

export type AnalyticsEvent =
  | {
      name: "search-submitted";
      data: {
        locale: Locale;
        /** Categories used, sorted and comma-joined, or "none". */
        filters: string;
        sort: string;
        direction: string;
        results: ResultBucket;
        refinement: boolean;
        responseTime?: ResponseBucket;
      };
    }
  | {
      name: "sort-changed";
      data: { locale: Locale; sort: string; direction: string };
    }
  | {
      name: "game-detail-viewed";
      data: { locale: Locale; entry: Entry; sinceSearch?: SinceSearchBucket };
    }
  | {
      name: "external-link-clicked";
      data: { locale: Locale; link: LinkCategory };
    }
  | {
      name: "failure-shown";
      data: { locale: Locale; surface: Surface; code: FailureCode };
    }
  | { name: "stale-data-shown"; data: { locale: Locale; surface: Surface } };

type Rule = readonly string[] | "boolean" | ((value: Value) => boolean);

const isFilterList = (value: Value) =>
  typeof value === "string" &&
  (value === "none" ||
    value
      .split(",")
      .every((part) =>
        (FILTER_CATEGORIES as readonly string[]).includes(part),
      ));

const ALLOW_LIST: Record<AnalyticsEvent["name"], Record<string, Rule>> = {
  "search-submitted": {
    locale: LOCALES,
    filters: isFilterList,
    sort: SORTS,
    direction: DIRECTIONS,
    results: RESULT_BUCKETS,
    refinement: "boolean",
    responseTime: RESPONSE_BUCKETS,
  },
  "sort-changed": { locale: LOCALES, sort: SORTS, direction: DIRECTIONS },
  "game-detail-viewed": {
    locale: LOCALES,
    entry: ENTRIES,
    sinceSearch: SINCE_SEARCH_BUCKETS,
  },
  "external-link-clicked": { locale: LOCALES, link: LINK_CATEGORIES },
  "failure-shown": { locale: LOCALES, surface: SURFACES, code: FAILURE_CODES },
  "stale-data-shown": { locale: LOCALES, surface: SURFACES },
};

function allowed(rule: Rule, value: Value): boolean {
  if (rule === "boolean") return typeof value === "boolean";
  if (typeof rule === "function") return rule(value);
  return typeof value === "string" && rule.includes(value);
}

/** The event as it may be sent, or `null` for an event that is not allowed. */
export function sanitizeEvent(event: {
  name: string;
  data: Record<string, unknown>;
}): { name: string; data: Record<string, Value> } | null {
  const rules = ALLOW_LIST[event.name as AnalyticsEvent["name"]];
  if (!rules) return null;
  const data: Record<string, Value> = {};
  for (const [key, value] of Object.entries(event.data)) {
    const rule = rules[key];
    if (
      rule &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") &&
      allowed(rule, value)
    ) {
      data[key] = value;
    }
  }
  return { name: event.name, data };
}

export function resultBucket(total: number): ResultBucket {
  if (total === 0) return "0";
  if (total <= 24) return "1-24";
  if (total <= 240) return "25-240";
  if (total <= 2400) return "241-2400";
  return "2400+";
}

export function responseBucket(milliseconds: number): ResponseBucket {
  if (milliseconds < 500) return "<0.5s";
  if (milliseconds < 2_500) return "0.5-2.5s";
  if (milliseconds < 10_000) return "2.5-10s";
  return "10s+";
}

export function sinceSearchBucket(milliseconds: number): SinceSearchBucket {
  if (milliseconds < 30_000) return "<30s";
  if (milliseconds < 120_000) return "30s-2m";
  if (milliseconds < 600_000) return "2-10m";
  return "10m+";
}

/** Map an external-link label from the API's allow-list to its category. */
export function linkCategory(label: string): LinkCategory {
  const categories: Record<string, LinkCategory> = {
    "Official Website": "official",
    Wikipedia: "wikipedia",
    Twitch: "twitch",
    YouTube: "youtube",
    Steam: "steam",
    "Epic Games Store": "epic",
    GOG: "gog",
    Discord: "discord",
  };
  return categories[label] ?? "other";
}

/**
 * The route a path belongs to, never the path itself: a game page's ID and
 * slug identify the game, and the slug is its title.
 */
export function routeTemplate(pathname: string): string {
  const [locale, section, id, ...rest] = pathname.split("/").filter(Boolean);
  if (!locale || !(LOCALES as readonly string[]).includes(locale)) {
    return "/[other]";
  }
  if (!section) return `/${locale}`;
  if (section === "games" && id) return `/${locale}/games/[game]`;
  if (["about", "privacy", "terms"].includes(section) && !id && !rest.length) {
    return `/${locale}/${section}`;
  }
  return `/${locale}/[other]`;
}

/** Only the referring site's host: its path can carry anything. */
export function referrerHost(referrer: string): string {
  try {
    return referrer ? new URL(referrer).host : "";
  } catch {
    return "";
  }
}

import {
  referrerHost,
  routeTemplate,
  sanitizeEvent,
  type AnalyticsEvent,
  type Entry,
} from "./events";

type UmamiPayload = Record<string, unknown>;

type Umami = {
  track(
    eventOrPayload: string | ((props: UmamiPayload) => UmamiPayload),
    data?: Record<string, string | number | boolean>,
  ): void;
};

declare global {
  interface Window {
    umami?: Umami;
  }
}

/**
 * The one place that talks to Umami. Every event passes the allow-list; page
 * views replace Umami's defaults, which would send the full URL, the query
 * string, the referrer's path, and a game page's title.
 *
 * Session facts live in memory only: NFR-022 keeps browser storage to language
 * and theme, so nothing here survives a reload.
 */
const session: {
  lastSearchKey?: string;
  lastSortKey?: string;
  lastSearchAt?: number;
  submittedAt?: number;
  pendingEntry?: Entry;
  referrerSent: boolean;
} = { referrerSent: false };

// Umami's script loads after hydration, so the first page view and search can
// happen before it exists. They wait here, bounded, and only once analytics is
// enabled; with no website configured nothing is ever queued.
const MAXIMUM_QUEUED = 20;
let enabled = false;
const queued: ((umami: Umami) => void)[] = [];

function send(call: (umami: Umami) => void): void {
  if (!enabled || typeof window === "undefined") return;
  if (window.umami) {
    call(window.umami);
  } else if (queued.length < MAXIMUM_QUEUED) {
    queued.push(call);
  }
}

/** Called when the analytics script is rendered: events may now be sent. */
export function enableAnalytics(): void {
  enabled = true;
}

/** Called once Umami has loaded: deliver whatever waited for it. */
export function flushAnalytics(): void {
  const umami = typeof window !== "undefined" ? window.umami : undefined;
  if (!umami) return;
  for (const call of queued.splice(0)) {
    call(umami);
  }
}

export function track(event: AnalyticsEvent): void {
  const safe = sanitizeEvent(event);
  if (safe) {
    send((umami) => umami.track(safe.name, safe.data));
  }
}

export function trackPageview(pathname: string): void {
  if (!enabled) return;
  // Only the first page view can have come from another site.
  const referrer = session.referrerSent ? "" : referrerHost(document.referrer);
  session.referrerSent = true;
  const url = routeTemplate(pathname);
  send((umami) =>
    umami.track((props) => ({
      website: props.website,
      hostname: props.hostname,
      language: props.language,
      screen: props.screen,
      url,
      referrer,
      title: "",
    })),
  );
}

/** Called when a visitor submits a search, to time the results that follow. */
export function markSearchSubmitted(now: number = performance.now()): void {
  session.submittedAt = now;
}

/** Called when a visitor opens a game from the results. */
export function markEntry(entry: Entry): void {
  session.pendingEntry = entry;
}

export const analyticsSession = {
  /** Take the submit time once: a later render is not the same submission. */
  takeSubmittedAt(): number | undefined {
    const at = session.submittedAt;
    session.submittedAt = undefined;
    return at;
  },
  takeEntry(): Entry {
    const entry = session.pendingEntry ?? "direct";
    session.pendingEntry = undefined;
    return entry;
  },
  lastSearchAt(): number | undefined {
    return session.lastSearchAt;
  },
  /** Classify a rendered result page: a new search, a sort change, or neither. */
  observeResults(
    searchKey: string,
    sortKey: string,
    now: number = performance.now(),
  ): { kind: "search"; refinement: boolean } | { kind: "sort" } | null {
    if (searchKey !== session.lastSearchKey) {
      const refinement = session.lastSearchKey !== undefined;
      session.lastSearchKey = searchKey;
      session.lastSortKey = sortKey;
      session.lastSearchAt = now;
      return { kind: "search", refinement };
    }
    if (sortKey !== session.lastSortKey) {
      session.lastSortKey = sortKey;
      return { kind: "sort" };
    }
    return null;
  },
  /** Forget everything; for tests. */
  reset(): void {
    enabled = false;
    queued.splice(0);
    Object.assign(session, {
      lastSearchKey: undefined,
      lastSortKey: undefined,
      lastSearchAt: undefined,
      submittedAt: undefined,
      pendingEntry: undefined,
      referrerSent: false,
    });
  },
};

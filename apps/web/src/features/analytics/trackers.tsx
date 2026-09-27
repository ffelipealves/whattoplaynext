"use client";

import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  linkCategory,
  resultBucket,
  responseBucket,
  sinceSearchBucket,
  type Entry,
  type FailureCode,
  type FilterCategory,
  type Locale,
} from "./events";
import { analyticsSession, markEntry, track, trackPageview } from "./track";

function useAnalyticsLocale(): Locale {
  return useLocale() === "pt-br" ? "pt-br" : "en";
}

/**
 * Sends each page view by route template, and remembers when a visitor opens
 * a game from the results (`data-analytics-entry` on the link).
 */
export function PageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);

  useEffect(() => {
    function remember(event: MouseEvent) {
      const origin = (event.target as Element | null)?.closest(
        "[data-analytics-entry]",
      );
      const entry = origin?.getAttribute("data-analytics-entry");
      if (entry === "search-result") markEntry(entry as Entry);
    }
    document.addEventListener("click", remember, { capture: true });
    return () =>
      document.removeEventListener("click", remember, { capture: true });
  }, []);

  return null;
}

type SearchAnalyticsProps = {
  /** Compared in memory only, never sent: identifies the submitted criteria. */
  searchKey: string;
  categories: FilterCategory[];
  sort: string;
  direction: string;
  result:
    | { ok: true; totalItems: number; stale: boolean }
    | { ok: false; code: FailureCode };
  filtersFailure?: FailureCode;
};

export function SearchAnalytics({
  searchKey,
  categories,
  sort,
  direction,
  result,
  filtersFailure,
}: SearchAnalyticsProps) {
  const locale = useAnalyticsLocale();
  const outcome = result.ok
    ? `${result.totalItems}:${result.stale}`
    : result.code;

  useEffect(() => {
    if (!result.ok) {
      track({
        name: "failure-shown",
        data: { locale, surface: "search", code: result.code },
      });
      return;
    }
    const observed = analyticsSession.observeResults(
      searchKey,
      `${sort}:${direction}`,
    );
    if (observed?.kind === "search") {
      // A client-side apply marks its submit time. The name form is a native
      // GET, so the first search of a document is timed from navigation start.
      const submittedAt =
        analyticsSession.takeSubmittedAt() ??
        (observed.refinement ? undefined : 0);
      track({
        name: "search-submitted",
        data: {
          locale,
          filters: categories.length
            ? [...categories].sort().join(",")
            : "none",
          sort,
          direction,
          results: resultBucket(result.totalItems),
          refinement: observed.refinement,
          ...(submittedAt !== undefined && {
            responseTime: responseBucket(performance.now() - submittedAt),
          }),
        },
      });
    } else if (observed?.kind === "sort") {
      track({ name: "sort-changed", data: { locale, sort, direction } });
    }
    if (result.stale) {
      track({ name: "stale-data-shown", data: { locale, surface: "search" } });
    }
    // `outcome` stands in for `result`, whose identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, sort, direction, outcome, locale]);

  useEffect(() => {
    if (filtersFailure) {
      track({
        name: "failure-shown",
        data: { locale, surface: "filters", code: filtersFailure },
      });
    }
  }, [filtersFailure, locale]);

  return null;
}

type GameAnalyticsProps = {
  stale: boolean;
};

/**
 * Sends the detail view with how the visitor arrived, and each click on an
 * external link by category (`data-analytics-link` on the link).
 */
export function GameAnalytics({ stale }: GameAnalyticsProps) {
  const locale = useAnalyticsLocale();

  useEffect(() => {
    const lastSearchAt = analyticsSession.lastSearchAt();
    track({
      name: "game-detail-viewed",
      data: {
        locale,
        entry: analyticsSession.takeEntry(),
        ...(lastSearchAt !== undefined && {
          sinceSearch: sinceSearchBucket(performance.now() - lastSearchAt),
        }),
      },
    });
    if (stale) {
      track({ name: "stale-data-shown", data: { locale, surface: "game" } });
    }
  }, [locale, stale]);

  useEffect(() => {
    function clicked(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest(
        "[data-analytics-link]",
      );
      const label = link?.getAttribute("data-analytics-link");
      if (label) {
        track({
          name: "external-link-clicked",
          data: { locale, link: linkCategory(label) },
        });
      }
    }
    document.addEventListener("click", clicked, { capture: true });
    return () =>
      document.removeEventListener("click", clicked, { capture: true });
  }, [locale]);

  return null;
}

/** Sends a game-page failure once it is shown. */
export function GameFailureAnalytics({ code }: { code: FailureCode }) {
  const locale = useAnalyticsLocale();

  useEffect(() => {
    track({ name: "failure-shown", data: { locale, surface: "game", code } });
  }, [code, locale]);

  return null;
}

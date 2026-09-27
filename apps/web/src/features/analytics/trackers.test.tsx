import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";

import { analyticsSession, enableAnalytics } from "./track";
import {
  GameAnalytics,
  GameFailureAnalytics,
  PageviewTracker,
  SearchAnalytics,
} from "./trackers";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/games" }));

type Call = [unknown, Record<string, unknown> | undefined];
let calls: Call[];

beforeEach(() => {
  calls = [];
  analyticsSession.reset();
  enableAnalytics();
  window.umami = {
    track: (eventOrBuilder, data) => void calls.push([eventOrBuilder, data]),
  };
});

afterEach(() => {
  delete window.umami;
});

function withIntl(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function events(): Call[] {
  return calls.filter(([name]) => typeof name === "string");
}

const searchProps = {
  searchKey: '{"name":"hollow","platformIds":["pc"]}',
  categories: ["platform", "name"] as const,
  sort: "rating",
  direction: "desc",
  result: { ok: true as const, totalItems: 30, stale: false },
};

test("a new search sends its categories and result bucket, never its values", () => {
  render(
    withIntl(
      <SearchAnalytics
        {...searchProps}
        categories={[...searchProps.categories]}
      />,
    ),
  );

  expect(events()).toEqual([
    [
      "search-submitted",
      {
        locale: "en",
        filters: "name,platform",
        sort: "rating",
        direction: "desc",
        results: "25-240",
        refinement: false,
        responseTime: expect.any(String),
      },
    ],
  ]);
  expect(JSON.stringify(calls)).not.toContain("hollow");
});

test("a changed sort on the same search is a sort change, not a new search", () => {
  const { rerender } = render(
    withIntl(<SearchAnalytics {...searchProps} categories={["name"]} />),
  );
  rerender(
    withIntl(
      <SearchAnalytics
        {...searchProps}
        categories={["name"]}
        direction="asc"
        sort="title"
      />,
    ),
  );

  expect(events().map(([name]) => name)).toEqual([
    "search-submitted",
    "sort-changed",
  ]);
  expect(events()[1]![1]).toEqual({
    locale: "en",
    sort: "title",
    direction: "asc",
  });
});

test("a search without criteria reports 'none'", () => {
  render(withIntl(<SearchAnalytics {...searchProps} categories={[]} />));

  expect(events()[0]![1]).toMatchObject({ filters: "none" });
});

test("failures and stale results are reported by category", () => {
  const { rerender } = render(
    withIntl(
      <SearchAnalytics
        {...searchProps}
        categories={[]}
        filtersFailure="RATE_LIMITED"
        result={{ ok: false, code: "UPSTREAM_TIMEOUT" }}
      />,
    ),
  );
  rerender(
    withIntl(
      <SearchAnalytics
        {...searchProps}
        categories={[]}
        filtersFailure="RATE_LIMITED"
        result={{ ok: true, totalItems: 0, stale: true }}
      />,
    ),
  );

  expect(events()).toEqual([
    [
      "failure-shown",
      { locale: "en", surface: "search", code: "UPSTREAM_TIMEOUT" },
    ],
    [
      "failure-shown",
      { locale: "en", surface: "filters", code: "RATE_LIMITED" },
    ],
    [
      "search-submitted",
      expect.objectContaining({ results: "0", refinement: false }),
    ],
    ["stale-data-shown", { locale: "en", surface: "search" }],
  ]);
});

test("a game opened from the results says so, with the time since the search", () => {
  analyticsSession.observeResults("search", "rating:desc", performance.now());
  render(
    withIntl(
      <>
        <PageviewTracker />
        <a data-analytics-entry="search-result" href="#game">
          Result
        </a>
      </>,
    ),
  );
  fireEvent.click(document.querySelector("[data-analytics-entry]")!);
  render(withIntl(<GameAnalytics stale={true} />));

  expect(events()).toEqual([
    [
      "game-detail-viewed",
      { locale: "en", entry: "search-result", sinceSearch: "<30s" },
    ],
    ["stale-data-shown", { locale: "en", surface: "game" }],
  ]);
});

test("a game opened directly has no search timing", () => {
  render(withIntl(<GameAnalytics stale={false} />));

  expect(events()).toEqual([
    ["game-detail-viewed", { locale: "en", entry: "direct" }],
  ]);
});

test("an external link click is sent as its category", () => {
  render(
    withIntl(
      <>
        <GameAnalytics stale={false} />
        <a data-analytics-link="Steam" href="#steam">
          Steam
        </a>
      </>,
    ),
  );
  fireEvent.click(document.querySelector("[data-analytics-link]")!);

  expect(events().at(-1)).toEqual([
    "external-link-clicked",
    { locale: "en", link: "steam" },
  ]);
});

test("a game-page failure is reported by its code", () => {
  render(withIntl(<GameFailureAnalytics code="GAME_NOT_FOUND" />));

  expect(events()).toEqual([
    [
      "failure-shown",
      { locale: "en", surface: "game", code: "GAME_NOT_FOUND" },
    ],
  ]);
});

test("each page view is sent by template", () => {
  render(withIntl(<PageviewTracker />));

  const builders = calls.filter(([first]) => typeof first === "function");
  expect(builders).toHaveLength(1);
});

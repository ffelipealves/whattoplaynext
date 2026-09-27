import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  analyticsSession,
  enableAnalytics,
  flushAnalytics,
  markEntry,
  markSearchSubmitted,
  track,
  trackPageview,
} from "./track";

type Call = Parameters<NonNullable<Window["umami"]>["track"]>;

let calls: Call[];

function installUmami() {
  window.umami = { track: vi.fn((...args: Call) => void calls.push(args)) };
}

beforeEach(() => {
  calls = [];
  analyticsSession.reset();
});

afterEach(() => {
  delete window.umami;
  vi.unstubAllGlobals();
});

const event = {
  name: "sort-changed",
  data: { locale: "en", sort: "rating", direction: "desc" },
} as const;

test("sends nothing until analytics is enabled", () => {
  installUmami();

  track(event);

  expect(calls).toEqual([]);
});

test("sends an allowed event once enabled", () => {
  installUmami();
  enableAnalytics();

  track(event);

  expect(calls).toEqual([["sort-changed", event.data]]);
});

test("holds events until the script loads, then delivers them in order", () => {
  enableAnalytics();
  track(event);
  trackPageview("/en/games");

  installUmami();
  flushAnalytics();

  expect(calls.map(([first]) => typeof first)).toEqual(["string", "function"]);
});

test("never queues more than twenty events", () => {
  enableAnalytics();
  for (let index = 0; index < 30; index += 1) track(event);

  installUmami();
  flushAnalytics();

  expect(calls).toHaveLength(20);
});

test("a page view sends the route template, no title, and only the first referrer host", () => {
  vi.spyOn(document, "referrer", "get").mockReturnValue(
    "https://www.google.com/search?q=the+witcher",
  );
  installUmami();
  enableAnalytics();

  trackPageview("/en/games/1942/the-witcher-3-wild-hunt");
  trackPageview("/en/games");

  const defaults = {
    website: "site",
    hostname: "whattoplaynext.example",
    language: "en-US",
    screen: "1920x1080",
    title: "The Witcher 3: Wild Hunt | What To Play Next",
    url: "/en/games/1942/the-witcher-3-wild-hunt?from=search",
    referrer: "https://www.google.com/search?q=the+witcher",
  };
  const payloads = calls.map(([build]) =>
    (build as (props: Record<string, unknown>) => Record<string, unknown>)(
      defaults,
    ),
  );

  expect(payloads[0]).toEqual({
    website: "site",
    hostname: "whattoplaynext.example",
    language: "en-US",
    screen: "1920x1080",
    url: "/en/games/[game]",
    referrer: "www.google.com",
    title: "",
  });
  expect(payloads[1]).toMatchObject({ url: "/en/games", referrer: "" });
});

test("a result page is a new search, a sort change, or neither", () => {
  expect(analyticsSession.observeResults("a", "rating:desc", 0)).toEqual({
    kind: "search",
    refinement: false,
  });
  expect(analyticsSession.observeResults("a", "rating:desc", 1)).toBeNull();
  expect(analyticsSession.observeResults("a", "title:asc", 2)).toEqual({
    kind: "sort",
  });
  expect(analyticsSession.observeResults("b", "title:asc", 3)).toEqual({
    kind: "search",
    refinement: true,
  });
  expect(analyticsSession.lastSearchAt()).toBe(3);
});

test("a submit time and an entry are each taken once", () => {
  markSearchSubmitted(42);
  markEntry("search-result");

  expect(analyticsSession.takeSubmittedAt()).toBe(42);
  expect(analyticsSession.takeSubmittedAt()).toBeUndefined();
  expect(analyticsSession.takeEntry()).toBe("search-result");
  expect(analyticsSession.takeEntry()).toBe("direct");
});

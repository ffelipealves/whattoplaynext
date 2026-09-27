import { expect, test } from "vitest";

import {
  linkCategory,
  referrerHost,
  responseBucket,
  resultBucket,
  routeTemplate,
  sanitizeEvent,
  sinceSearchBucket,
} from "./events";

test("keeps an allowed event exactly as given", () => {
  const event = {
    name: "search-submitted",
    data: {
      locale: "en",
      filters: "genre,platform",
      sort: "rating",
      direction: "desc",
      results: "25-240",
      refinement: true,
      responseTime: "<0.5s",
    },
  };

  expect(sanitizeEvent(event)).toEqual(event);
});

test("drops an event that is not on the allow-list", () => {
  expect(sanitizeEvent({ name: "page-scrolled", data: {} })).toBeNull();
});

test("drops properties and values that are not on the allow-list", () => {
  const sanitized = sanitizeEvent({
    name: "search-submitted",
    data: {
      locale: "en",
      filters: "platform,Hollow Knight",
      sort: "rating",
      direction: "sideways",
      results: "37",
      refinement: "yes",
      query: "hollow knight",
      gameId: 1942,
      url: "/en/games?name=hollow",
    },
  });

  expect(sanitized).toEqual({
    name: "search-submitted",
    data: { locale: "en", sort: "rating" },
  });
});

test("accepts no filter at all as 'none'", () => {
  expect(
    sanitizeEvent({ name: "search-submitted", data: { filters: "none" } }),
  ).toEqual({ name: "search-submitted", data: { filters: "none" } });
});

test("buckets counts and durations instead of sending them", () => {
  expect([0, 1, 24, 25, 240, 241, 2400, 2401].map(resultBucket)).toEqual([
    "0",
    "1-24",
    "1-24",
    "25-240",
    "25-240",
    "241-2400",
    "241-2400",
    "2400+",
  ]);
  expect([0, 499, 500, 2499, 2500, 9999, 10_000].map(responseBucket)).toEqual([
    "<0.5s",
    "<0.5s",
    "0.5-2.5s",
    "0.5-2.5s",
    "2.5-10s",
    "2.5-10s",
    "10s+",
  ]);
  expect([0, 30_000, 120_000, 600_000].map(sinceSearchBucket)).toEqual([
    "<30s",
    "30s-2m",
    "2-10m",
    "10m+",
  ]);
});

test("maps external-link labels to categories", () => {
  expect(linkCategory("Steam")).toBe("steam");
  expect(linkCategory("Official Website")).toBe("official");
  expect(linkCategory("Some New Store")).toBe("other");
});

test.each([
  ["/en", "/en"],
  ["/pt-br", "/pt-br"],
  ["/en/games", "/en/games"],
  ["/en/games/1942/the-witcher-3-wild-hunt", "/en/games/[game]"],
  ["/pt-br/games/1942", "/pt-br/games/[game]"],
  ["/en/about", "/en/about"],
  ["/en/privacy", "/en/privacy"],
  ["/en/terms/extra", "/en/[other]"],
  ["/en/some/typo", "/en/[other]"],
  ["/fr/games", "/[other]"],
  ["/", "/[other]"],
])("sends %s as the route template %s", (path, template) => {
  expect(routeTemplate(path)).toBe(template);
});

test("keeps only the referring site's host", () => {
  expect(referrerHost("https://www.google.com/search?q=hollow+knight")).toBe(
    "www.google.com",
  );
  expect(referrerHost("")).toBe("");
  expect(referrerHost("not a url")).toBe("");
});

import { expect, test } from "vitest";

import { parseBrowseParams, withBrowseParams } from "./browse-params";

test("defaults to the zero-filter baseline when nothing is provided", () => {
  expect(parseBrowseParams({})).toEqual({
    name: undefined,
    sort: "popularity",
    direction: "desc",
    page: 1,
  });
});

test("parses a trimmed name, sort, direction, and page", () => {
  expect(
    parseBrowseParams({
      name: "  Hollow Knight  ",
      sort: "title",
      direction: "asc",
      page: "3",
    }),
  ).toEqual({
    name: "Hollow Knight",
    sort: "title",
    direction: "asc",
    page: 3,
  });
});

test("defaults direction to ascending for title and duration sorts", () => {
  expect(parseBrowseParams({ sort: "title" }).direction).toBe("asc");
  expect(parseBrowseParams({ sort: "duration" }).direction).toBe("asc");
});

test("defaults direction to descending for other sorts", () => {
  expect(parseBrowseParams({ sort: "popularity" }).direction).toBe("desc");
  expect(parseBrowseParams({ sort: "rating" }).direction).toBe("desc");
  expect(parseBrowseParams({ sort: "release-date" }).direction).toBe("desc");
});

test("drops a blank or whitespace-only name instead of searching for it", () => {
  expect(parseBrowseParams({ name: "   " }).name).toBeUndefined();
});

test("drops a name longer than the public bound rather than truncating it", () => {
  const tooLong = "x".repeat(101);
  expect(parseBrowseParams({ name: tooLong }).name).toBeUndefined();
});

test("keeps a name at exactly the public bound", () => {
  const atBound = "x".repeat(100);
  expect(parseBrowseParams({ name: atBound }).name).toBe(atBound);
});

test("falls back to popularity for an unknown sort value", () => {
  expect(parseBrowseParams({ sort: "not-a-sort" }).sort).toBe("popularity");
});

test("falls back to the sort's default direction for an unknown direction value", () => {
  expect(
    parseBrowseParams({ sort: "title", direction: "sideways" }).direction,
  ).toBe("asc");
});

test("clamps a page below the minimum up to 1", () => {
  expect(parseBrowseParams({ page: "0" }).page).toBe(1);
  expect(parseBrowseParams({ page: "-5" }).page).toBe(1);
});

test("clamps a page above the maximum down to 100", () => {
  expect(parseBrowseParams({ page: "9999" }).page).toBe(100);
});

test("falls back to page 1 for a non-numeric page value", () => {
  expect(parseBrowseParams({ page: "not-a-page" }).page).toBe(1);
});

test("uses only the first value when a scalar param is repeated in the URL", () => {
  expect(parseBrowseParams({ sort: ["title", "rating"] }).sort).toBe("title");
});

test("withBrowseParams keeps the current criteria except the given overrides", () => {
  const current = parseBrowseParams({
    name: "Hollow Knight",
    sort: "title",
    page: "3",
  });

  expect(withBrowseParams(current, { page: 4 })).toEqual({
    name: "Hollow Knight",
    sort: "title",
    direction: "asc",
    page: "4",
  });
});

test("withBrowseParams omits name when there is none to preserve", () => {
  const current = parseBrowseParams({});

  expect(withBrowseParams(current, { page: 2 })).toEqual({
    sort: "popularity",
    direction: "desc",
    page: "2",
  });
});

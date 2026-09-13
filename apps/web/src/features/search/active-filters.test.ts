import { expect, test } from "vitest";

import { activeFilters, withoutFilter } from "./active-filters";
import { parseBrowseParams, withBrowseParams } from "./browse-params";

test("reports no active filters for the zero-filter baseline", () => {
  expect(activeFilters(parseBrowseParams({ name: "Hollow Knight" }))).toEqual(
    [],
  );
});

test("reports one entry per selected id, in category order", () => {
  const params = parseBrowseParams({
    platform: ["pc", "nintendo-switch"],
    genre: ["shooter"],
    gameMode: ["co-operative"],
  });

  expect(activeFilters(params)).toEqual([
    { kind: "platform", id: "pc" },
    { kind: "platform", id: "nintendo-switch" },
    { kind: "genre", id: "shooter" },
    { kind: "gameMode", id: "co-operative" },
  ]);
});

test("reports one entry for a release range regardless of which bounds are set", () => {
  expect(
    activeFilters(parseBrowseParams({ releaseFrom: "2020-01-01" })),
  ).toEqual([{ kind: "release", from: "2020-01-01", to: undefined }]);
  expect(
    activeFilters(
      parseBrowseParams({ releaseFrom: "2020-01-01", releaseTo: "2024-01-01" }),
    ),
  ).toEqual([{ kind: "release", from: "2020-01-01", to: "2024-01-01" }]);
});

test("reports one entry for the rating and one for the duration", () => {
  const params = parseBrowseParams({
    minimumRating: "80",
    durationKind: "fast",
    minimumDurationHours: "2",
    maximumDurationHours: "8",
  });

  expect(activeFilters(params)).toEqual([
    { kind: "rating", minimumRating: 80 },
    {
      kind: "duration",
      durationKind: "fast",
      minimumHours: 2,
      maximumHours: 8,
    },
  ]);
});

test("does not report a duration kind that has no bound to qualify", () => {
  expect(activeFilters(parseBrowseParams({ durationKind: "fast" }))).toEqual(
    [],
  );
});

test("removing one id keeps every other applied criterion", () => {
  const params = parseBrowseParams({
    name: "Hollow Knight",
    sort: "rating",
    page: "4",
    platform: ["pc", "nintendo-switch"],
    genre: ["shooter"],
    minimumRating: "80",
  });

  const query = withBrowseParams(params, {
    ...withoutFilter(params, { kind: "platform", id: "pc" }),
    page: 1,
  });

  expect(query).toEqual({
    name: "Hollow Knight",
    sort: "rating",
    direction: "desc",
    page: "1",
    platform: ["nintendo-switch"],
    genre: ["shooter"],
    minimumRating: "80",
  });
});

test("removing the release chip clears both of its bounds", () => {
  const params = parseBrowseParams({
    releaseFrom: "2020-01-01",
    releaseTo: "2024-01-01",
    platform: ["pc"],
  });

  expect(
    withoutFilter(params, {
      kind: "release",
      from: "2020-01-01",
      to: "2024-01-01",
    }),
  ).toEqual({ releaseFrom: undefined, releaseTo: undefined });
});

test("removing the duration chip clears its bounds and resets the kind", () => {
  const params = parseBrowseParams({
    durationKind: "completionist",
    minimumDurationHours: "10",
  });

  expect(
    withoutFilter(params, {
      kind: "duration",
      durationKind: "completionist",
      minimumHours: 10,
      maximumHours: undefined,
    }),
  ).toEqual({
    durationKind: "normal",
    minimumDurationHours: undefined,
    maximumDurationHours: undefined,
  });
});

test("removing the rating chip clears only the rating", () => {
  const params = parseBrowseParams({ minimumRating: "80", genre: ["shooter"] });

  expect(withoutFilter(params, { kind: "rating", minimumRating: 80 })).toEqual({
    minimumRating: undefined,
  });
});

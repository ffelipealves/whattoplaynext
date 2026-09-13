import { expect, test } from "vitest";

import {
  clearedFilters,
  filterBoundsFrom,
  filterSignature,
  parseBrowseParams,
  readBrowseParams,
  withBrowseParams,
} from "./browse-params";

test("parses a trimmed name, sort, direction, and page", () => {
  expect(
    parseBrowseParams({
      name: "  Hollow Knight  ",
      sort: "title",
      direction: "asc",
      page: "3",
    }),
  ).toMatchObject({
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

const catalogBounds = {
  platformIds: ["pc", "playstation-5", "nintendo-switch"],
  genreIds: ["shooter", "adventure"],
  gameModeIds: ["single-player", "co-operative"],
  maximumNameLength: 100,
  minimumDurationHours: 1,
  maximumDurationHours: 1000,
};

test("defaults to the zero-filter baseline when nothing is provided", () => {
  expect(parseBrowseParams({})).toEqual({
    name: undefined,
    platformIds: [],
    genreIds: [],
    gameModeIds: [],
    releaseFrom: undefined,
    releaseTo: undefined,
    minimumRating: undefined,
    durationKind: "normal",
    minimumDurationHours: undefined,
    maximumDurationHours: undefined,
    sort: "popularity",
    direction: "desc",
    page: 1,
  });
});

test("parses repeated platform, genre, and game-mode params", () => {
  const params = parseBrowseParams(
    {
      platform: ["pc", "nintendo-switch"],
      genre: ["shooter"],
      gameMode: ["single-player", "co-operative"],
    },
    catalogBounds,
  );

  expect(params.platformIds).toEqual(["pc", "nintendo-switch"]);
  expect(params.genreIds).toEqual(["shooter"]);
  expect(params.gameModeIds).toEqual(["single-player", "co-operative"]);
});

test("parses a single id provided as a scalar param", () => {
  expect(
    parseBrowseParams({ platform: "pc" }, catalogBounds).platformIds,
  ).toEqual(["pc"]);
});

test("drops ids the published catalog does not allow-list", () => {
  const params = parseBrowseParams(
    { platform: ["pc", "dreamcast"], genre: ["not-a-genre"] },
    catalogBounds,
  );

  expect(params.platformIds).toEqual(["pc"]);
  expect(params.genreIds).toEqual([]);
});

test("keeps well-formed ids when the catalog is unavailable", () => {
  expect(
    parseBrowseParams({ platform: ["pc", "dreamcast"] }).platformIds,
  ).toEqual(["pc", "dreamcast"]);
});

test("drops malformed ids even without a catalog", () => {
  expect(
    parseBrowseParams({ platform: ["", "  ", "Not An Id", "pc"] }).platformIds,
  ).toEqual(["pc"]);
});

test("deduplicates repeated ids into one selection", () => {
  expect(
    parseBrowseParams({ platform: ["pc", "pc"] }, catalogBounds).platformIds,
  ).toEqual(["pc"]);
});

test("normalizes selected ids to the catalog's own order", () => {
  expect(
    parseBrowseParams({ platform: ["nintendo-switch", "pc"] }, catalogBounds)
      .platformIds,
  ).toEqual(["pc", "nintendo-switch"]);
});

test("parses a release range in ISO date form", () => {
  const params = parseBrowseParams({
    releaseFrom: "2020-01-01",
    releaseTo: "2024-12-31",
  });

  expect(params.releaseFrom).toBe("2020-01-01");
  expect(params.releaseTo).toBe("2024-12-31");
});

test("drops a release bound that is not a real ISO date", () => {
  expect(
    parseBrowseParams({ releaseFrom: "2020-13-01" }).releaseFrom,
  ).toBeUndefined();
  expect(
    parseBrowseParams({ releaseFrom: "01/02/2020" }).releaseFrom,
  ).toBeUndefined();
  expect(
    parseBrowseParams({ releaseTo: "2020-02-30" }).releaseTo,
  ).toBeUndefined();
});

test("drops an inverted release range instead of forwarding it", () => {
  const params = parseBrowseParams({
    releaseFrom: "2024-01-01",
    releaseTo: "2020-01-01",
  });

  expect(params.releaseFrom).toBeUndefined();
  expect(params.releaseTo).toBeUndefined();
});

test("parses a minimum rating inside the public range", () => {
  expect(parseBrowseParams({ minimumRating: "80" }).minimumRating).toBe(80);
});

test("treats a zero minimum rating as no rating filter", () => {
  expect(
    parseBrowseParams({ minimumRating: "0" }).minimumRating,
  ).toBeUndefined();
});

test("drops a fractional minimum rating the API cannot serve", () => {
  expect(
    parseBrowseParams({ minimumRating: "80.5" }).minimumRating,
  ).toBeUndefined();
});

test("drops a minimum rating outside the public range", () => {
  expect(
    parseBrowseParams({ minimumRating: "101" }).minimumRating,
  ).toBeUndefined();
  expect(
    parseBrowseParams({ minimumRating: "-1" }).minimumRating,
  ).toBeUndefined();
  expect(
    parseBrowseParams({ minimumRating: "great" }).minimumRating,
  ).toBeUndefined();
});

test("parses the duration kind and bounds", () => {
  const params = parseBrowseParams(
    {
      durationKind: "completionist",
      minimumDurationHours: "5",
      maximumDurationHours: "40",
    },
    catalogBounds,
  );

  expect(params.durationKind).toBe("completionist");
  expect(params.minimumDurationHours).toBe(5);
  expect(params.maximumDurationHours).toBe(40);
});

test("falls back to the normal duration kind for an unknown value", () => {
  expect(parseBrowseParams({ durationKind: "endless" }).durationKind).toBe(
    "normal",
  );
});

test("drops duration bounds outside the published limits", () => {
  const params = parseBrowseParams(
    { minimumDurationHours: "0", maximumDurationHours: "1001" },
    catalogBounds,
  );

  expect(params.minimumDurationHours).toBeUndefined();
  expect(params.maximumDurationHours).toBeUndefined();
});

test("drops a duration bound that does not resolve to whole seconds", () => {
  expect(
    parseBrowseParams({ minimumDurationHours: "1.0001" }).minimumDurationHours,
  ).toBeUndefined();
});

test("drops an inverted duration range instead of forwarding it", () => {
  const params = parseBrowseParams({
    minimumDurationHours: "40",
    maximumDurationHours: "5",
  });

  expect(params.minimumDurationHours).toBeUndefined();
  expect(params.maximumDurationHours).toBeUndefined();
});

test("withBrowseParams repeats one param per selected id", () => {
  const params = parseBrowseParams(
    { platform: ["pc", "nintendo-switch"], genre: ["shooter"] },
    catalogBounds,
  );

  const query = withBrowseParams(params, {});

  expect(query.platform).toEqual(["pc", "nintendo-switch"]);
  expect(query.genre).toEqual(["shooter"]);
  expect(query.gameMode).toBeUndefined();
});

test("withBrowseParams forwards every applied filter value", () => {
  const params = parseBrowseParams(
    {
      releaseFrom: "2020-01-01",
      releaseTo: "2024-12-31",
      minimumRating: "80",
      durationKind: "fast",
      minimumDurationHours: "2",
      maximumDurationHours: "8",
    },
    catalogBounds,
  );

  expect(withBrowseParams(params, {})).toMatchObject({
    releaseFrom: "2020-01-01",
    releaseTo: "2024-12-31",
    minimumRating: "80",
    durationKind: "fast",
    minimumDurationHours: "2",
    maximumDurationHours: "8",
  });
});

test("withBrowseParams omits the default duration kind", () => {
  const params = parseBrowseParams(
    { minimumDurationHours: "2" },
    catalogBounds,
  );

  expect(withBrowseParams(params, {}).durationKind).toBeUndefined();
  expect(withBrowseParams(params, {}).minimumDurationHours).toBe("2");
});

test("clearedFilters drops every structured filter but keeps name and sort", () => {
  const params = parseBrowseParams(
    {
      name: "Hollow Knight",
      sort: "rating",
      platform: ["pc"],
      minimumRating: "80",
      durationKind: "fast",
      minimumDurationHours: "2",
    },
    catalogBounds,
  );

  const query = withBrowseParams(params, { ...clearedFilters(), page: 1 });

  expect(query).toEqual({
    name: "Hollow Knight",
    sort: "rating",
    direction: "desc",
    page: "1",
  });
});

test("filterBoundsFrom reads the allow-lists and limits the API publishes", () => {
  expect(
    filterBoundsFrom({
      platforms: [{ id: "pc" }, { id: "playstation-5" }],
      genres: [{ id: "shooter" }],
      gameModes: [{ id: "single-player" }],
      limits: {
        maximumNameLength: 80,
        minimumDurationHours: 2,
        maximumDurationHours: 500,
      },
    }),
  ).toEqual({
    platformIds: ["pc", "playstation-5"],
    genreIds: ["shooter"],
    gameModeIds: ["single-player"],
    maximumNameLength: 80,
    minimumDurationHours: 2,
    maximumDurationHours: 500,
  });
});

test("bounds from the API override the mirrored defaults", () => {
  const bounds = filterBoundsFrom({
    platforms: [],
    genres: [],
    gameModes: [],
    limits: {
      maximumNameLength: 5,
      minimumDurationHours: 2,
      maximumDurationHours: 10,
    },
  });

  expect(
    parseBrowseParams({ name: "Hollow Knight" }, bounds).name,
  ).toBeUndefined();
  expect(
    parseBrowseParams({ minimumDurationHours: "1" }, bounds)
      .minimumDurationHours,
  ).toBeUndefined();
  expect(
    parseBrowseParams({ maximumDurationHours: "11" }, bounds)
      .maximumDurationHours,
  ).toBeUndefined();
});

test("filterSignature changes with the applied filters but not with paging", () => {
  const withPlatform = parseBrowseParams({ platform: ["pc"] });

  expect(filterSignature(withPlatform)).toBe(
    filterSignature(parseBrowseParams({ platform: ["pc"], page: "7" })),
  );
  expect(filterSignature(withPlatform)).toBe(
    filterSignature(parseBrowseParams({ platform: ["pc"], name: "Celeste" })),
  );
  expect(filterSignature(withPlatform)).not.toBe(
    filterSignature(parseBrowseParams({})),
  );
  expect(filterSignature(withPlatform)).not.toBe(
    filterSignature(parseBrowseParams({ platform: ["pc"], genre: ["indie"] })),
  );
});

test("reports nothing to ignore for criteria the API accepts", () => {
  expect(
    readBrowseParams(
      {
        name: "Hollow Knight",
        sort: "title",
        direction: "asc",
        page: "3",
        platform: ["pc", "pc"],
        minimumRating: "0",
        releaseFrom: "2020-01-01",
      },
      catalogBounds,
    ).issues,
  ).toEqual([]);
});

test("reports each criterion it had to ignore", () => {
  const { issues } = readBrowseParams(
    {
      name: "x".repeat(101),
      sort: "not-a-sort",
      direction: "sideways",
      page: "9999",
      platform: ["dreamcast"],
      genre: ["not-a-genre"],
      gameMode: ["not-a-mode"],
      releaseFrom: "2020-13-01",
      minimumRating: "101",
      minimumDurationHours: "0",
    },
    catalogBounds,
  );

  expect(issues).toEqual([
    "name",
    "sort",
    "direction",
    "page",
    "platform",
    "genre",
    "gameMode",
    "release",
    "rating",
    "duration",
  ]);
});

test("reports an ignored criterion once, not once per bad value", () => {
  expect(
    readBrowseParams({ platform: ["dreamcast", "gamecube"] }, catalogBounds)
      .issues,
  ).toEqual(["platform"]);
});

test("does not mistake a repeated valid id for an ignored one", () => {
  expect(
    readBrowseParams({ platform: ["pc", "pc"] }, catalogBounds).issues,
  ).toEqual([]);
});

test("reports an inverted range as one ignored criterion", () => {
  expect(
    readBrowseParams(
      { releaseFrom: "2024-01-01", releaseTo: "2020-01-01" },
      catalogBounds,
    ).issues,
  ).toEqual(["release"]);
  expect(
    readBrowseParams(
      { minimumDurationHours: "40", maximumDurationHours: "5" },
      catalogBounds,
    ).issues,
  ).toEqual(["duration"]);
});

test("reports an unknown duration kind alongside the duration bounds", () => {
  expect(
    readBrowseParams({ durationKind: "endless" }, catalogBounds).issues,
  ).toEqual(["duration"]);
});

test("treats a blank name as nothing asked for rather than something ignored", () => {
  expect(readBrowseParams({ name: "   " }, catalogBounds).issues).toEqual([]);
});

test("parseBrowseParams stays the issue-free view of the same parse", () => {
  const searchParams = { sort: "not-a-sort", platform: ["pc"] };

  expect(parseBrowseParams(searchParams, catalogBounds)).toEqual(
    readBrowseParams(searchParams, catalogBounds).params,
  );
});

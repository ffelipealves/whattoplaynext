import { expect, test, vi } from "vitest";

import type { ApiClient } from "@whattoplaynext/contracts";
import { getApiClient } from "@/lib/api-client";

import { parseBrowseParams } from "./browse-params";
import { getSearchResults } from "./get-search-results";
import type { GamePage } from "./get-search-results";

const baselineParams = parseBrowseParams({});

vi.mock("@/lib/api-client", () => ({
  getApiClient: vi.fn(),
}));

const mockedGetApiClient = vi.mocked(getApiClient);

function fakeClient(response: { data?: unknown; error?: unknown }): ApiClient {
  return { GET: vi.fn().mockResolvedValue(response) } as unknown as ApiClient;
}

const samplePage: GamePage = {
  items: [],
  pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 },
  query: { sort: "popularity", direction: "desc" },
  meta: {
    servedFrom: "provider",
    dataMayBeStale: false,
    excludedUnknownDuration: false,
  },
};

test("returns the page on a successful response", async () => {
  mockedGetApiClient.mockReturnValue(fakeClient({ data: samplePage }));

  const result = await getSearchResults(baselineParams);

  expect(result).toEqual({ ok: true, page: samplePage });
});

test("reports failure when the API returns a classified error", async () => {
  mockedGetApiClient.mockReturnValue(
    fakeClient({ error: { error: { code: "UPSTREAM_UNAVAILABLE" } } }),
  );

  const result = await getSearchResults(baselineParams);

  expect(result).toEqual({ ok: false });
});

test("reports failure when the request itself fails (API process down)", async () => {
  mockedGetApiClient.mockReturnValue({
    GET: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
  } as unknown as ApiClient);

  const result = await getSearchResults(baselineParams);

  expect(result).toEqual({ ok: false });
});

test("forwards name, sort, direction, and page as the query", async () => {
  const client = fakeClient({ data: samplePage });
  mockedGetApiClient.mockReturnValue(client);

  await getSearchResults({
    ...baselineParams,
    name: "Hollow Knight",
    sort: "title",
    direction: "asc",
    page: 2,
  });

  expect(client.GET).toHaveBeenCalledWith("/api/v1/games", {
    params: {
      query: {
        name: "Hollow Knight",
        sort: "title",
        direction: "asc",
        page: 2,
      },
    },
  });
});

test("forwards every structured filter as the API's own query params", async () => {
  const client = fakeClient({ data: samplePage });
  mockedGetApiClient.mockReturnValue(client);

  await getSearchResults(
    parseBrowseParams({
      platform: ["pc", "nintendo-switch"],
      genre: ["shooter", "indie"],
      gameMode: ["co-operative"],
      releaseFrom: "2020-01-01",
      releaseTo: "2024-12-31",
      minimumRating: "80",
      durationKind: "completionist",
      minimumDurationHours: "5",
      maximumDurationHours: "40",
    }),
  );

  expect(client.GET).toHaveBeenCalledWith("/api/v1/games", {
    params: {
      query: {
        name: undefined,
        platform: ["pc", "nintendo-switch"],
        genre: ["shooter", "indie"],
        gameMode: ["co-operative"],
        releaseFrom: "2020-01-01",
        releaseTo: "2024-12-31",
        minimumRating: 80,
        durationKind: "completionist",
        minimumDurationHours: 5,
        maximumDurationHours: 40,
        sort: "popularity",
        direction: "desc",
        page: 1,
      },
    },
  });
});

test("omits empty filter categories instead of sending blank params", async () => {
  const client = fakeClient({ data: samplePage });
  mockedGetApiClient.mockReturnValue(client);

  await getSearchResults(baselineParams);

  expect(client.GET).toHaveBeenCalledWith("/api/v1/games", {
    params: {
      query: {
        name: undefined,
        platform: undefined,
        genre: undefined,
        gameMode: undefined,
        releaseFrom: undefined,
        releaseTo: undefined,
        minimumRating: undefined,
        durationKind: undefined,
        minimumDurationHours: undefined,
        maximumDurationHours: undefined,
        sort: "popularity",
        direction: "desc",
        page: 1,
      },
    },
  });
});

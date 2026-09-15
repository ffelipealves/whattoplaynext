import { expect, test, vi } from "vitest";

import type { ApiClient } from "@whattoplaynext/contracts";
import { getApiClient } from "@/lib/api-client";

import { getFilterMetadata, type FilterMetadata } from "./get-filter-metadata";

vi.mock("@/lib/api-client", () => ({
  getApiClient: vi.fn(),
}));

const mockedGetApiClient = vi.mocked(getApiClient);

const sampleMetadata: FilterMetadata = {
  platforms: [{ id: "pc", label: "PC" }],
  genres: [{ id: "shooter", label: "Shooter" }],
  gameModes: [{ id: "single-player", label: "Single player" }],
  durationKinds: ["fast", "normal", "completionist"],
  sortOptions: ["popularity"],
  limits: {
    pageSize: 24,
    maximumPage: 100,
    minimumAutocompleteLength: 2,
    maximumNameLength: 100,
    minimumDurationHours: 1,
    maximumDurationHours: 1000,
  },
};

function fakeClient(response: { data?: unknown; error?: unknown }): ApiClient {
  return { GET: vi.fn().mockResolvedValue(response) } as unknown as ApiClient;
}

test("returns the published metadata on a successful response", async () => {
  const client = fakeClient({ data: sampleMetadata });
  mockedGetApiClient.mockReturnValue(client);

  await expect(getFilterMetadata()).resolves.toEqual({
    ok: true,
    metadata: sampleMetadata,
  });
  expect(client.GET).toHaveBeenCalledWith("/api/v1/filters");
});

test("reports failure when the API returns a classified error", async () => {
  mockedGetApiClient.mockReturnValue(
    fakeClient({ error: { error: { code: "UPSTREAM_UNAVAILABLE" } } }),
  );

  await expect(getFilterMetadata()).resolves.toEqual({
    ok: false,
    failure: { code: "UPSTREAM_UNAVAILABLE" },
  });
});

test("reports failure when the request itself fails (API process down)", async () => {
  mockedGetApiClient.mockReturnValue({
    GET: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
  } as unknown as ApiClient);

  await expect(getFilterMetadata()).resolves.toEqual({
    ok: false,
    failure: { code: "UNREACHABLE" },
  });
});

test("keeps rate-limit retry timing and the request id", async () => {
  mockedGetApiClient.mockReturnValue(
    fakeClient({
      error: {
        error: {
          code: "RATE_LIMITED",
          retryAfterSeconds: 30,
          requestId: "filters-429",
        },
      },
    }),
  );

  await expect(getFilterMetadata()).resolves.toEqual({
    ok: false,
    failure: {
      code: "RATE_LIMITED",
      retryAfterSeconds: 30,
      requestId: "filters-429",
    },
  });
});

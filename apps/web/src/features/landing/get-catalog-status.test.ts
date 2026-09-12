import { expect, test, vi } from "vitest";

import type { ApiClient } from "@whattoplaynext/contracts";
import { getApiClient } from "@/lib/api-client";

import { getCatalogStatus } from "./get-catalog-status";

vi.mock("@/lib/api-client", () => ({
  getApiClient: vi.fn(),
}));

const mockedGetApiClient = vi.mocked(getApiClient);

function fakeClient(response: { data?: unknown; error?: unknown }): ApiClient {
  return { GET: vi.fn().mockResolvedValue(response) } as unknown as ApiClient;
}

test("reports reachable with normalized counts on a successful response", async () => {
  mockedGetApiClient.mockReturnValue(
    fakeClient({
      data: {
        platforms: [{ id: "pc", label: "PC" }],
        genres: [
          { id: "adventure", label: "Adventure" },
          { id: "indie", label: "Indie" },
        ],
        gameModes: [{ id: "single-player", label: "Single player" }],
      },
    }),
  );

  const status = await getCatalogStatus();

  expect(status).toEqual({
    reachable: true,
    platformCount: 1,
    genreCount: 2,
    gameModeCount: 1,
  });
});

test("reports unreachable when the API returns a classified error", async () => {
  mockedGetApiClient.mockReturnValue(
    fakeClient({ error: { error: { code: "UPSTREAM_UNAVAILABLE" } } }),
  );

  const status = await getCatalogStatus();

  expect(status).toEqual({ reachable: false });
});

test("reports unreachable when the request itself fails (API process down)", async () => {
  mockedGetApiClient.mockReturnValue({
    GET: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
  } as unknown as ApiClient);

  const status = await getCatalogStatus();

  expect(status).toEqual({ reachable: false });
});

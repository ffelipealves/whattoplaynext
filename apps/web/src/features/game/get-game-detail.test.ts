import { expect, test, vi } from "vitest";

import type { ApiClient } from "@whattoplaynext/contracts";
import { getApiClient } from "@/lib/api-client";

import { getGameDetail, type GameDetail } from "./get-game-detail";

vi.mock("@/lib/api-client", () => ({
  getApiClient: vi.fn(),
}));

const mockedGetApiClient = vi.mocked(getApiClient);

function fakeClient(response: {
  data?: unknown;
  error?: unknown;
  response?: Response;
}): ApiClient {
  return { GET: vi.fn().mockResolvedValue(response) } as unknown as ApiClient;
}

const detail = {
  id: 1942,
  slug: "the-witcher-3-wild-hunt",
  title: "The Witcher 3: Wild Hunt",
} as GameDetail;

test("returns normalized detail from the generated client", async () => {
  const client = fakeClient({ data: detail });
  mockedGetApiClient.mockReturnValue(client);

  const result = await getGameDetail(1942);

  expect(result).toEqual({ ok: true, detail });
  expect(client.GET).toHaveBeenCalledWith("/api/v1/games/{gameId}", {
    params: { path: { gameId: 1942 } },
  });
});

test("keeps GAME_NOT_FOUND distinct for the route to render a 404", async () => {
  mockedGetApiClient.mockReturnValue(
    fakeClient({
      error: {
        error: {
          code: "GAME_NOT_FOUND",
          message: "Game not found.",
          requestId: "detail-404",
        },
      },
    }),
  );

  await expect(getGameDetail(9999)).resolves.toEqual({
    ok: false,
    failure: { code: "GAME_NOT_FOUND", requestId: "detail-404" },
  });
});

test("keeps an upstream failure distinct from a missing game", async () => {
  mockedGetApiClient.mockReturnValue(
    fakeClient({
      error: {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Provider unavailable.",
          requestId: "detail-503",
        },
      },
    }),
  );

  await expect(getGameDetail(1942)).resolves.toEqual({
    ok: false,
    failure: { code: "UPSTREAM_UNAVAILABLE", requestId: "detail-503" },
  });
});

test("reports a request that never reached the API", async () => {
  mockedGetApiClient.mockReturnValue({
    GET: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
  } as unknown as ApiClient);

  await expect(getGameDetail(1942)).resolves.toEqual({
    ok: false,
    failure: { code: "UNREACHABLE" },
  });
});

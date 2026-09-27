import { expect, test, vi } from "vitest";

import type { ApiClient } from "@whattoplaynext/contracts";
import { getVisitorApiClient } from "@/lib/api-client";

import {
  getAutocompleteSuggestions,
  type AutocompleteSuggestion,
} from "./get-autocomplete-suggestions";

vi.mock("@/lib/api-client", () => ({
  getVisitorApiClient: vi.fn(),
}));

const mockedGetApiClient = vi.mocked(getVisitorApiClient);

const suggestion: AutocompleteSuggestion = {
  id: 1942,
  slug: "hollow-knight",
  title: "Hollow Knight",
  releaseYear: 2017,
  cover: null,
};

function fakeClient(response: { data?: unknown; error?: unknown }): ApiClient {
  return { GET: vi.fn().mockResolvedValue(response) } as unknown as ApiClient;
}

test("returns the published suggestions on a successful response", async () => {
  const client = fakeClient({
    data: { items: [suggestion], meta: { servedFrom: "provider" } },
  });
  mockedGetApiClient.mockResolvedValue(client);

  await expect(getAutocompleteSuggestions("hollow", [])).resolves.toEqual({
    ok: true,
    items: [suggestion],
  });
  expect(client.GET).toHaveBeenCalledWith("/api/v1/games/autocomplete", {
    params: { query: { q: "hollow", platform: undefined } },
  });
});

test("narrows suggestions by the platforms already applied", async () => {
  const client = fakeClient({ data: { items: [], meta: {} } });
  mockedGetApiClient.mockResolvedValue(client);

  await getAutocompleteSuggestions("hollow", ["pc", "nintendo-switch"]);

  expect(client.GET).toHaveBeenCalledWith("/api/v1/games/autocomplete", {
    params: {
      query: { q: "hollow", platform: ["pc", "nintendo-switch"] },
    },
  });
});

test("reports failure when the API returns a classified error", async () => {
  mockedGetApiClient.mockResolvedValue(
    fakeClient({ error: { error: { code: "RATE_LIMITED" } } }),
  );

  await expect(getAutocompleteSuggestions("hollow", [])).resolves.toEqual({
    ok: false,
  });
});

test("reports failure when the request itself fails (API process down)", async () => {
  mockedGetApiClient.mockResolvedValue({
    GET: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
  } as unknown as ApiClient);

  await expect(getAutocompleteSuggestions("hollow", [])).resolves.toEqual({
    ok: false,
  });
});

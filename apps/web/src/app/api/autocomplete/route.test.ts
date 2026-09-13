import { beforeEach, expect, test, vi } from "vitest";

import { getAutocompleteSuggestions } from "@/features/search/get-autocomplete-suggestions";

import { GET } from "./route";

vi.mock("@/features/search/get-autocomplete-suggestions", () => ({
  getAutocompleteSuggestions: vi.fn(),
}));

const mockedGetSuggestions = vi.mocked(getAutocompleteSuggestions);

const suggestion = {
  id: 1942,
  slug: "hollow-knight",
  title: "Hollow Knight",
  releaseYear: 2017,
  cover: null,
};

function request(query: string): Request {
  return new Request(`http://localhost:3000/api/autocomplete${query}`);
}

beforeEach(() => {
  mockedGetSuggestions.mockReset();
});

test("returns the suggestions for a query", async () => {
  mockedGetSuggestions.mockResolvedValue({ ok: true, items: [suggestion] });

  const response = await GET(request("?q=hollow"));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ items: [suggestion] });
  expect(mockedGetSuggestions).toHaveBeenCalledWith("hollow", []);
});

test("forwards the applied platform context", async () => {
  mockedGetSuggestions.mockResolvedValue({ ok: true, items: [] });

  await GET(request("?q=hollow&platform=pc&platform=nintendo-switch"));

  expect(mockedGetSuggestions).toHaveBeenCalledWith("hollow", [
    "pc",
    "nintendo-switch",
  ]);
});

test("answers a blank query without asking the API", async () => {
  const response = await GET(request("?q=%20%20"));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ items: [] });
  expect(mockedGetSuggestions).not.toHaveBeenCalled();
});

test("reports an upstream failure so the caller can turn itself off", async () => {
  mockedGetSuggestions.mockResolvedValue({ ok: false });

  const response = await GET(request("?q=hollow"));

  expect(response.status).toBe(502);
  await expect(response.json()).resolves.toEqual({ items: [] });
});

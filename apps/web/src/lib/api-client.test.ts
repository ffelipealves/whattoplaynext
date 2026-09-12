import { afterEach, expect, test, vi } from "vitest";

import { getApiClient } from "./api-client";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("throws a clear error when the base URL is not configured", () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");

  expect(() => getApiClient()).toThrowError(/NEXT_PUBLIC_API_BASE_URL/);
});

test("creates a client once the base URL is configured", () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");

  expect(getApiClient().GET).toBeTypeOf("function");
});

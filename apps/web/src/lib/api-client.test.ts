import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { headers } from "next/headers";

import {
  getApiClient,
  getVisitorApiClient,
  visitorAddress,
} from "./api-client";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

const mockedHeaders = vi.mocked(headers);
const fetchMock = vi.fn(async (_request: Request) => Response.json({}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function incoming(values: Record<string, string>) {
  mockedHeaders.mockResolvedValue(
    new Headers(values) as Awaited<ReturnType<typeof headers>>,
  );
}

async function sentHeaders(): Promise<Headers> {
  const client = await getVisitorApiClient();
  await client.GET("/api/v1/filters");
  return fetchMock.mock.calls[0]![0].headers;
}

test("throws a clear error when the base URL is not configured", () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");

  expect(() => getApiClient()).toThrowError(/NEXT_PUBLIC_API_BASE_URL/);
});

test("creates a client once the base URL is configured", () => {
  expect(getApiClient().GET).toBeTypeOf("function");
});

test("forwards the visitor address with the edge token", async () => {
  vi.stubEnv("WTPN_API_EDGE_TOKEN", "edge-secret");
  incoming({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });

  const sent = await sentHeaders();

  expect(sent.get("x-wtpn-client-address")).toBe("203.0.113.9");
  expect(sent.get("x-wtpn-edge-token")).toBe("edge-secret");
});

test("forwards nothing when no edge token is configured", async () => {
  vi.stubEnv("WTPN_API_EDGE_TOKEN", "");
  incoming({ "x-forwarded-for": "203.0.113.9" });

  const sent = await sentHeaders();

  expect(sent.get("x-wtpn-client-address")).toBeNull();
  expect(sent.get("x-wtpn-edge-token")).toBeNull();
});

test("forwards nothing when the request has no visitor address", async () => {
  vi.stubEnv("WTPN_API_EDGE_TOKEN", "edge-secret");
  incoming({});

  const sent = await sentHeaders();

  expect(sent.get("x-wtpn-client-address")).toBeNull();
  expect(sent.get("x-wtpn-edge-token")).toBeNull();
});

test("reads only the first X-Forwarded-For entry, never X-Real-IP", () => {
  expect(
    visitorAddress(
      new Headers({
        "x-real-ip": "198.51.100.7",
        "x-forwarded-for": " 203.0.113.9 ,1.1.1.1",
      }),
    ),
  ).toBe("203.0.113.9");
  expect(
    visitorAddress(new Headers({ "x-real-ip": "198.51.100.7" })),
  ).toBeUndefined();
  expect(
    visitorAddress(new Headers({ "x-forwarded-for": " , " })),
  ).toBeUndefined();
});

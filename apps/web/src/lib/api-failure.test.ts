import { expect, test } from "vitest";

import { UNREACHABLE, classifyApiFailure } from "./api-failure";

function envelope(
  code: string,
  extra: Record<string, unknown> = {},
): { error: Record<string, unknown> } {
  return {
    error: { code, message: "…", requestId: "req-1", ...extra },
  };
}

test("keeps the API's own stable code", () => {
  expect(classifyApiFailure(envelope("UPSTREAM_TIMEOUT"))).toEqual({
    code: "UPSTREAM_TIMEOUT",
    requestId: "req-1",
    retryAfterSeconds: undefined,
  });
});

test("carries the retry timing a rate-limited response provides", () => {
  expect(
    classifyApiFailure(envelope("RATE_LIMITED", { retryAfterSeconds: 30 })),
  ).toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 30 });
});

test("falls back to the Retry-After header when the body omits the timing", () => {
  const response = new Response(null, {
    headers: { "Retry-After": "12" },
    status: 429,
  });

  expect(classifyApiFailure(envelope("RATE_LIMITED"), response)).toMatchObject({
    code: "RATE_LIMITED",
    retryAfterSeconds: 12,
  });
});

test("ignores a Retry-After header that is not a whole number of seconds", () => {
  const response = new Response(null, {
    headers: { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" },
    status: 429,
  });

  expect(
    classifyApiFailure(envelope("RATE_LIMITED"), response).retryAfterSeconds,
  ).toBeUndefined();
});

test("does not invent a zero-second retry when the header is absent", () => {
  const response = new Response(null, { status: 503 });

  expect(
    classifyApiFailure(envelope("UPSTREAM_UNAVAILABLE"), response)
      .retryAfterSeconds,
  ).toBeUndefined();
});

test("reports an unrecognized envelope as an unknown failure", () => {
  expect(classifyApiFailure({ detail: "not our envelope" })).toEqual({
    code: "UNKNOWN",
    requestId: undefined,
    retryAfterSeconds: undefined,
  });
  expect(classifyApiFailure(undefined)).toMatchObject({ code: "UNKNOWN" });
  expect(classifyApiFailure("<html>502 Bad Gateway</html>")).toMatchObject({
    code: "UNKNOWN",
  });
});

test("reports a code outside the published enum as unknown", () => {
  expect(classifyApiFailure(envelope("TEAPOT"))).toMatchObject({
    code: "UNKNOWN",
  });
});

test("names a request that never reached the API", () => {
  expect(UNREACHABLE).toEqual({ code: "UNREACHABLE" });
});

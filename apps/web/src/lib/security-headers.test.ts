import { expect, test } from "vitest";

import { contentSecurityPolicy, securityHeaders } from "./security-headers";

function header(headers: { key: string; value: string }[], key: string) {
  return headers.find((entry) => entry.key === key)?.value;
}

test("the production policy allows only this origin and no plugins or framing", () => {
  const policy = contentSecurityPolicy({
    development: false,
    siteOrigin: "https://whattoplaynext.example",
  });

  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("base-uri 'self'");
  expect(policy).toContain("form-action 'self'");
  expect(policy).toContain("upgrade-insecure-requests");
  expect(policy).not.toContain("unsafe-eval");
  expect(policy).not.toContain("*");
});

test("development allows the tooling that hot reloading needs", () => {
  const policy = contentSecurityPolicy({
    development: true,
    siteOrigin: "http://localhost:3000",
  });

  expect(policy).toContain("'unsafe-eval'");
  expect(policy).toContain("ws:");
});

test("an HTTP origin, such as the local production build, is not upgraded", () => {
  const headers = securityHeaders({
    development: false,
    siteOrigin: "http://localhost:3100",
  });

  expect(header(headers, "Content-Security-Policy")).not.toContain(
    "upgrade-insecure-requests",
  );
  expect(header(headers, "Strict-Transport-Security")).toBeUndefined();
});

test("an HTTPS origin gets strict transport security", () => {
  const headers = securityHeaders({
    development: false,
    siteOrigin: "https://whattoplaynext.example",
  });

  expect(header(headers, "Strict-Transport-Security")).toBe(
    "max-age=31536000; includeSubDomains",
  );
});

test("every page gets the fixed hardening headers", () => {
  const headers = securityHeaders({
    development: false,
    siteOrigin: "https://whattoplaynext.example",
  });

  expect(header(headers, "X-Content-Type-Options")).toBe("nosniff");
  expect(header(headers, "X-Frame-Options")).toBe("DENY");
  expect(header(headers, "Referrer-Policy")).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(header(headers, "Cross-Origin-Opener-Policy")).toBe("same-origin");
  expect(header(headers, "Permissions-Policy")).toContain("camera=()");
  expect(header(headers, "Permissions-Policy")).toContain("browsing-topics=()");
});

test("analytics origins are allowed for scripts and connections only", () => {
  const policy = contentSecurityPolicy({
    development: false,
    siteOrigin: "https://whattoplaynext.example",
    analyticsOrigins: ["https://cloud.umami.is"],
  });

  expect(policy).toContain(
    "script-src 'self' 'unsafe-inline' https://cloud.umami.is",
  );
  expect(policy).toContain("connect-src 'self' https://cloud.umami.is");
  expect(policy).toContain(
    "img-src 'self' data: blob: https://images.igdb.com;",
  );
});

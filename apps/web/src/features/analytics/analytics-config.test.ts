import { expect, test } from "vitest";

import { analyticsConfig, analyticsOrigins } from "./analytics-config";

test("analytics is off without a website ID", () => {
  expect(analyticsConfig({})).toBeUndefined();
  expect(
    analyticsConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: " " }),
  ).toBeUndefined();
  expect(analyticsOrigins(undefined)).toEqual([]);
});

test("Umami Cloud is the default script, and its origin joins the CSP", () => {
  const config = analyticsConfig({ NEXT_PUBLIC_UMAMI_WEBSITE_ID: "site-id" });

  expect(config).toEqual({
    websiteId: "site-id",
    src: "https://cloud.umami.is/script.js",
    hostUrl: undefined,
  });
  expect(analyticsOrigins(config)).toEqual(["https://cloud.umami.is"]);
});

test("a separate collection host is allowed as well", () => {
  const config = analyticsConfig({
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: "site-id",
    NEXT_PUBLIC_UMAMI_SCRIPT_URL: "https://stats.example/script.js",
    NEXT_PUBLIC_UMAMI_HOST_URL: "https://collect.example",
  });

  expect(analyticsOrigins(config)).toEqual([
    "https://stats.example",
    "https://collect.example",
  ]);
});

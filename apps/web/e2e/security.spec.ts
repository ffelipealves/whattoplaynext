import { expect, test } from "@playwright/test";

/**
 * The security headers as a browser receives them from the production build,
 * and proof that the policy does not break the pages it protects.
 */

const PAGES = [
  "/en",
  "/pt-br",
  "/en/games?platform=pc",
  "/en/games/1942/the-witcher-3-wild-hunt",
  "/en/about",
];

test("pages carry the security headers and no framework banner", async ({
  page,
}) => {
  const response = await page.goto("/en");
  const headers = response!.headers();

  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
});

for (const path of PAGES) {
  test(`the content security policy blocks nothing on ${path}`, async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy/i.test(message.text())) {
        violations.push(message.text());
      }
    });
    page.on("pageerror", (error) => violations.push(error.message));

    await page.goto(path);
    await page.waitForLoadState("networkidle");

    expect(violations).toEqual([]);
  });
}

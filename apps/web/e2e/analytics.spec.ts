import { expect, test, type Page } from "@playwright/test";

/**
 * What the application would send to Umami, recorded by a stub script the
 * fixture API serves in its place. FR-050 is checked on the payloads
 * themselves, not on the code that builds them.
 */

type Call = [string, Record<string, unknown>];

const ALLOWED: Record<string, string[]> = {
  pageview: [
    "website",
    "hostname",
    "language",
    "screen",
    "url",
    "referrer",
    "title",
  ],
  "search-submitted": [
    "locale",
    "filters",
    "sort",
    "direction",
    "results",
    "refinement",
    "responseTime",
  ],
  "sort-changed": ["locale", "sort", "direction"],
  "game-detail-viewed": ["locale", "entry", "sinceSearch"],
  "external-link-clicked": ["locale", "link"],
  "failure-shown": ["locale", "surface", "code"],
  "stale-data-shown": ["locale", "surface"],
};

async function recorded(page: Page): Promise<Call[]> {
  return page.evaluate(
    () => (window as unknown as { __umamiCalls?: Call[] }).__umamiCalls ?? [],
  );
}

async function waitForEvent(page: Page, name: string): Promise<Call[]> {
  await expect
    .poll(async () => (await recorded(page)).some(([event]) => event === name))
    .toBe(true);
  return recorded(page);
}

function expectOnlyAllowed(calls: Call[], forbidden: string[]) {
  for (const [name, data] of calls) {
    expect(Object.keys(ALLOWED), `event ${name}`).toContain(name);
    for (const key of Object.keys(data)) {
      expect(ALLOWED[name], `${name}.${key}`).toContain(key);
    }
  }
  const sent = JSON.stringify(calls);
  expect(sent).not.toContain("?");
  for (const value of forbidden) {
    expect(sent.toLowerCase()).not.toContain(value.toLowerCase());
  }
}

test("a search and the game it leads to send only allow-listed events", async ({
  page,
}) => {
  await page.goto(
    "/en?name=The%20Witcher%203&platform=pc&sort=title&direction=asc&page=1",
  );
  const searchCalls = await waitForEvent(page, "search-submitted");

  const pageview = searchCalls.find(([name]) => name === "pageview")!;
  expect(pageview[1]).toMatchObject({ url: "/en", title: "" });
  const search = searchCalls.find(([name]) => name === "search-submitted")!;
  expect(search[1]).toMatchObject({
    locale: "en",
    filters: "name,platform",
    sort: "title",
    direction: "asc",
    refinement: false,
  });

  await page.getByRole("link", { name: /The Witcher 3: Wild Hunt/ }).click();
  const gameCalls = await waitForEvent(page, "game-detail-viewed");
  const gamePageview = gameCalls
    .filter(([name]) => name === "pageview")
    .at(-1)!;
  expect(gamePageview[1]).toMatchObject({ url: "/en/games/[game]", title: "" });
  const detail = gameCalls.find(([name]) => name === "game-detail-viewed")!;
  expect(detail[1]).toMatchObject({ locale: "en", entry: "search-result" });

  await page
    .getByRole("link", { name: "Official Website — external link" })
    .click({ modifiers: ["ControlOrMeta"] });
  const allCalls = await waitForEvent(page, "external-link-clicked");
  expect(
    allCalls.find(([name]) => name === "external-link-clicked")![1],
  ).toEqual({
    locale: "en",
    link: "official",
  });

  expectOnlyAllowed(allCalls, [
    "Witcher",
    "the-witcher-3-wild-hunt",
    "1942",
    "thewitcher.com",
  ]);
});

test("a failed search reports its failure category, never its query", async ({
  page,
}) => {
  await page.goto("/en?name=trigger-upstream-failure");

  const calls = await waitForEvent(page, "failure-shown");

  expect(calls.find(([name]) => name === "failure-shown")![1]).toEqual({
    locale: "en",
    surface: "search",
    code: "UPSTREAM_UNAVAILABLE",
  });
  expectOnlyAllowed(calls, ["trigger-upstream-failure"]);
});

test("stale results are counted without their content", async ({ page }) => {
  await page.goto("/pt-br?name=trigger-stale-data");

  const calls = await waitForEvent(page, "stale-data-shown");

  expect(calls.find(([name]) => name === "stale-data-shown")![1]).toEqual({
    locale: "pt-br",
    surface: "search",
  });
  expectOnlyAllowed(calls, ["trigger-stale-data"]);
});

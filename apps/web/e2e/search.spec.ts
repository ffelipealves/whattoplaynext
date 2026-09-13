import { expect, test } from "@playwright/test";

/**
 * The primary journey from the product requirements, end to end against a
 * fixture-backed API: what a visitor does, not what a component renders.
 */

const UPSTREAM_FAILURE_NAME = "trigger-upstream-failure";

/**
 * Next renders an always-present, usually empty route announcer with
 * `role="alert"`, so "nothing is being announced as an error" means no alert
 * with text in it — not no alert at all.
 */
const SPOKEN_ALERT = { hasText: /\S/ };

test("searching by name narrows the results and shows in the URL", async ({
  page,
}) => {
  await page.goto("/en/games");
  await expect(
    page.getByRole("status").filter({ hasText: "games" }),
  ).toHaveText("60 games");

  await page.getByLabel("Game name").fill("Hollow");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/name=Hollow/);
  await expect(
    page.getByRole("heading", { name: "Hollow Knight", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "games" }),
  ).toHaveText("2 games");
});

test("a shared URL restores the same search, and back and forward keep it", async ({
  page,
}) => {
  await page.goto("/en/games?name=Hollow&sort=title&direction=asc&page=1");

  await expect(page.getByLabel("Game name")).toHaveValue("Hollow");
  await expect(page.getByRole("link", { name: "Title" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "games" }),
  ).toHaveText("2 games");

  await page.getByRole("link", { name: "Rating" }).click();
  await expect(page).toHaveURL(/sort=rating/);

  await page.goBack();
  await expect(page).toHaveURL(/sort=title/);
  await expect(page.getByLabel("Game name")).toHaveValue("Hollow");

  await page.goForward();
  await expect(page).toHaveURL(/sort=rating/);
  await expect(page.getByLabel("Game name")).toHaveValue("Hollow");
});

test("pagination moves through the result set", async ({ page }) => {
  await page.goto("/en/games?sort=title&direction=asc");

  const firstOnPageOne = page.locator("article h3").first();
  await expect(firstOnPageOne).toBeVisible();
  const firstTitle = await firstOnPageOne.textContent();

  await page.getByRole("link", { name: "Next" }).click();

  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("article h3").first()).not.toHaveText(firstTitle!);
  await expect(
    page.getByRole("link", { name: "2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("an upstream failure is an alert, not an empty result set", async ({
  page,
}) => {
  await page.goto(`/en/games?name=${UPSTREAM_FAILURE_NAME}`);

  const alert = page.getByRole("alert").filter(SPOKEN_ALERT);
  await expect(alert).toContainText("The game catalog is unavailable");
  await expect(alert.getByRole("link", { name: "Try again" })).toBeVisible();

  // The distinction the product requirements insist on: no zero-result copy,
  // and no count announced either.
  await expect(page.getByText("No games matched")).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "games" }),
  ).toHaveCount(0);
});

test("a genuine zero-result search says so and suggests a way out", async ({
  page,
}) => {
  await page.goto("/en/games?name=zzzznothing");

  await expect(page.getByText("No games matched “zzzznothing”")).toBeVisible();
  await expect(
    page.getByText("Try a different or shorter title."),
  ).toBeVisible();
  await expect(page.getByRole("alert").filter(SPOKEN_ALERT)).toHaveCount(0);
});

test("switching language carries over to the search page", async ({ page }) => {
  await page.goto("/en");

  await page.getByRole("link", { name: "Português" }).click();
  await expect(page).toHaveURL(/\/pt-br$/);

  await page.goto("/pt-br/games");
  await expect(page.getByRole("heading", { name: "Ver jogos" })).toBeVisible();
  await expect(page.getByLabel("Nome do jogo")).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "jogos" }),
  ).toHaveText("60 jogos");
});

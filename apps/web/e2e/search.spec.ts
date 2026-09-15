import { expect, test } from "@playwright/test";

/**
 * The primary journey from the product requirements, end to end against a
 * fixture-backed API: what a visitor does, not what a component renders.
 */

const UPSTREAM_FAILURE_NAME = "trigger-upstream-failure";
const UPSTREAM_FAILURE_GAME_ID = 999_998;
const DETAIL_GAME_ID = 1942;
const DETAIL_GAME_SLUG = "the-witcher-3-wild-hunt";

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

test("a result opens its canonical game page and back restores the localized search", async ({
  page,
}) => {
  const searchUrl =
    "/pt-br/games?name=The%20Witcher%203&sort=title&direction=asc&page=1";
  await page.goto(searchUrl);

  await page.getByRole("link", { name: /The Witcher 3: Wild Hunt/ }).click();

  await expect(page).toHaveURL(
    `/pt-br/games/${DETAIL_GAME_ID}/${DETAIL_GAME_SLUG}`,
  );
  await expect(
    page.getByRole("heading", { name: "The Witcher 3: Wild Hunt" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Capa de The Witcher 3: Wild Hunt" }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(searchUrl);
  await expect(page.getByLabel("Nome do jogo")).toHaveValue("The Witcher 3");
  await expect(page.getByRole("link", { name: "Título" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("game URLs permanently redirect to the canonical slug in the same locale", async ({
  request,
}) => {
  for (const path of [
    `/pt-br/games/${DETAIL_GAME_ID}`,
    `/pt-br/games/${DETAIL_GAME_ID}/slug-antigo`,
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      `/pt-br/games/${DETAIL_GAME_ID}/${DETAIL_GAME_SLUG}`,
    );
  }
});

test("invalid and missing game IDs render the localized 404", async ({
  request,
}) => {
  for (const path of [
    "/pt-br/games/not-a-number/qualquer-slug",
    "/pt-br/games/0/qualquer-slug",
    "/pt-br/games/999999/qualquer-slug",
  ]) {
    const response = await request.get(path);

    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("Jogo não encontrado");
  }
});

test("a game-detail provider failure is recoverable, noindex, and not a 404", async ({
  page,
}) => {
  const response = await page.goto(
    `/en/games/${UPSTREAM_FAILURE_GAME_ID}/provider-failure`,
  );

  expect(response?.status()).toBe(500);
  await expect(
    page.getByRole("alert").filter({
      hasText: "The game catalog is unavailable",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
  await expect(page.getByText("Game not found")).toHaveCount(0);
});

import { expect, test } from "@playwright/test";

/**
 * The primary journey from the product requirements, end to end against a
 * fixture-backed API: what a visitor does, not what a component renders.
 */

const UPSTREAM_FAILURE_NAME = "trigger-upstream-failure";
const STALE_DATA_NAME = "trigger-stale-data";
const UPSTREAM_FAILURE_GAME_ID = 999_998;
const RATE_LIMIT_FAILURE_GAME_ID = 999_997;
const VALIDATION_FAILURE_GAME_ID = 999_996;
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
  await page.goto("/en");
  await expect(
    page.getByRole("status").filter({ hasText: "games" }),
  ).toHaveText("60 games");

  const nameInput = page.getByLabel("Game name");
  const searchButton = page.getByRole("button", { name: "Search" });
  await nameInput.fill("Hollow");
  // WebKit can keep resolving the asynchronously rendered suggestion list
  // while it waits for the adjacent submit button to settle. Moving focus
  // closes that list through the field's native blur behavior without using
  // Escape, which clears a search input in some browsers.
  await searchButton.focus();
  await searchButton.click();

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
  await page.goto("/en?name=Hollow&sort=title&direction=asc&page=1");

  await expect(page.getByLabel("Game name")).toHaveValue("Hollow");
  const sortMenu = page.getByRole("button", { name: /^Sort:/ });
  await expect(sortMenu).toHaveText("Sort:Title");
  await expect(
    page.getByRole("status").filter({ hasText: "games" }),
  ).toHaveText("2 games");

  await sortMenu.click();
  await expect(page.getByRole("menuitem", { name: "Title" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.getByRole("menuitem", { name: "Rating" }).click();
  await expect(page).toHaveURL(/sort=rating/);

  await page.goBack();
  await expect(page).toHaveURL(/sort=title/);
  await expect(page.getByLabel("Game name")).toHaveValue("Hollow");

  await page.goForward();
  await expect(page).toHaveURL(/sort=rating/);
  await expect(page.getByLabel("Game name")).toHaveValue("Hollow");
});

test("the list layout survives paging and a new name search", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 640,
    "The layout switch shows from the `sm` breakpoint up.",
  );
  await page.goto("/en");

  await page.getByRole("link", { name: "List view" }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(page.getByRole("link", { name: "List view" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/view=list/);

  const name = page.getByLabel("Game name");
  await name.fill("Hollow");
  await name.press("Enter");
  await expect(page).toHaveURL(/name=Hollow/);
  await expect(page).toHaveURL(/view=list/);
});

test("the bare home features popular games, and a search replaces them", async ({
  page,
}) => {
  await page.goto("/en");

  const featured = page.getByRole("region", { name: "Featured games" });
  await expect(
    featured.getByRole("heading", { name: "The Witcher 3: Wild Hunt" }),
  ).toBeVisible();
  await expect(
    featured.getByRole("link", {
      name: "View details: The Witcher 3: Wild Hunt",
    }),
  ).toHaveAttribute("href", `/en/games/${DETAIL_GAME_ID}/${DETAIL_GAME_SLUG}`);

  await page.goto("/en?platform=pc");
  await expect(
    page.getByRole("region", { name: "Featured games" }),
  ).toHaveCount(0);
});

test("pagination moves through the result set", async ({ page }) => {
  await page.goto("/en?sort=title&direction=asc");

  const firstOnPageOne = page.locator("article h3").first();
  await expect(firstOnPageOne).toBeVisible();
  const firstTitle = await firstOnPageOne.textContent();

  await page.getByRole("link", { name: "Next", exact: true }).click();

  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("article h3").first()).not.toHaveText(firstTitle!);
  await expect(
    page.getByRole("link", { name: "2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("an upstream failure is an alert, not an empty result set", async ({
  page,
}) => {
  await page.goto(`/en?name=${UPSTREAM_FAILURE_NAME}`);

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

test("stale saved results are shown with a localized warning, not as current", async ({
  page,
}) => {
  await page.goto(`/en?name=${STALE_DATA_NAME}`);

  const warning = page.getByRole("note");
  await expect(warning).toContainText("may be out of date");
  await expect(warning.locator("time")).toHaveAttribute(
    "datetime",
    "2026-09-26T18:05:00Z",
  );
  await expect(page.locator("article h3").first()).toBeVisible();
  await expect(page.getByRole("alert").filter(SPOKEN_ALERT)).toHaveCount(0);

  await page.goto(`/pt-br?name=${STALE_DATA_NAME}`);
  await expect(page.getByRole("note")).toContainText(
    "podem estar desatualizados",
  );
});

test("a genuine zero-result search says so and suggests a way out", async ({
  page,
}) => {
  await page.goto("/en?name=zzzznothing");

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

  await page.goto("/pt-br");
  await expect(
    page.getByRole("heading", { level: 1, name: "Todos os jogos" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nome do jogo")).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "jogos" }),
  ).toHaveText("60 jogos");
});

test("the old listing route redirects to the home search and keeps its query", async ({
  request,
}) => {
  const response = await request.get("/en/games?platform=pc&page=2", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toBe("/en?platform=pc&page=2");
});

test("the header switches language in place and searches from any page", async ({
  page,
}) => {
  const gamePath = `/games/${DETAIL_GAME_ID}/${DETAIL_GAME_SLUG}`;
  await page.goto(`/en${gamePath}`);

  await page.getByRole("link", { name: "Português" }).click();
  await expect(page).toHaveURL(`/pt-br${gamePath}`);

  const name = page.getByLabel("Nome do jogo");
  await name.fill("Hollow");
  await name.press("Enter");

  await expect(page).toHaveURL(/\/pt-br\?(?:.*&)?name=Hollow$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Resultados para “Hollow”" }),
  ).toBeVisible();
});

test("a result opens its canonical game page and back restores the localized search", async ({
  page,
}) => {
  const searchUrl =
    "/pt-br?name=The%20Witcher%203&sort=title&direction=asc&page=1";
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
  await expect(
    page.getByText(
      "A story-driven, next-generation open world role-playing game.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Conteúdo fornecido em inglês")).toBeVisible();
  await expect(page.getByText("IGDB user")).toBeVisible();
  await expect(page.getByText("IGDB critic")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Official Website — link externo" }),
  ).toHaveAttribute("target", "_blank");

  const firstScreenshot = page.getByRole("button", {
    name: "Abrir captura de tela 1 de The Witcher 3: Wild Hunt",
  });
  await firstScreenshot.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", {
      name: "Captura de tela 1 de The Witcher 3: Wild Hunt",
    }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("dialog", {
      name: "Captura de tela 2 de The Witcher 3: Wild Hunt",
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(firstScreenshot).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(searchUrl);
  await expect(page.getByLabel("Nome do jogo")).toHaveValue("The Witcher 3");
  await expect(page.getByRole("button", { name: /^Ordenar:/ })).toHaveText(
    "Ordenar:Título",
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

test("unknown routes render the localized 404 in both locales", async ({
  request,
}) => {
  for (const [locale, title] of [
    ["en", "Page not found"],
    ["pt-br", "Página não encontrada"],
  ] as const) {
    const response = await request.get(`/${locale}/route-that-does-not-exist`);

    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toContain(title);
    expect(html).toContain('name="robots" content="noindex"');
  }
});

test("game failures keep distinct localized states across the production boundary", async ({
  page,
}) => {
  for (const [gameId, title] of [
    [VALIDATION_FAILURE_GAME_ID, "This request could not be run"],
    [RATE_LIMIT_FAILURE_GAME_ID, "Too many requests just now"],
    [UPSTREAM_FAILURE_GAME_ID, "The game catalog is unavailable"],
  ] as const) {
    const response = await page.goto(`/en/games/${gameId}/classified-failure`);

    expect(response?.status()).toBe(500);
    await expect(
      page.getByRole("alert").filter({ hasText: title }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
    if (gameId === RATE_LIMIT_FAILURE_GAME_ID) {
      await expect(
        page.getByText("You can try again in 30 seconds."),
      ).toBeVisible();
    }
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

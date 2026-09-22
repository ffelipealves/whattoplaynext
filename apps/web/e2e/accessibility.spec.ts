import axe from "axe-core";
import { expect, test, type Locator, type Page } from "@playwright/test";

const GAME_PATH = "/games/1942/the-witcher-3-wild-hunt";

async function expectNoSevereAxeViolations(page: Page): Promise<void> {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const browserWindow = window as typeof window & { axe: typeof axe };
    const result = await browserWindow.axe.run(document);
    return result.violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, nodes }) => ({
        id,
        targets: nodes.map(({ target }) => target.join(" ")),
      }));
  });
  expect(violations).toEqual([]);
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press("Tab");
    if (
      await target.evaluate((element) => document.activeElement === element)
    ) {
      await expect(target).toBeFocused();
      expect(
        await target.evaluate((element) => element.matches(":focus-visible")),
      ).toBe(true);
      return;
    }
  }
  throw new Error("The keyboard could not reach the target control.");
}

test("autocomplete waits for the real debounce, announces options, and selects by keyboard", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("**/api/autocomplete?**", async (route) => {
    requests.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    await route.continue();
  });

  await page.goto("/en/games");
  const name = page.getByRole("combobox", { name: "Game name" });
  await name.fill("W");
  await page.waitForTimeout(350);
  expect(requests).toEqual([]);

  await name.fill("Wit");
  await page.waitForTimeout(100);
  await name.fill("Witcher");
  const option = page.getByRole("option", { name: /The Witcher 3: Wild Hunt/ });
  await expect(option).toBeVisible();
  expect(requests).toEqual(["Witcher"]);
  await expect(name).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("status").filter({ hasText: /suggestion/i }),
  ).toBeVisible();
  await expectNoSevereAxeViolations(page);

  await name.press("ArrowDown");
  await expect(option).toHaveAttribute("aria-selected", "true");
  await name.press("Enter");
  await expect(name).toHaveValue("The Witcher 3: Wild Hunt");
  await expect(page).toHaveURL(/\/en\/games$/);
  await name.press("Enter");
  await expect(page).toHaveURL(/name=The\+Witcher\+3%3A\+Wild\+Hunt/);
  await expect(
    page.getByRole("link", { name: /The Witcher 3: Wild Hunt/ }),
  ).toBeVisible();
});

test("autocomplete failure leaves an accessible plain search field", async ({
  page,
}) => {
  await page.route("**/api/autocomplete?**", (route) =>
    route.fulfill({ status: 502, body: "{}" }),
  );
  await page.goto("/en/games");
  await page.waitForLoadState("networkidle");
  const name = page.getByLabel("Game name");
  await name.fill("Hollow");
  await expect(name).not.toHaveAttribute("role", "combobox");
  await expectNoSevereAxeViolations(page);

  await name.press("Enter");
  await expect(page).toHaveURL(/name=Hollow/);
  await expect(
    page.getByRole("heading", { name: "Hollow Knight", exact: true }),
  ).toBeVisible();
});

for (const locale of ["en", "pt-br"] as const) {
  test(`keyboard and accessible-name journey in ${locale}`, async ({
    page,
  }) => {
    if (locale === "pt-br") {
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.goto(`/${locale}/games`);
    await page.waitForLoadState("networkidle");
    // Firefox may leave keyboard focus in browser chrome after navigation.
    // A click on empty page space places it in the document; the journey
    // still reaches every control by Tab and activates it by keyboard.
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    const name = page.getByLabel(
      locale === "en" ? "Game name" : "Nome do jogo",
    );
    await tabTo(page, name);
    await page.keyboard.type("The Witcher 3");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/name=The\+Witcher\+3/);
    const searchUrl = page.url();

    const result = page.getByRole("link", { name: /The Witcher 3: Wild Hunt/ });
    await expect(result).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await tabTo(page, result);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(`/${locale}${GAME_PATH}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "The Witcher 3: Wild Hunt" }),
    ).toBeVisible();
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    expect(await main.ariaSnapshot()).toContain(
      "A story-driven, next-generation open world role-playing game.",
    );
    await expectNoSevereAxeViolations(page);

    const externalLink = page.getByRole("link", {
      name:
        locale === "en"
          ? "Official Website — external link"
          : "Official Website — link externo",
    });
    const href = await externalLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.context().route(href!, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "External site",
      }),
    );
    await tabTo(page, externalLink);
    const popupPromise = page.waitForEvent("popup");
    await page.keyboard.press("Enter");
    const popup = await popupPromise;
    await expect(popup).toHaveURL(href!);
    await popup.close();

    await page.goBack();
    await expect(page).toHaveURL(searchUrl);
    await expect(result).toBeVisible();
  });
}

import { expect, test, type Page } from "@playwright/test";

/**
 * The filter journeys, in whichever layout the viewport gets. Desktop keeps the
 * sidebar beside the results; below Tailwind's `lg` breakpoint the same form
 * lives behind a drawer. Both have to apply exactly what was selected, and
 * nothing before Apply.
 */

const DESKTOP_MIN_WIDTH = 1024;

function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH;
}

function resultCount(page: Page) {
  return page.getByRole("status").filter({ hasText: /games$/ });
}

/** The form's container in this layout, opening the drawer when needed. */
async function openFilters(page: Page) {
  if (isDesktop(page)) {
    const sidebar = page.getByRole("complementary", { name: "Filters" });
    await expect(sidebar).toBeVisible();
    return sidebar;
  }
  await page.getByRole("button", { name: /^Filters/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filters" });
  await expect(drawer).toBeVisible();
  return drawer;
}

test("each viewport gets its own filter layout", async ({ page }) => {
  await page.goto("/en/games");
  await expect(resultCount(page)).toHaveText("60 games");

  const sidebar = page.getByRole("complementary", { name: "Filters" });
  const drawerTrigger = page.getByRole("button", { name: /^Filters/ });

  if (isDesktop(page)) {
    await expect(sidebar).toBeVisible();
    await expect(drawerTrigger).toBeHidden();
  } else {
    await expect(sidebar).toBeHidden();
    await expect(drawerTrigger).toBeVisible();
  }
});

test("a filter reaches the URL only on Apply, combined with AND across categories", async ({
  page,
}) => {
  await page.goto("/en/games");
  await expect(resultCount(page)).toHaveText("60 games");

  const filters = await openFilters(page);
  await filters.getByRole("checkbox", { name: "PC" }).click();
  await filters.getByRole("checkbox", { name: "Shooter" }).click();

  // A selected box is a draft: nothing has been searched for yet.
  await expect(filters.getByRole("checkbox", { name: "PC" })).toBeChecked();
  expect(new URL(page.url()).searchParams.has("platform")).toBe(false);
  await expect(resultCount(page)).toHaveText("60 games");

  await filters.getByRole("button", { name: "Apply filters" }).click();

  await expect(page).toHaveURL(/platform=pc/);
  await expect(page).toHaveURL(/genre=shooter/);
  // The fixture puts PC on every other game and Shooter on every third.
  await expect(resultCount(page)).toHaveText("10 games");
  await expect(
    page.getByRole("link", { name: "Remove filter: Platform: PC" }),
  ).toBeVisible();
});

test("removing one chip clears only that criterion", async ({ page }) => {
  await page.goto("/en/games?platform=pc&genre=shooter");
  await expect(resultCount(page)).toHaveText("10 games");

  await page
    .getByRole("link", { name: "Remove filter: Genre: Shooter" })
    .click();

  await expect(page).not.toHaveURL(/genre=/);
  await expect(page).toHaveURL(/platform=pc/);
  await expect(resultCount(page)).toHaveText("30 games");
});

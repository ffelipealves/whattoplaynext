import { expect, test } from "@playwright/test";

const DETAIL_PATH = "/games/1942/the-witcher-3-wild-hunt";

test("the localized footer reaches every indexable information draft", async ({
  page,
  request,
}) => {
  for (const [locale, links] of [
    [
      "en",
      [
        ["About & data sources", "about"],
        ["Privacy", "privacy"],
        ["Terms", "terms"],
      ],
    ],
    [
      "pt-br",
      [
        ["Sobre e fontes de dados", "about"],
        ["Privacidade", "privacy"],
        ["Termos", "terms"],
      ],
    ],
  ] as const) {
    await page.goto(`/${locale}`);

    for (const [label, segment] of links) {
      const path = `/${locale}/${segment}`;
      await expect(
        page.getByRole("contentinfo").getByRole("link", { name: label }),
      ).toHaveAttribute("href", path);

      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(await response.text()).not.toContain(
        'name="robots" content="noindex"',
      );
    }
  }
});

test("catalog-backed pages show the planned text-only IGDB attribution", async ({
  page,
}) => {
  for (const path of ["/en", "/en/games", `/en${DETAIL_PATH}`]) {
    await page.goto(path);

    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText("Game data and images provided by IGDB");
    await expect(footer.getByRole("link", { name: "IGDB" })).toHaveAttribute(
      "href",
      "https://www.igdb.com/",
    );
    await expect(footer.getByRole("img")).toHaveCount(0);
  }
});

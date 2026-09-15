import { expect, test } from "@playwright/test";

const SITE_ORIGIN = "http://127.0.0.1:3100";
const GAME_PATH = "/games/1942/the-witcher-3-wild-hunt";

async function expectLocalizedUrls(
  page: import("@playwright/test").Page,
  locale: "en" | "pt-br",
  path: string,
) {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${SITE_ORIGIN}/${locale}${path}`,
  );
  await expect(
    page.locator('link[rel="alternate"][hreflang="en"]'),
  ).toHaveAttribute("href", `${SITE_ORIGIN}/en${path}`);
  await expect(
    page.locator('link[rel="alternate"][hreflang="pt-BR"]'),
  ).toHaveAttribute("href", `${SITE_ORIGIN}/pt-br${path}`);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    `${SITE_ORIGIN}/${locale}${path}`,
  );
}

test("home and information metadata are localized and canonical", async ({
  page,
}) => {
  for (const [locale, path, title, description] of [
    [
      "en",
      "",
      "Discover games | What To Play Next",
      "Find games by the constraints that matter right now.",
    ],
    [
      "pt-br",
      "",
      "Descubra jogos | What To Play Next",
      "Encontre jogos pelos critérios que importam agora.",
    ],
    [
      "en",
      "/about",
      "About & data sources | What To Play Next",
      "Learn how What To Play Next works and where its game data comes from.",
    ],
    [
      "pt-br",
      "/about",
      "Sobre e fontes de dados | What To Play Next",
      "Saiba como o What To Play Next funciona e de onde vêm os dados de jogos.",
    ],
    [
      "en",
      "/privacy",
      "Privacy | What To Play Next",
      "Read the current privacy planning draft for What To Play Next.",
    ],
    [
      "pt-br",
      "/privacy",
      "Privacidade | What To Play Next",
      "Leia o rascunho atual de privacidade do What To Play Next.",
    ],
    [
      "en",
      "/terms",
      "Terms | What To Play Next",
      "Read the current terms planning draft for What To Play Next.",
    ],
    [
      "pt-br",
      "/terms",
      "Termos | What To Play Next",
      "Leia o rascunho atual de termos do What To Play Next.",
    ],
  ] as const) {
    await page.goto(`/${locale}${path}`);

    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      description,
    );
    await expectLocalizedUrls(page, locale, path);
  }
});

test("every localized search URL is noindex", async ({ page }) => {
  for (const locale of ["en", "pt-br"] as const) {
    await page.goto(`/${locale}/games?name=Hollow&page=2`);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
});

test("game metadata uses its canonical slug, localized copy, and cover", async ({
  page,
}) => {
  await page.goto(`/pt-br${GAME_PATH}`);

  await expect(page).toHaveTitle(
    "Detalhes de The Witcher 3: Wild Hunt | What To Play Next",
  );
  await expectLocalizedUrls(page, "pt-br", GAME_PATH);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    `${SITE_ORIGIN}/pt-br${GAME_PATH}`,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
});

test("robots.txt allows the public site", async ({ request }) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);
  expect(await response.text()).toBe(
    `User-Agent: *\nAllow: /\n\nHost: ${SITE_ORIGIN}\n`,
  );
});

test("the first-party social fallback is a shareable PNG", async ({
  request,
}) => {
  const response = await request.get("/api/social-preview");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect((await response.body()).byteLength).toBeGreaterThan(1_000);
});

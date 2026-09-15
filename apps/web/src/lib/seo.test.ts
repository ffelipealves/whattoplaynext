import { afterEach, expect, test, vi } from "vitest";

import {
  completeGameDetail,
  sparseGameDetail,
} from "../../test/fixtures/game-detail";

import { buildGameMetadata, buildPageMetadata, getSiteOrigin } from "./seo";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("requires one absolute HTTP site origin without a path", () => {
  vi.stubEnv("WTPN_SITE_ORIGIN", "");
  expect(() => getSiteOrigin()).toThrowError(/WTPN_SITE_ORIGIN/);

  for (const invalid of [
    "not a url",
    "localhost:3000",
    "ftp://example.com",
    "https://example.com/a-path",
    "https://example.com/?query=yes",
  ]) {
    vi.stubEnv("WTPN_SITE_ORIGIN", invalid);
    expect(() => getSiteOrigin()).toThrowError(/absolute HTTP\(S\) origin/);
  }

  vi.stubEnv("WTPN_SITE_ORIGIN", "https://games.example/");
  expect(getSiteOrigin()).toEqual(new URL("https://games.example"));
});

test("builds absolute canonical and language alternates for localized pages", () => {
  const metadata = buildPageMetadata({
    description: "Find a game.",
    locale: "en",
    path: "/about",
    title: "About",
  });

  expect(metadata.alternates).toEqual({
    canonical: "/en/about",
    languages: {
      en: "/en/about",
      "pt-BR": "/pt-br/about",
    },
  });
  expect(metadata.openGraph).toMatchObject({
    description: "Find a game.",
    locale: "en_US",
    url: "/en/about",
  });
  expect(metadata.twitter).toMatchObject({
    card: "summary_large_image",
    description: "Find a game.",
  });
});

test("uses the canonical game slug and provider cover in game social metadata", () => {
  const metadata = buildGameMetadata({
    coverAlt: "The Witcher 3 cover art",
    description: "Game details.",
    detail: completeGameDetail,
    locale: "pt-br",
    title: "The Witcher 3 game details",
  });

  expect(metadata.alternates).toEqual({
    canonical: "/pt-br/games/1942/the-witcher-3-wild-hunt",
    languages: {
      en: "/en/games/1942/the-witcher-3-wild-hunt",
      "pt-BR": "/pt-br/games/1942/the-witcher-3-wild-hunt",
    },
  });
  expect(metadata.openGraph).toMatchObject({
    images: [
      {
        alt: "The Witcher 3 cover art",
        height: 374,
        url: completeGameDetail.cover?.url,
        width: 264,
      },
    ],
    url: "/pt-br/games/1942/the-witcher-3-wild-hunt",
  });
});

test("uses the first-party social image when a game has no cover", () => {
  const metadata = buildGameMetadata({
    coverAlt: "Minimal Game cover art",
    description: "Game details.",
    detail: sparseGameDetail,
    locale: "en",
    title: "Minimal Game details",
  });

  expect(metadata.openGraph).toMatchObject({
    images: [
      {
        alt: "What To Play Next",
        height: 630,
        url: "/api/social-preview",
        width: 1200,
      },
    ],
  });
});

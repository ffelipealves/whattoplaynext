import { afterEach, expect, test, vi } from "vitest";

const { getPopularGames } = vi.hoisted(() => ({ getPopularGames: vi.fn() }));

vi.mock("@/features/sitemap/get-popular-games", () => ({ getPopularGames }));
vi.mock("@/lib/seo", () => ({
  getSiteOrigin: () => new URL("https://games.example"),
}));

import sitemap from "./sitemap";

afterEach(() => {
  getPopularGames.mockReset();
});

test("lists static routes and canonical popular game URLs with alternates", async () => {
  getPopularGames.mockResolvedValue([
    { id: 1942, slug: "the-witcher-3-wild-hunt" },
    { id: 1020, slug: "grand-theft-auto-v" },
  ]);

  await expect(sitemap()).resolves.toEqual([
    {
      url: "https://games.example/en",
      alternates: {
        languages: {
          en: "https://games.example/en",
          "pt-BR": "https://games.example/pt-br",
        },
      },
    },
    {
      url: "https://games.example/en/about",
      alternates: {
        languages: {
          en: "https://games.example/en/about",
          "pt-BR": "https://games.example/pt-br/about",
        },
      },
    },
    {
      url: "https://games.example/en/privacy",
      alternates: {
        languages: {
          en: "https://games.example/en/privacy",
          "pt-BR": "https://games.example/pt-br/privacy",
        },
      },
    },
    {
      url: "https://games.example/en/terms",
      alternates: {
        languages: {
          en: "https://games.example/en/terms",
          "pt-BR": "https://games.example/pt-br/terms",
        },
      },
    },
    {
      url: "https://games.example/en/games/1942/the-witcher-3-wild-hunt",
      alternates: {
        languages: {
          en: "https://games.example/en/games/1942/the-witcher-3-wild-hunt",
          "pt-BR":
            "https://games.example/pt-br/games/1942/the-witcher-3-wild-hunt",
        },
      },
    },
    {
      url: "https://games.example/en/games/1020/grand-theft-auto-v",
      alternates: {
        languages: {
          en: "https://games.example/en/games/1020/grand-theft-auto-v",
          "pt-BR": "https://games.example/pt-br/games/1020/grand-theft-auto-v",
        },
      },
    },
  ]);
});

test("keeps static routes in the sitemap when the popular selection fails", async () => {
  getPopularGames.mockRejectedValue(new Error("IGDB unavailable"));

  const entries = await sitemap();

  expect(entries).toHaveLength(4);
  expect(entries.map((entry) => entry.url)).toEqual([
    "https://games.example/en",
    "https://games.example/en/about",
    "https://games.example/en/privacy",
    "https://games.example/en/terms",
  ]);
});

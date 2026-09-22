import type { MetadataRoute } from "next";

import { getPopularGames } from "@/features/sitemap/get-popular-games";
import { getSiteOrigin } from "@/lib/seo";

export const revalidate = 86_400;

const STATIC_PATHS = ["", "/about", "/privacy", "/terms"] as const;
const DEFAULT_LOCALE = "en";
const SECONDARY_LOCALE = "pt-br";
const POPULAR_GAME_LIMIT = 500;

function localizedUrl(origin: URL, locale: string, path: string): string {
  return new URL(`/${locale}${path}`, origin).toString();
}

function localizedEntry(
  origin: URL,
  path: string,
): MetadataRoute.Sitemap[number] {
  return {
    url: localizedUrl(origin, DEFAULT_LOCALE, path),
    alternates: {
      languages: {
        en: localizedUrl(origin, DEFAULT_LOCALE, path),
        "pt-BR": localizedUrl(origin, SECONDARY_LOCALE, path),
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const staticEntries = STATIC_PATHS.map((path) =>
    localizedEntry(origin, path),
  );

  try {
    const games = await getPopularGames();
    return [
      ...staticEntries,
      ...games
        .slice(0, POPULAR_GAME_LIMIT)
        .map((game) =>
          localizedEntry(origin, `/games/${game.id}/${game.slug}`),
        ),
    ];
  } catch {
    // Search engines must still receive first-party pages when IGDB is down.
    return staticEntries;
  }
}

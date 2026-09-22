import type { components } from "@whattoplaynext/contracts";

import { getApiClient } from "@/lib/api-client";

export type PopularGame = components["schemas"]["PopularGame"];

/** Read the API's daily popularity selection for sitemap generation. */
export async function getPopularGames(): Promise<PopularGame[]> {
  const { data, error } = await getApiClient().GET("/api/v1/games/popular");

  if (error || !data) {
    throw new Error("Could not load the popular-game sitemap selection.");
  }

  return data.items;
}

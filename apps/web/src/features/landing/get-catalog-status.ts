import { getApiClient } from "@/lib/api-client";

export type CatalogStatus =
  | {
      reachable: true;
      platformCount: number;
      genreCount: number;
      gameModeCount: number;
    }
  | { reachable: false };

export async function getCatalogStatus(): Promise<CatalogStatus> {
  try {
    const { data, error } = await getApiClient().GET("/api/v1/filters");

    if (error || !data) {
      return { reachable: false };
    }

    return {
      reachable: true,
      platformCount: data.platforms.length,
      genreCount: data.genres.length,
      gameModeCount: data.gameModes.length,
    };
  } catch {
    // The API process itself is unreachable (connection refused, DNS
    // failure, timeout): fetch() rejects instead of resolving with `error`.
    return { reachable: false };
  }
}

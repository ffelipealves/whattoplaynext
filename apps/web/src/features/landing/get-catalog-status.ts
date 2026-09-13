import { getFilterMetadata } from "@/features/catalog/get-filter-metadata";

export type CatalogStatus =
  | {
      reachable: true;
      platformCount: number;
      genreCount: number;
      gameModeCount: number;
    }
  | { reachable: false };

export async function getCatalogStatus(): Promise<CatalogStatus> {
  const result = await getFilterMetadata();

  if (!result.ok) {
    return { reachable: false };
  }

  return {
    reachable: true,
    platformCount: result.metadata.platforms.length,
    genreCount: result.metadata.genres.length,
    gameModeCount: result.metadata.gameModes.length,
  };
}

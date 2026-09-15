import { notFound } from "next/navigation";

import { getGameDetail, type GameDetail } from "./get-game-detail";
import { gameDetailError } from "./game-detail-error";

export function parseGameId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const gameId = Number(value);
  return Number.isSafeInteger(gameId) ? gameId : null;
}

export async function loadGameDetail(rawGameId: string): Promise<GameDetail> {
  const gameId = parseGameId(rawGameId);
  if (gameId === null) {
    notFound();
  }

  const result = await getGameDetail(gameId);
  if (!result.ok) {
    if (result.failure.code === "GAME_NOT_FOUND") {
      notFound();
    }

    throw gameDetailError(result.failure);
  }

  return result.detail;
}

export function canonicalGamePath(locale: string, detail: GameDetail): string {
  return `/${locale}/games/${detail.id}/${detail.slug}`;
}

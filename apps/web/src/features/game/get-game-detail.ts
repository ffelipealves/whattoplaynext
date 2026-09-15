import type { components } from "@whattoplaynext/contracts";

import { getApiClient } from "@/lib/api-client";
import {
  UNREACHABLE,
  classifyApiFailure,
  type ApiFailure,
} from "@/lib/api-failure";

export type GameDetail = components["schemas"]["GameDetail"];

export type GameDetailResult =
  { ok: true; detail: GameDetail } | { ok: false; failure: ApiFailure };

export async function getGameDetail(gameId: number): Promise<GameDetailResult> {
  try {
    const { data, error, response } = await getApiClient().GET(
      "/api/v1/games/{gameId}",
      { params: { path: { gameId } } },
    );

    if (error || !data) {
      return { ok: false, failure: classifyApiFailure(error, response) };
    }

    return { ok: true, detail: data };
  } catch {
    return { ok: false, failure: UNREACHABLE };
  }
}

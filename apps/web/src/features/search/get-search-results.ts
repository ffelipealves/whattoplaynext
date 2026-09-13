import type { components } from "@whattoplaynext/contracts";

import { getApiClient } from "@/lib/api-client";
import {
  UNREACHABLE,
  classifyApiFailure,
  type ApiFailure,
} from "@/lib/api-failure";

import { DEFAULT_DURATION_KIND, type BrowseParams } from "./browse-params";
import { selectedIds } from "./selected-ids";

export type GamePage = components["schemas"]["GamePage"];

export type SearchResult =
  | { ok: true; page: GamePage }
  // The failure travels with the result: a page that cannot say *why* it is
  // empty can only render an upstream failure as a zero-result search.
  | { ok: false; failure: ApiFailure };

export async function getSearchResults(
  params: BrowseParams,
): Promise<SearchResult> {
  try {
    const { data, error, response } = await getApiClient().GET(
      "/api/v1/games",
      {
        params: {
          query: {
            name: params.name,
            // Repeated params are how the API reads OR within one category;
            // distinct params are AND across categories.
            platform: selectedIds(params.platformIds),
            genre: selectedIds(params.genreIds),
            gameMode: selectedIds(params.gameModeIds),
            releaseFrom: params.releaseFrom,
            releaseTo: params.releaseTo,
            minimumRating: params.minimumRating,
            durationKind:
              params.durationKind === DEFAULT_DURATION_KIND
                ? undefined
                : params.durationKind,
            minimumDurationHours: params.minimumDurationHours,
            maximumDurationHours: params.maximumDurationHours,
            sort: params.sort,
            direction: params.direction,
            page: params.page,
          },
        },
      },
    );

    if (error || !data) {
      return { ok: false, failure: classifyApiFailure(error, response) };
    }

    return { ok: true, page: data };
  } catch {
    // The API process itself is unreachable (connection refused, DNS
    // failure, timeout): fetch() rejects instead of resolving with `error`.
    return { ok: false, failure: UNREACHABLE };
  }
}

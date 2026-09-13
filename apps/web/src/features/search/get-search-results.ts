import type { components } from "@whattoplaynext/contracts";

import { getApiClient } from "@/lib/api-client";

import { DEFAULT_DURATION_KIND, type BrowseParams } from "./browse-params";

export type GamePage = components["schemas"]["GamePage"];

export type SearchResult = { ok: true; page: GamePage } | { ok: false };

/**
 * Hands one category's selected ids to the generated client.
 *
 * A URL can only ever carry strings, and which ids are valid is published at
 * runtime by `GET /api/v1/filters` — the frontend deliberately keeps no second
 * copy of those enums — so this is the single seam where the string form meets
 * the contract's narrower union. Unknown ids are dropped at parse time when the
 * published allow-list is available, and rejected by the API otherwise. An
 * empty category is omitted rather than sent as a blank param, which the API's
 * strict query model forbids.
 */
function selectedIds<Id extends string>(ids: string[]): Id[] | undefined {
  return ids.length > 0 ? (ids as Id[]) : undefined;
}

export async function getSearchResults(
  params: BrowseParams,
): Promise<SearchResult> {
  try {
    const { data, error } = await getApiClient().GET("/api/v1/games", {
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
    });

    if (error || !data) {
      return { ok: false };
    }

    return { ok: true, page: data };
  } catch {
    // The API process itself is unreachable (connection refused, DNS
    // failure, timeout): fetch() rejects instead of resolving with `error`.
    return { ok: false };
  }
}

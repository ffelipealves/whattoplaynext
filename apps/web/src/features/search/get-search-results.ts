import type { components } from "@whattoplaynext/contracts";

import { getApiClient } from "@/lib/api-client";

import type { BrowseParams } from "./browse-params";

export type GamePage = components["schemas"]["GamePage"];

export type SearchResult = { ok: true; page: GamePage } | { ok: false };

export async function getSearchResults(
  params: BrowseParams,
): Promise<SearchResult> {
  try {
    const { data, error } = await getApiClient().GET("/api/v1/games", {
      params: {
        query: {
          name: params.name,
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

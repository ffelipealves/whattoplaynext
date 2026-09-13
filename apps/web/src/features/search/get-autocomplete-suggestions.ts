import type { components } from "@whattoplaynext/contracts";

import { getApiClient } from "@/lib/api-client";

import { selectedIds } from "./selected-ids";

export type AutocompleteSuggestion =
  components["schemas"]["AutocompleteSuggestion"];

export type AutocompleteResult =
  { ok: true; items: AutocompleteSuggestion[] } | { ok: false };

/**
 * Reads title suggestions for a partial name.
 *
 * The same seam as every other API call: the generated client is the only
 * thing that knows the API's paths, and a classified error and an unreachable
 * process collapse to one failure the caller can degrade on, since a search
 * box that cannot suggest must still be typeable.
 */
export async function getAutocompleteSuggestions(
  query: string,
  platformIds: string[],
): Promise<AutocompleteResult> {
  try {
    const { data, error } = await getApiClient().GET(
      "/api/v1/games/autocomplete",
      {
        params: {
          query: {
            q: query,
            // The API narrows suggestions to the platforms in play.
            platform: selectedIds(platformIds),
          },
        },
      },
    );

    if (error || !data) {
      return { ok: false };
    }

    return { ok: true, items: data.items };
  } catch {
    // The API process itself is unreachable (connection refused, DNS
    // failure, timeout): fetch() rejects instead of resolving with `error`.
    return { ok: false };
  }
}

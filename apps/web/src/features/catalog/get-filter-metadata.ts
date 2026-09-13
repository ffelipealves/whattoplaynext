import type { components } from "@whattoplaynext/contracts";

import { getApiClient } from "@/lib/api-client";

export type FilterMetadata = components["schemas"]["FilterMetadata"];
export type CatalogOption = components["schemas"]["CatalogOption"];

export type FilterMetadataResult =
  { ok: true; metadata: FilterMetadata } | { ok: false };

/**
 * Reads the allow-listed filter options and public bounds the API publishes.
 * Every surface that needs them (the landing page's catalog status line, the
 * search page's filter sidebar) shares this one call rather than repeating it.
 */
export async function getFilterMetadata(): Promise<FilterMetadataResult> {
  try {
    const { data, error } = await getApiClient().GET("/api/v1/filters");

    if (error || !data) {
      return { ok: false };
    }

    return { ok: true, metadata: data };
  } catch {
    // The API process itself is unreachable (connection refused, DNS
    // failure, timeout): fetch() rejects instead of resolving with `error`.
    return { ok: false };
  }
}

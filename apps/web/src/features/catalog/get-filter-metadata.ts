import { cache } from "react";
import type { components } from "@whattoplaynext/contracts";

import { getVisitorApiClient } from "@/lib/api-client";
import {
  UNREACHABLE,
  classifyApiFailure,
  type ApiFailure,
} from "@/lib/api-failure";

export type FilterMetadata = components["schemas"]["FilterMetadata"];
export type CatalogOption = components["schemas"]["CatalogOption"];

export type FilterMetadataResult =
  { ok: true; metadata: FilterMetadata } | { ok: false; failure: ApiFailure };

/**
 * Reads the allow-listed filter options and public bounds the API publishes.
 * Every surface that needs them in one request (the search layout's
 * autocomplete, the page's filters and URL validation) shares this one call:
 * `cache` memoizes it for the duration of a server render.
 */
export const getFilterMetadata = cache(
  async function getFilterMetadata(): Promise<FilterMetadataResult> {
    try {
      const { data, error, response } = await (
        await getVisitorApiClient()
      ).GET("/api/v1/filters");

      if (error || !data) {
        return { ok: false, failure: classifyApiFailure(error, response) };
      }

      return { ok: true, metadata: data };
    } catch {
      // The API process itself is unreachable (connection refused, DNS
      // failure, timeout): fetch() rejects instead of resolving with `error`.
      return { ok: false, failure: UNREACHABLE };
    }
  },
);

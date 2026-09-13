"use client";

import { useEffect, useState } from "react";

import type { AutocompleteSuggestion } from "./get-autocomplete-suggestions";

/** Long enough to skip the keystrokes of a word, short enough to feel live. */
export const AUTOCOMPLETE_DEBOUNCE_MS = 300;

type UseAutocompleteOptions = {
  query: string;
  /**
   * The published `limits.minimumAutocompleteLength`. Absent when the filter
   * metadata call failed, which is also the signal to leave the field plain
   * rather than guess a bound the API did not publish.
   */
  minimumQueryLength?: number;
  platformIds: string[];
};

type UseAutocompleteResult = {
  suggestions: AutocompleteSuggestion[];
  /** False once suggestions have failed: the field degrades and stays plain. */
  isAvailable: boolean;
};

type FetchedSuggestions = {
  query: string;
  items: AutocompleteSuggestion[];
};

function suggestionsFrom(payload: unknown): AutocompleteSuggestion[] {
  const items = (payload as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as AutocompleteSuggestion[]) : [];
}

/**
 * Debounced title suggestions for a partial name.
 *
 * Nothing is requested below the published minimum length or inside the
 * debounce window, a superseded request is aborted so a slow answer cannot
 * overwrite a newer one, and any failure turns the enhancement off for good
 * instead of retrying on every keystroke.
 */
export function useAutocomplete({
  query,
  minimumQueryLength,
  platformIds,
}: UseAutocompleteOptions): UseAutocompleteResult {
  const [fetched, setFetched] = useState<FetchedSuggestions>({
    query: "",
    items: [],
  });
  const [hasFailed, setHasFailed] = useState(false);

  // A fresh array prop every render would restart the effect on its own; the
  // selection's identity is its contents.
  const platformKey = platformIds.join(",");
  const isAvailable = !hasFailed && minimumQueryLength !== undefined;
  const trimmed = query.trim();
  const isLongEnough =
    isAvailable && trimmed.length >= (minimumQueryLength ?? 0);

  useEffect(() => {
    if (!isLongEnough) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const search = new URLSearchParams({ q: trimmed });
      for (const platformId of platformKey ? platformKey.split(",") : []) {
        search.append("platform", platformId);
      }

      try {
        const response = await fetch(`/api/autocomplete?${search}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setHasFailed(true);
          return;
        }
        setFetched({
          query: trimmed,
          items: suggestionsFrom(await response.json()),
        });
      } catch {
        if (controller.signal.aborted) {
          // Superseded by a newer query, not a failure.
          return;
        }
        setHasFailed(true);
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isLongEnough, platformKey, trimmed]);

  return {
    // Pairing the results with the query they answer keeps a previous list
    // from flashing under a half-typed new one.
    suggestions: isLongEnough && fetched.query === trimmed ? fetched.items : [],
    isAvailable,
  };
}

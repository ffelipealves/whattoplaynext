"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { AutocompleteSuggestion } from "./get-autocomplete-suggestions";
import { useAutocomplete } from "./use-autocomplete";
import { withBrowseParams, type BrowseParams } from "./browse-params";

type NameSearchFormProps = {
  params: BrowseParams;
  /**
   * The published `limits.minimumAutocompleteLength`. Absent when the filter
   * metadata call failed, which leaves this a plain search field.
   */
  minimumQueryLength?: number;
};

/**
 * Every criterion except the name itself, as hidden fields. Building them from
 * `withBrowseParams` keeps this native GET form producing the same URL shape as
 * the sort, pagination, and chip links — including one repeated field per
 * selected id — so typing a name narrows the applied filters instead of
 * silently dropping them.
 */
function preservedFields(params: BrowseParams): [string, string][] {
  const query = withBrowseParams(params, {});
  // The name comes from the visible field, and omitting `page` is what makes a
  // new name search restart at page 1.
  delete query.name;
  delete query.page;

  return Object.entries(query).flatMap(([name, value]) =>
    Array.isArray(value)
      ? value.map((entry): [string, string] => [name, entry])
      : [[name, value] as [string, string]],
  );
}

export function NameSearchForm({
  params,
  minimumQueryLength,
}: NameSearchFormProps) {
  const t = useTranslations("Search");
  const listId = useId();
  const [query, setQuery] = useState(params.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { suggestions, isAvailable } = useAutocomplete({
    query,
    minimumQueryLength,
    platformIds: params.platformIds,
  });

  const isListOpen = isAvailable && isOpen && suggestions.length > 0;
  const activeOption = isListOpen ? suggestions[activeIndex] : undefined;

  function select(suggestion: AutocompleteSuggestion) {
    // Filling the field is the whole action: the visitor decides when to
    // search, exactly as if they had finished typing the title themselves.
    setQuery(suggestion.title);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isListOpen) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = activeIndex + step;
      setActiveIndex(
        next < 0 ? suggestions.length - 1 : next % suggestions.length,
      );
      return;
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Enter" && activeOption) {
      // Only a highlighted suggestion intercepts Enter; otherwise the form
      // submits the typed name as it always has.
      event.preventDefault();
      select(activeOption);
    }
  }

  return (
    <form action="" className="flex gap-2">
      {preservedFields(params).map(([name, value]) => (
        <input
          key={`${name}-${value}`}
          name={name}
          type="hidden"
          value={value}
        />
      ))}

      <div className="relative flex-1">
        <label className="sr-only" htmlFor="name">
          {t("nameInputLabel")}
        </label>
        <Input
          aria-activedescendant={
            activeOption ? `${listId}-${activeIndex}` : undefined
          }
          aria-autocomplete={isAvailable ? "list" : undefined}
          aria-controls={isAvailable ? listId : undefined}
          aria-expanded={isAvailable ? isListOpen : undefined}
          autoComplete="off"
          id="name"
          name="name"
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("nameInputPlaceholder")}
          role={isAvailable ? "combobox" : undefined}
          type="search"
          value={query}
        />

        {isListOpen && (
          <ul
            aria-label={t("suggestionsLabel")}
            className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl border border-[#17203a]/15 bg-white shadow-lg"
            id={listId}
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <li
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "flex items-center gap-3 bg-[#dce6fb] px-3 py-2"
                    : "flex items-center gap-3 px-3 py-2"
                }
                id={`${listId}-${index}`}
                key={suggestion.id}
                // Pointer-down beats the field's own blur, which would
                // otherwise close the list before the click landed.
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
              >
                <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-[#dce6fb]">
                  {suggestion.cover && (
                    <Image
                      alt={t("coverAlt", { title: suggestion.title })}
                      className="object-cover"
                      fill
                      sizes="36px"
                      src={suggestion.cover.url}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#17203a]">
                    {suggestion.title}
                  </span>
                  <span className="block text-xs text-[#17203a]/55">
                    {suggestion.releaseYear ?? "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {isAvailable && (
          <span aria-live="polite" className="sr-only" role="status">
            {isListOpen
              ? t("suggestionsAnnouncement", { count: suggestions.length })
              : ""}
          </span>
        )}
      </div>

      <Button type="submit">{t("searchButton")}</Button>
    </form>
  );
}

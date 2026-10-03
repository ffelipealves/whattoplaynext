"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  CornerDownLeftIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import { Kbd } from "@/components/ui/kbd";
import { getPathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { AutocompleteSuggestion } from "./get-autocomplete-suggestions";
import { Highlight } from "./highlight";
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

/** Exposes when React has attached this progressive enhancement to the field. */
function markHydrated(node: HTMLInputElement | null) {
  if (node) {
    node.dataset.hydrated = "true";
  }
}

/** True when a keystroke belongs to a field the visitor is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

export function NameSearchForm({
  params,
  minimumQueryLength,
}: NameSearchFormProps) {
  const t = useTranslations("Search");
  const locale = useLocale();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  // "/" and Ctrl/Cmd+K reach the field from anywhere on the page, the way
  // most search-first sites do; "/" is left alone while typing elsewhere.
  useEffect(() => {
    function focusField(event: KeyboardEvent) {
      const isSlash =
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTypingTarget(event.target);
      const isCommandK =
        event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);
      if (!isSlash && !isCommandK) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }

    window.addEventListener("keydown", focusField);
    return () => window.removeEventListener("keydown", focusField);
  }, []);

  function select(suggestion: AutocompleteSuggestion) {
    // Filling the field is the whole action: the visitor decides when to
    // search, exactly as if they had finished typing the title themselves.
    setQuery(suggestion.title);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function clear() {
    // Clearing only empties the field; the applied name stays until the
    // visitor searches again, like every other change to the draft.
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
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
    // The search always runs on the home page, which is the search, so the
    // same field works from a game or information page too.
    <form
      action={getPathname({ href: "/", locale })}
      className="relative min-w-0 flex-1 lg:max-w-xl"
      role="search"
    >
      {preservedFields(params).map(([name, value]) => (
        <input
          key={`${name}-${value}`}
          name={name}
          type="hidden"
          value={value}
        />
      ))}

      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-xl border pr-1.5 pl-3.5 transition-colors focus-within:ring-3 focus-within:ring-ring/30",
          isListOpen
            ? "border-primary/70 bg-ink-850"
            : "border-border bg-card hover:border-ink-700 focus-within:border-primary/70",
        )}
      >
        <SearchIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
        <label className="sr-only" htmlFor="name">
          {t("nameInputLabel")}
        </label>
        <input
          aria-activedescendant={
            activeOption ? `${listId}-${activeIndex}` : undefined
          }
          aria-autocomplete={isAvailable ? "list" : undefined}
          aria-controls={isAvailable ? listId : undefined}
          aria-expanded={isAvailable ? isListOpen : undefined}
          aria-keyshortcuts="/ Control+K Meta+K"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink-50 outline-none placeholder:text-muted-foreground focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
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
          ref={(node) => {
            inputRef.current = node;
            markHydrated(node);
          }}
          role={isAvailable ? "combobox" : undefined}
          type="search"
          value={query}
        />

        {query ? (
          <button
            aria-label={t("clearLabel")}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-ink-800 hover:text-ink-100"
            onClick={clear}
            type="button"
          >
            <XIcon aria-hidden className="size-4" />
          </button>
        ) : (
          <Kbd aria-hidden className="hidden sm:inline-flex">
            /
          </Kbd>
        )}

        <button
          aria-label={t("searchButton")}
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-ink-100 transition-colors hover:bg-primary hover:text-primary-foreground"
          type="submit"
        >
          <ArrowRightIcon aria-hidden className="size-4" />
        </button>
      </div>

      {isListOpen && (
        <div className="fixed inset-x-3 top-[4.25rem] z-50 animate-[pop-in_140ms_var(--ease-out-quart)] overflow-hidden rounded-2xl border border-ink-700 bg-popover shadow-2xl shadow-black/70 sm:absolute sm:inset-x-0 sm:top-[calc(100%+0.5rem)]">
          <ul
            aria-label={t("suggestionsLabel")}
            className="scrollbar-thin max-h-[min(70dvh,32rem)] overflow-y-auto p-1.5"
            id={listId}
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <li
                aria-selected={index === activeIndex}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm",
                  index === activeIndex ? "bg-ink-800" : "hover:bg-ink-800/60",
                )}
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
                <span className="relative aspect-2/3 w-8 shrink-0 overflow-hidden rounded-md bg-ink-800">
                  {suggestion.cover && (
                    <Image
                      alt={t("coverAlt", { title: suggestion.title })}
                      className="object-cover"
                      fill
                      sizes="32px"
                      src={suggestion.cover.url}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink-50">
                    <Highlight term={query} text={suggestion.title} />
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {suggestion.releaseYear ?? "—"}
                  </span>
                </span>
                {index === activeIndex && (
                  <CornerDownLeftIcon
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                )}
              </li>
            ))}
          </ul>
          <p
            aria-hidden
            className="hidden items-center gap-1.5 border-t border-ink-700 px-3.5 py-2 text-[11px] text-muted-foreground sm:flex"
          >
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {t("suggestionsHintNavigate")} <Kbd>↵</Kbd>{" "}
            {t("suggestionsHintSelect")} <Kbd>esc</Kbd>{" "}
            {t("suggestionsHintClose")}
          </p>
        </div>
      )}

      {isAvailable && (
        <span aria-live="polite" className="sr-only" role="status">
          {isListOpen
            ? t("suggestionsAnnouncement", { count: suggestions.length })
            : ""}
        </span>
      )}
    </form>
  );
}

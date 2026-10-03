"use client";

import { useTranslations } from "next-intl";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import { Link } from "@/i18n/navigation";

import {
  defaultDirectionFor,
  withBrowseParams,
  type BrowseParams,
  type SortOption,
} from "./browse-params";

const SORT_OPTIONS: readonly SortOption[] = [
  "popularity",
  "rating",
  "release-date",
  "duration",
  "title",
];

const LABEL_KEYS: Record<SortOption, string> = {
  popularity: "sortPopularity",
  rating: "sortRating",
  "release-date": "sortReleaseDate",
  duration: "sortDuration",
  title: "sortTitle",
};

type SortMenuProps = {
  params: BrowseParams;
};

/**
 * The sort options as a menu whose items are still plain links: each is the
 * same search with that sort, back at page 1, so the URL stays the only state.
 */
export function SortMenu({ params }: SortMenuProps) {
  const t = useTranslations("Search");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border bg-card pr-3 pl-3.5 text-sm text-ink-100 transition-colors hover:border-ink-700 data-[state=open]:border-primary/70">
        {/* Visible from `sm` up; screen readers always hear it. */}
        <span className="sr-only text-muted-foreground sm:not-sr-only">
          {t("sortLabel")}
        </span>
        <span className="truncate">{t(LABEL_KEYS[params.sort])}</span>
        <ChevronDownIcon aria-hidden className="size-4 text-muted-foreground" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-(--radix-dropdown-menu-trigger-width) animate-[pop-in_160ms_var(--ease-out-quart)] overflow-hidden rounded-xl border border-ink-700 bg-popover p-1 shadow-2xl shadow-black/60"
          sideOffset={6}
        >
          {SORT_OPTIONS.map((option) => {
            const isActive = option === params.sort;
            return (
              <DropdownMenu.Item asChild key={option}>
                <Link
                  aria-current={isActive ? "true" : undefined}
                  className="relative flex cursor-pointer items-center rounded-lg py-2 pr-3 pl-8 text-sm text-ink-100 outline-none select-none data-highlighted:bg-ink-800 aria-[current=true]:text-ember-300"
                  href={{
                    pathname: "/",
                    query: withBrowseParams(params, {
                      sort: option,
                      direction: defaultDirectionFor(option),
                      page: 1,
                    }),
                  }}
                >
                  {isActive && (
                    <CheckIcon
                      aria-hidden
                      className="absolute left-2.5 size-4"
                    />
                  )}
                  {t(LABEL_KEYS[option])}
                </Link>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

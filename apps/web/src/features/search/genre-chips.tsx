"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { Popover } from "radix-ui";

import type { CatalogOption } from "@/features/catalog/get-filter-metadata";
import { markSearchSubmitted } from "@/features/analytics/track";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Highlight } from "./highlight";
import { withBrowseParams, type BrowseParams } from "./browse-params";

/**
 * The genres offered as one-click chips, in a fixed order so they never
 * reshuffle under the pointer. The API publishes no facet counts, so this is
 * an editorial pick of the broadest genres; the rest sit behind "More".
 */
const QUICK_GENRE_IDS = [
  "adventure",
  "role-playing-rpg",
  "shooter",
  "indie",
  "strategy",
  "platform",
  "puzzle",
  "simulator",
  "racing",
  "fighting",
];

type GenreChipsProps = {
  params: BrowseParams;
  genres: CatalogOption[];
};

function toggled(ids: string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((current) => current !== id)
    : [...ids, id];
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Whether the row can scroll further left or right, to fade only that edge. */
function useScrollEdges() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () =>
      setEdges({
        start: element.scrollLeft > 2,
        end: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
      });
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  return { ref, edges };
}

function ChipLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: ReactNode;
  href: React.ComponentProps<typeof Link>["href"];
}) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm transition-colors duration-150",
        active
          ? "border-primary bg-primary font-medium text-primary-foreground"
          : "border-ink-700 bg-card text-ink-100 hover:border-ink-600 hover:bg-ink-850",
      )}
      href={href}
      // Each chip is a new search, so it starts the clock the analytics use
      // for time to the first game opened, like Apply does.
      onClick={() => markSearchSubmitted()}
    >
      {children}
    </Link>
  );
}

/**
 * One-click genre filters above the results. Unlike the filter panel, these
 * apply immediately — each is a link to the same search with that genre
 * toggled — so a genre is one click away without opening the panel.
 */
export function GenreChips({ params, genres }: GenreChipsProps) {
  const t = useTranslations("Search");
  const { ref, edges } = useScrollEdges();
  const selected = params.genreIds;
  const byId = new Map(genres.map((genre) => [genre.id, genre]));
  const quick = [
    ...selected,
    ...QUICK_GENRE_IDS.filter((id) => !selected.includes(id)),
  ]
    .map((id) => byId.get(id))
    .filter((genre): genre is CatalogOption => genre !== undefined);

  const hrefFor = (genreIds: string[]) => ({
    pathname: "/",
    query: withBrowseParams(params, { genreIds, page: 1 }),
  });

  const mask = `linear-gradient(to right, ${
    edges.start ? "transparent, black 2rem" : "black"
  }, ${edges.end ? "black calc(100% - 3rem), transparent" : "black"})`;

  return (
    <div className="flex items-center gap-2">
      <nav
        aria-label={t("genreChipsLabel")}
        className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5"
        ref={ref}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        <ChipLink active={selected.length === 0} href={hrefFor([])}>
          {t("allGenres")}
        </ChipLink>
        {quick.map((genre) => (
          <ChipLink
            active={selected.includes(genre.id)}
            href={hrefFor(toggled(selected, genre.id))}
            key={genre.id}
          >
            {/* Provider text: genre labels are never machine-translated. */}
            {genre.label}
          </ChipLink>
        ))}
      </nav>
      <MoreGenres
        genres={genres}
        hiddenCount={genres.length - quick.length}
        hrefFor={hrefFor}
        selected={selected}
      />
    </div>
  );
}

function MoreGenres({
  genres,
  hiddenCount,
  hrefFor,
  selected,
}: {
  genres: CatalogOption[];
  hiddenCount: number;
  hrefFor: (genreIds: string[]) => React.ComponentProps<typeof Link>["href"];
  selected: string[];
}) {
  const t = useTranslations("Search");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = fold(query.trim());
  const visible = genres.filter(
    (genre) => !needle || fold(genre.label).includes(needle),
  );

  return (
    <Popover.Root
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
        }
      }}
      open={open}
    >
      <Popover.Trigger
        className={cn(
          "inline-flex h-[2.125rem] shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
          open
            ? "border-primary/70 bg-ink-850 text-ink-50"
            : "border-dashed border-ink-600 text-ink-100 hover:border-ink-400 hover:bg-card",
        )}
      >
        <span className="hidden sm:inline">{t("moreGenres")}</span>
        <span className="sm:hidden">{t("moreGenresShort")}</span>
        {hiddenCount > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            +{hiddenCount}
          </span>
        )}
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          className="z-50 flex max-h-[min(28.75rem,var(--radix-popover-content-available-height))] w-[min(21.25rem,calc(100vw-2rem))] animate-[pop-in_160ms_var(--ease-out-quart)] flex-col overflow-hidden rounded-2xl border border-ink-700 bg-popover shadow-2xl shadow-black/60 outline-none"
          collisionPadding={16}
          sideOffset={8}
        >
          <div className="border-b border-ink-700 p-2">
            <div className="relative">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                aria-label={t("genreSearchLabel")}
                className="h-10 w-full rounded-xl bg-card pr-9 pl-9 text-sm text-ink-50 outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("genreSearchPlaceholder", {
                  count: genres.length,
                })}
                type="text"
                value={query}
              />
              {query && (
                <button
                  aria-label={t("genreSearchClear")}
                  className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-ink-100"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  <XIcon aria-hidden className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
            {visible.map((genre) => {
              const isSelected = selected.includes(genre.id);
              return (
                <li key={genre.id}>
                  <Link
                    aria-current={isSelected ? "true" : undefined}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-100 outline-none select-none hover:bg-ink-800 focus-visible:bg-ink-800"
                    href={hrefFor(toggled(selected, genre.id))}
                    onClick={() => markSearchSubmitted()}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-[1.125rem] shrink-0 place-items-center rounded-[0.3125rem] border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-ink-600",
                      )}
                    >
                      {isSelected && (
                        <CheckIcon className="size-3" strokeWidth={3.5} />
                      )}
                    </span>
                    <span className="flex-1">
                      <Highlight term={query} text={genre.label} />
                    </span>
                  </Link>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("genreSearchEmpty", { query })}
              </li>
            )}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-ink-700 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">
              {t("genresSelected", { count: selected.length })}
            </span>
            <div className="flex items-center gap-1">
              {selected.length > 0 && (
                <Link
                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs text-ink-300 hover:bg-ink-800 hover:text-ink-50"
                  href={hrefFor([])}
                  onClick={() => markSearchSubmitted()}
                >
                  {t("genresClear")}
                </Link>
              )}
              <Popover.Close className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-ember-400">
                {t("genresDone")}
              </Popover.Close>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

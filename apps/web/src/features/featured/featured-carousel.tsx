"use client";

import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, ClockIcon, PauseIcon, PlayIcon } from "lucide-react";

import { ScoreBadge } from "@/features/catalog/score-badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** How long a slide stays before the next one, while playing. */
const INTERVAL_MS = 7000;

type FeaturedImage = { url: string; width: number; height: number };

/** Only what a slide shows, so the client is not sent whole game records. */
export type FeaturedGame = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  rating: number | null;
  genres: string[];
  normalHours: number | null;
  backdrop: FeaturedImage | null;
  cover: FeaturedImage | null;
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

/**
 * The home page's featured games: a backdrop, the game's pitch, and the
 * covers as tabs. It turns every seven seconds, stops while hovered or
 * focused, has a visible pause control (WCAG 2.2.2), and never turns on its
 * own for someone who asked for reduced motion.
 */
export function FeaturedCarousel({ games }: { games: FeaturedGame[] }) {
  const t = useTranslations("Featured");
  const search = useTranslations("Search");
  const id = useId();
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const canRotate = games.length > 1;
  const playing =
    canRotate && !userPaused && !hovered && !focused && !reducedMotion;
  const game = games[index];
  const next = (index + 1) % games.length;
  const panelId = `${id}-panel`;
  const tabId = (position: number) => `${id}-tab-${position}`;

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = setTimeout(
      () => setIndex((current) => (current + 1) % games.length),
      INTERVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [index, playing, games.length]);

  function moveWithArrows(event: KeyboardEvent<HTMLButtonElement>) {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const target = (index + step + games.length) % games.length;
    setIndex(target);
    document.getElementById(tabId(target))?.focus();
  }

  return (
    <section
      aria-label={t("label")}
      aria-roledescription={t("roleDescription")}
      className="relative isolate overflow-hidden rounded-3xl border border-border bg-card"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
      onFocusCapture={() => setFocused(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div aria-hidden className="absolute inset-0 -z-10 bg-ink-850">
        {/* The current backdrop, and the next one already loading behind it
            so the switch is a fade rather than a blank. */}
        {games.map((featured, position) =>
          featured.backdrop && (position === index || position === next) ? (
            <Image
              alt=""
              className={cn(
                "object-cover transition-opacity duration-700 ease-out-quart",
                position === index ? "opacity-100" : "opacity-0",
              )}
              fill
              key={featured.id}
              preload={position === 0}
              sizes="(min-width: 90rem) 88rem, 100vw"
              src={featured.backdrop.url}
            />
          ) : null,
        )}
      </div>
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-ink-950 via-ink-950/85 to-ink-950/10" />
      {/* Stronger from below on narrow screens, where the text runs over
          the whole width of the image rather than its darkened left side. */}
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-ink-950 via-ink-950/70 to-transparent lg:via-transparent" />
      <div className="grain pointer-events-none absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay" />

      <div className="flex min-h-[23.75rem] flex-col justify-end gap-6 p-5 sm:p-10 lg:min-h-[26.25rem] lg:flex-row lg:items-end lg:justify-between">
        <div
          aria-labelledby={canRotate ? tabId(index) : undefined}
          // A turning carousel would talk over everything; once it stands
          // still, a new slide is announced.
          aria-live={playing ? "off" : "polite"}
          className="max-w-xl animate-[fade-in_350ms_var(--ease-out-quart)]"
          id={panelId}
          key={game.id}
          role={canRotate ? "tabpanel" : undefined}
        >
          <p className="mb-3 font-mono text-xs tracking-[0.2em] text-ember-400 uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-4xl leading-[0.95] font-extrabold tracking-tight text-ink-50 sm:text-5xl lg:text-6xl">
            {game.title}
          </h2>
          {game.summary && (
            <p className="mt-4 line-clamp-2 max-w-lg text-[0.9375rem] leading-relaxed text-ink-300">
              {game.summary}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-300">
            {game.rating !== null && (
              <ScoreBadge
                label={search("ratingLabel", {
                  value: Math.round(game.rating),
                })}
                value={game.rating}
              />
            )}
            {game.genres.length > 0 && <span>{game.genres.join(" · ")}</span>}
            {game.normalHours !== null && (
              <span className="hidden items-center gap-1.5 sm:flex">
                <ClockIcon aria-hidden className="size-3.5" />
                {search("durationHours", { hours: game.normalHours })}
              </span>
            )}
          </div>
          <Link
            // Named for the game, starting with the visible words.
            aria-label={t("detailsLabel", { title: game.title })}
            className="group mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-ink-50 px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-ember-300"
            href={`/games/${game.id}/${game.slug}`}
          >
            {t("details")}
            <ArrowRightIcon
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {canRotate && (
          <div className="flex items-center gap-2.5">
            <div
              aria-label={t("tabsLabel")}
              className="flex gap-2.5"
              role="tablist"
            >
              {games.map((featured, position) => (
                <button
                  aria-controls={panelId}
                  aria-label={featured.title}
                  aria-selected={position === index}
                  className={cn(
                    "relative w-11 overflow-hidden rounded-lg ring-2 transition-all duration-300 sm:w-16",
                    position === index
                      ? "ring-primary"
                      : "opacity-50 ring-transparent hover:opacity-90",
                  )}
                  id={tabId(position)}
                  key={featured.id}
                  onClick={() => setIndex(position)}
                  onKeyDown={moveWithArrows}
                  role="tab"
                  tabIndex={position === index ? 0 : -1}
                  type="button"
                >
                  <span className="relative block aspect-2/3 bg-ink-800">
                    {featured.cover && (
                      <Image
                        alt=""
                        className="object-cover"
                        fill
                        sizes="4rem"
                        src={featured.cover.url}
                      />
                    )}
                  </span>
                  {position === index && playing && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
                      key={`${featured.id}-${index}`}
                      style={{
                        animation: `featured-progress ${INTERVAL_MS}ms linear`,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
            {!reducedMotion && (
              <button
                aria-label={userPaused ? t("play") : t("pause")}
                className="grid size-9 place-items-center rounded-full bg-ink-950/60 text-ink-100 backdrop-blur transition-colors hover:bg-ink-950/80"
                onClick={() => setUserPaused((paused) => !paused)}
                type="button"
              >
                {userPaused ? (
                  <PlayIcon aria-hidden className="size-4" />
                ) : (
                  <PauseIcon aria-hidden className="size-4" />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

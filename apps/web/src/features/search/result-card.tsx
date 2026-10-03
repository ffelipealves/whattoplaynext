import Image from "next/image";
import { useTranslations } from "next-intl";
import { ClockIcon } from "lucide-react";

import { PlatformPills } from "@/features/catalog/platform-pills";
import { ScoreBadge } from "@/features/catalog/score-badge";
import { Link } from "@/i18n/navigation";

import type { GamePage } from "./get-search-results";

type GameSummary = GamePage["items"][number];

type ResultCardProps = {
  game: GameSummary;
};

/** Primary genres and modes only: the card is for comparing, not reading. */
const MAX_LISTED = 2;

function toHours(seconds: number): number {
  return Math.round(seconds / 3600);
}

export function ResultCard({ game }: ResultCardProps) {
  const t = useTranslations("Search");
  const genres = game.genres.slice(0, MAX_LISTED).map((genre) => genre.label);
  const modes = game.gameModes.slice(0, MAX_LISTED).map((mode) => mode.label);

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-2/3 overflow-hidden rounded-2xl bg-ink-850 ring-1 ring-ink-800 transition-all duration-300 ease-out-quart group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-black/60 group-hover:ring-ink-600 group-has-focus-visible:ring-2 group-has-focus-visible:ring-ring">
        {game.cover ? (
          <Image
            // The title sits right below, so the cover adds nothing to say.
            alt=""
            className="object-cover transition-transform duration-500 ease-out-quart group-hover:scale-[1.04]"
            fill
            sizes="(min-width: 1536px) 16rem, (min-width: 1280px) 22vw, (min-width: 640px) 30vw, 50vw"
            src={game.cover.url}
          />
        ) : (
          <div className="grid h-full place-items-center bg-linear-to-br from-ink-800 to-ink-900 p-3 text-center">
            <span className="font-display text-sm font-bold text-ink-300">
              {t("noCover")}
            </span>
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink-950/90 via-ink-950/0 to-ink-950/0 opacity-80 transition-opacity group-hover:opacity-100"
        />
        {game.rating && (
          <ScoreBadge
            className="absolute bottom-2.5 left-2.5"
            label={t("ratingLabel", { value: Math.round(game.rating.value) })}
            size="sm"
            value={game.rating.value}
          />
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1.5 px-0.5">
        <h3 className="font-display text-[15px] leading-tight font-bold text-ink-50 sm:text-base">
          {/* The link is stretched over the whole card, so the cover is a
              target too, while its accessible name stays just the title. */}
          <Link
            className="line-clamp-2 outline-none after:absolute after:inset-0 after:content-['']"
            data-analytics-entry="search-result"
            href={`/games/${game.id}/${game.slug}`}
          >
            {game.title}
          </Link>
        </h3>

        <p className="truncate text-xs text-muted-foreground">
          <span>{game.releaseYear ?? "—"}</span>
          {genres.length > 0 && <span> · {genres.join(" · ")}</span>}
        </p>

        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>
            {game.rating
              ? t("ratingVotes", { count: game.rating.count })
              : t("ratingUnknown")}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon aria-hidden className="size-3" />
            {game.normalDurationSeconds != null
              ? t("durationHours", {
                  hours: toHours(game.normalDurationSeconds),
                })
              : t("durationUnknown")}
          </span>
        </p>

        {modes.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {modes.join(" · ")}
          </p>
        )}

        {game.platforms.length > 0 && (
          <div className="mt-auto pt-1">
            <PlatformPills
              label={t("platformsLabel")}
              platforms={game.platforms}
            />
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * The same game as a list row: a small cover, then everything the card says,
 * laid out across the width with the rating at the end, for scanning down.
 */
export function ResultRow({ game }: ResultCardProps) {
  const t = useTranslations("Search");
  const genres = game.genres.slice(0, 3).map((genre) => genre.label);
  const modes = game.gameModes.slice(0, MAX_LISTED).map((mode) => mode.label);

  return (
    <article className="group relative flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-3 transition-colors hover:border-ink-700 hover:bg-card has-focus-visible:ring-2 has-focus-visible:ring-ring sm:gap-5">
      <div className="relative aspect-2/3 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-850 sm:w-20">
        {game.cover ? (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="5rem"
            src={game.cover.url}
          />
        ) : (
          <span className="grid h-full place-items-center p-1 text-center text-[0.625rem] font-semibold text-ink-300">
            {t("noCover")}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base leading-tight font-bold text-ink-50 sm:text-lg">
          <Link
            className="line-clamp-2 outline-none after:absolute after:inset-0 after:content-[''] sm:line-clamp-1"
            data-analytics-entry="search-result"
            href={`/games/${game.id}/${game.slug}`}
          >
            {game.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
          <span>{game.releaseYear ?? "—"}</span>
          {genres.length > 0 && <span> · {genres.join(" · ")}</span>}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {game.platforms.length > 0 && (
            <PlatformPills
              label={t("platformsLabel")}
              platforms={game.platforms}
            />
          )}
          <span className="inline-flex items-center gap-1">
            <ClockIcon aria-hidden className="size-3" />
            {game.normalDurationSeconds != null
              ? t("durationHours", {
                  hours: toHours(game.normalDurationSeconds),
                })
              : t("durationUnknown")}
          </span>
          {modes.length > 0 && (
            <span className="hidden md:inline">{modes.join(" · ")}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        {game.rating ? (
          <>
            <ScoreBadge
              label={t("ratingLabel", { value: Math.round(game.rating.value) })}
              value={game.rating.value}
            />
            <span className="text-xs text-muted-foreground">
              {t("ratingVotes", { count: game.rating.count })}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("ratingUnknown")}
          </span>
        )}
      </div>
    </article>
  );
}

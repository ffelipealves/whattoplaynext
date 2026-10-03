import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";
import { ExternalLinkIcon } from "lucide-react";

import { StaleDataNotice } from "@/features/catalog/stale-data-notice";
import { PlatformPills } from "@/features/catalog/platform-pills";
import { ratingTone } from "@/features/catalog/score-badge";
import { GameAnalytics } from "@/features/analytics/trackers";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { GameCover } from "./game-cover";
import type { GameDetail } from "./get-game-detail";
import { ScreenshotGallery } from "./screenshot-gallery";

type GameDetailPageProps = {
  detail: GameDetail;
};

type Rating = NonNullable<GameDetail["userRating"]>;
type Duration = NonNullable<GameDetail["durations"]["normal"]>;

const TONE_TEXT_CLASS_NAMES = {
  good: "text-good",
  mid: "text-mid",
  low: "text-low",
} as const;

const TAG_CLASS_NAME =
  "inline-flex rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1 text-xs text-ink-300";

/** A named region of facts, headed like the filter panel's groups. */
function DetailSection({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={className}>
      <h2
        className="mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase"
        id={headingId}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function TagList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li className={TAG_CLASS_NAME} key={item}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function RatingRow({
  label,
  primary,
  rating,
}: {
  label: string;
  primary?: boolean;
  rating: Rating | null;
}) {
  const format = useFormatter();
  const t = useTranslations("Game");

  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm text-ink-100">{label}</h3>
        {rating ? (
          <>
            <p className="text-xs text-muted-foreground">{rating.source}</p>
            <p className="text-xs text-muted-foreground">
              {t("ratingVotes", { count: rating.count })}
            </p>
          </>
        ) : (
          <EmptyState>{t("ratingUnavailable")}</EmptyState>
        )}
      </div>
      {rating && (
        <p
          className={cn(
            "font-mono font-medium tabular-nums",
            primary ? "text-3xl" : "text-xl",
            TONE_TEXT_CLASS_NAMES[ratingTone(rating.value)],
          )}
        >
          {format.number(rating.value, {
            maximumFractionDigits: 1,
            minimumFractionDigits: 1,
          })}
        </p>
      )}
    </li>
  );
}

function DurationStat({
  duration,
  label,
}: {
  duration: Duration | null;
  label: string;
}) {
  const t = useTranslations("Game");

  return (
    <li className="rounded-xl border border-border bg-ink-950/40 p-3">
      <h3 className="text-xs text-muted-foreground">{label}</h3>
      {duration ? (
        <>
          <p className="mt-1 font-display text-xl font-bold text-ink-50">
            {formatDuration(duration.seconds, t)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("durationSubmissions", { count: duration.submissionCount })}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("durationUnavailable")}
        </p>
      )}
    </li>
  );
}

function formatDuration(
  seconds: number,
  t: ReturnType<typeof useTranslations<"Game">>,
): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return t("durationMinutes", { minutes });
  }
  if (minutes === 0) {
    return t("durationHours", { hours });
  }
  return t("durationHoursMinutes", { hours, minutes });
}

/** The earliest known release, for the line above the title. */
function firstReleaseYear(detail: GameDetail): number | undefined {
  const dates = detail.releases
    .map((release) => release.releaseDate)
    .filter((date): date is string => date !== null)
    .sort();
  return dates.length > 0 ? Number(dates[0].slice(0, 4)) : undefined;
}

/**
 * Everything about one game, laid out like the reference's detail dialog: a
 * banner from the first screenshot, the cover over its lower edge beside the
 * title, the facts in the main column and the ratings and links beside them.
 *
 * The page frames it as a card in the page's own `<main>`; the modal opened
 * from the results is itself the frame, so there it goes edge to edge.
 */
export function GameDetailContent({
  detail,
  framed = true,
}: GameDetailPageProps & { framed?: boolean }) {
  const t = useTranslations("Game");
  const locale = useLocale();
  const format = useFormatter();
  const multiplayerFeatures = [
    detail.multiplayer.onlineCoop && t("onlineCoop"),
    detail.multiplayer.offlineCoop && t("offlineCoop"),
    detail.multiplayer.splitScreen && t("splitScreen"),
  ].filter((feature): feature is string => Boolean(feature));
  const summaryLanguageDiffers =
    detail.summaryLanguage != null &&
    locale.split("-")[0] !== detail.summaryLanguage;
  const backdrop = detail.screenshots[0];
  const releaseYear = firstReleaseYear(detail);

  return (
    <>
      <GameAnalytics stale={detail.meta.dataMayBeStale} />
      {detail.meta.dataMayBeStale && (
        <div className={framed ? "mt-6" : "px-5 pt-16 sm:px-8"}>
          <StaleDataNotice meta={detail.meta} />
        </div>
      )}

      <article
        className={cn(
          "overflow-hidden bg-card",
          framed && "mt-6 rounded-3xl border border-border",
        )}
      >
        <div className="relative aspect-video sm:aspect-31/10">
          {backdrop ? (
            <Image
              // Decorative: the same screenshot is listed, described, below.
              alt=""
              className="object-cover"
              fill
              preload
              sizes="(min-width: 72rem) 72rem, 100vw"
              src={backdrop.url}
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-ink-800 to-ink-950">
              <div className="grain absolute inset-0 opacity-10 mix-blend-overlay" />
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-card via-card/30 to-transparent" />
        </div>

        <div className="relative -mt-20 px-5 pb-6 sm:-mt-28 sm:px-8 sm:pb-8">
          <div className="flex items-end gap-4 sm:gap-6">
            <div className="w-24 shrink-0 sm:w-36">
              <GameCover cover={detail.cover} title={detail.title} />
            </div>
            <div className="min-w-0 pb-1">
              {releaseYear !== undefined && (
                <p className="mb-1.5 font-mono text-xs text-muted-foreground">
                  {releaseYear}
                </p>
              )}
              <h1 className="font-display text-2xl leading-[1.05] font-extrabold tracking-tight text-ink-50 sm:text-4xl lg:text-5xl">
                {detail.title}
              </h1>
            </div>
          </div>

          <div className="mt-8 grid gap-6 [grid-template-areas:'ratings'_'main'_'links'] md:grid-cols-[minmax(0,1fr)_17rem] md:grid-rows-[auto_1fr] md:gap-x-8 md:[grid-template-areas:'main_ratings'_'main_links']">
            {/* Ratings come first in reading order, so on a phone they sit
                right under the title rather than after every fact; on wider
                screens the areas put them, and the links, beside the facts. */}
            <div className="h-fit rounded-2xl border border-border bg-ink-950/60 p-5 [grid-area:ratings]">
              <DetailSection title={t("ratingsHeading")}>
                <ul className="space-y-4">
                  <RatingRow
                    label={t("combinedRatingHeading")}
                    primary
                    rating={detail.combinedRating}
                  />
                  <RatingRow
                    label={t("criticRatingHeading")}
                    rating={detail.criticRating}
                  />
                  <RatingRow
                    label={t("userRatingHeading")}
                    rating={detail.userRating}
                  />
                </ul>
              </DetailSection>
            </div>
            <div className="space-y-7 [grid-area:main]">
              <DetailSection title={t("summaryHeading")}>
                {detail.summary ? (
                  <>
                    <p className="text-[0.9375rem] leading-relaxed text-ink-100">
                      {detail.summary}
                    </p>
                    {summaryLanguageDiffers && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("summaryLanguageEnglish")}
                      </p>
                    )}
                  </>
                ) : (
                  <EmptyState>{t("noSummary")}</EmptyState>
                )}
              </DetailSection>

              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <DetailSection title={t("genresHeading")}>
                  {detail.genres.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {detail.genres.map((genre) => (
                        <li key={genre.id}>
                          {/* A genre opens the search for it. */}
                          <Link
                            className={cn(
                              TAG_CLASS_NAME,
                              "transition-colors hover:border-primary/60 hover:text-ink-50",
                            )}
                            href={{
                              pathname: "/",
                              query: { genre: genre.id },
                            }}
                          >
                            {genre.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState>{t("noGenres")}</EmptyState>
                  )}
                </DetailSection>

                <DetailSection title={t("themesHeading")}>
                  {detail.themes.length > 0 ? (
                    <TagList items={detail.themes.map((theme) => theme.name)} />
                  ) : (
                    <EmptyState>{t("noThemes")}</EmptyState>
                  )}
                </DetailSection>

                <DetailSection title={t("platformsHeading")}>
                  {detail.platforms.length > 0 ? (
                    <PlatformPills
                      full
                      label={t("platformsHeading")}
                      platforms={detail.platforms}
                    />
                  ) : (
                    <EmptyState>{t("noPlatforms")}</EmptyState>
                  )}
                </DetailSection>

                <DetailSection title={t("gameModesHeading")}>
                  {detail.gameModes.length > 0 ? (
                    <TagList
                      items={detail.gameModes.map((mode) => mode.label)}
                    />
                  ) : (
                    <EmptyState>{t("noGameModes")}</EmptyState>
                  )}
                </DetailSection>
              </div>

              <DetailSection title={t("durationsHeading")}>
                <ul className="grid grid-cols-3 gap-2">
                  <DurationStat
                    duration={detail.durations.fast}
                    label={t("fast")}
                  />
                  <DurationStat
                    duration={detail.durations.normal}
                    label={t("normal")}
                  />
                  <DurationStat
                    duration={detail.durations.completionist}
                    label={t("completionist")}
                  />
                </ul>
              </DetailSection>

              <div className="grid gap-x-6 gap-y-7 sm:grid-cols-2">
                <DetailSection title={t("releasesHeading")}>
                  {detail.releases.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {detail.releases.map((release, index) => (
                        <li
                          className="flex items-center justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0"
                          key={`${release.platform.id}-${index}`}
                        >
                          <span className="text-ink-100">
                            {release.platform.label}
                          </span>
                          {release.releaseDate ? (
                            <time
                              className="text-muted-foreground"
                              dateTime={release.releaseDate}
                            >
                              {format.dateTime(
                                new Date(`${release.releaseDate}T00:00:00Z`),
                                {
                                  day: "numeric",
                                  month: "long",
                                  timeZone: "UTC",
                                  year: "numeric",
                                },
                              )}
                            </time>
                          ) : (
                            <span className="text-muted-foreground">
                              {t("releaseDateUnavailable")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState>{t("noReleases")}</EmptyState>
                  )}
                </DetailSection>

                <div className="space-y-7">
                  <DetailSection title={t("multiplayerHeading")}>
                    {multiplayerFeatures.length > 0 ? (
                      <>
                        <TagList items={multiplayerFeatures} />
                        <p className="mt-2 text-sm text-muted-foreground">
                          {detail.multiplayer.maxPlayers == null
                            ? t("maxPlayersUnavailable")
                            : t("maxPlayers", {
                                count: detail.multiplayer.maxPlayers,
                              })}
                        </p>
                      </>
                    ) : (
                      <div className="space-y-1">
                        <EmptyState>{t("noMultiplayer")}</EmptyState>
                        <EmptyState>{t("maxPlayersUnavailable")}</EmptyState>
                      </div>
                    )}
                  </DetailSection>

                  <DetailSection title={t("ageRatingsHeading")}>
                    {detail.ageRatings.length > 0 ? (
                      <TagList
                        items={detail.ageRatings.map(
                          (rating) =>
                            `${rating.organization} · ${rating.rating}`,
                        )}
                      />
                    ) : (
                      <EmptyState>{t("noAgeRatings")}</EmptyState>
                    )}
                  </DetailSection>
                </div>
              </div>

              <DetailSection title={t("alternativeNamesHeading")}>
                {detail.alternativeNames.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {detail.alternativeNames.join(" · ")}
                  </p>
                ) : (
                  <EmptyState>{t("noAlternativeNames")}</EmptyState>
                )}
              </DetailSection>
            </div>

            <div className="h-fit rounded-2xl border border-border bg-ink-950/60 p-5 [grid-area:links]">
              <DetailSection title={t("externalLinksHeading")}>
                {detail.externalLinks.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {detail.externalLinks.map((link) => (
                      <li key={link.url}>
                        <a
                          aria-label={t("externalLinkLabel", {
                            label: link.label,
                          })}
                          className="inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-ink-700 px-4 text-sm text-ink-100 transition-colors hover:border-ink-600 hover:bg-ink-850"
                          data-analytics-link={link.label}
                          href={link.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {link.label}
                          <ExternalLinkIcon
                            aria-hidden
                            className="size-3.5 shrink-0 text-muted-foreground"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>{t("noExternalLinks")}</EmptyState>
                )}
              </DetailSection>
            </div>
          </div>
        </div>
      </article>

      <DetailSection
        className={framed ? "mt-10" : "px-5 pb-8 sm:px-8"}
        title={t("screenshotsHeading")}
      >
        <ScreenshotGallery
          screenshots={detail.screenshots}
          title={detail.title}
        />
      </DetailSection>
    </>
  );
}

/** The game's own page: the detail as a card in the page's main region. */
export function GameDetailPage({ detail }: GameDetailPageProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 text-foreground sm:px-6 lg:px-8">
      <GameDetailContent detail={detail} />
    </main>
  );
}

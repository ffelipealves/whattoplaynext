import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";

import { Badge } from "@/components/ui/badge";
import { StaleDataNotice } from "@/features/catalog/stale-data-notice";
import { GameAnalytics } from "@/features/analytics/trackers";

import { GameCover } from "./game-cover";
import type { GameDetail } from "./get-game-detail";
import { ScreenshotGallery } from "./screenshot-gallery";

type GameDetailPageProps = {
  detail: GameDetail;
};

type DetailSectionProps = {
  children: ReactNode;
  title: string;
};

type Rating = NonNullable<GameDetail["userRating"]>;
type Duration = NonNullable<GameDetail["durations"]["normal"]>;

function DetailSection({ children, title }: DetailSectionProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <h2
        className="mb-4 font-display text-xl font-semibold tracking-[-0.02em]"
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
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <Badge variant="secondary">{item}</Badge>
        </li>
      ))}
    </ul>
  );
}

function RatingCard({
  label,
  rating,
}: {
  label: string;
  rating: Rating | null;
}) {
  const format = useFormatter();
  const t = useTranslations("Game");

  return (
    <li className="rounded-xl bg-ink-850 p-4">
      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
      {rating ? (
        <>
          <p className="mt-1 font-display text-2xl font-semibold">
            {format.number(rating.value, {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{rating.source}</p>
          <p className="text-xs text-muted-foreground">
            {t("ratingVotes", { count: rating.count })}
          </p>
        </>
      ) : (
        <EmptyState>{t("ratingUnavailable")}</EmptyState>
      )}
    </li>
  );
}

function DurationCard({
  duration,
  label,
}: {
  duration: Duration | null;
  label: string;
}) {
  const t = useTranslations("Game");

  return (
    <li className="rounded-xl bg-ink-850 p-4">
      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
      {duration ? (
        <>
          <p className="mt-1 font-display text-2xl font-semibold">
            {formatDuration(duration.seconds, t)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("durationSubmissions", { count: duration.submissionCount })}
          </p>
        </>
      ) : (
        <EmptyState>{t("durationUnavailable")}</EmptyState>
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

export function GameDetailPage({ detail }: GameDetailPageProps) {
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

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 text-foreground sm:px-8 lg:px-12">
      <GameAnalytics stale={detail.meta.dataMayBeStale} />
      {detail.meta.dataMayBeStale && (
        <div className="mb-8">
          <StaleDataNotice meta={detail.meta} />
        </div>
      )}
      <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,18rem)_1fr] lg:gap-12">
        <GameCover cover={detail.cover} title={detail.title} />

        <div>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            {detail.title}
          </h1>
          <div className="mt-6 max-w-3xl">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              {t("summaryHeading")}
            </h2>
            {detail.summary ? (
              <>
                <p className="mt-2 text-base leading-7 text-muted-foreground">
                  {detail.summary}
                </p>
                {summaryLanguageDiffers && (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    {t("summaryLanguageEnglish")}
                  </p>
                )}
              </>
            ) : (
              <EmptyState>{t("noSummary")}</EmptyState>
            )}
          </div>
          <div className="mt-5">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("alternativeNamesHeading")}
            </h2>
            {detail.alternativeNames.length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.alternativeNames.join(" · ")}
              </p>
            ) : (
              <EmptyState>{t("noAlternativeNames")}</EmptyState>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <DetailSection title={t("releasesHeading")}>
          {detail.releases.length > 0 ? (
            <ul className="divide-y divide-border">
              {detail.releases.map((release, index) => (
                <li
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  key={`${release.platform.id}-${index}`}
                >
                  <span className="font-medium">{release.platform.label}</span>
                  {release.releaseDate ? (
                    <time
                      className="text-sm text-muted-foreground"
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
                    <EmptyState>{t("releaseDateUnavailable")}</EmptyState>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>{t("noReleases")}</EmptyState>
          )}
        </DetailSection>

        <DetailSection title={t("catalogDetailsHeading")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <DetailTags
              empty={t("noGenres")}
              items={detail.genres.map((genre) => genre.label)}
              title={t("genresHeading")}
            />
            <DetailTags
              empty={t("noThemes")}
              items={detail.themes.map((theme) => theme.name)}
              title={t("themesHeading")}
            />
            <DetailTags
              empty={t("noPlatforms")}
              items={detail.platforms.map((platform) => platform.label)}
              title={t("platformsHeading")}
            />
            <DetailTags
              empty={t("noGameModes")}
              items={detail.gameModes.map((mode) => mode.label)}
              title={t("gameModesHeading")}
            />
          </div>
        </DetailSection>

        <DetailSection title={t("multiplayerHeading")}>
          {multiplayerFeatures.length > 0 ? (
            <>
              <TagList items={multiplayerFeatures} />
              <p className="mt-4 text-sm text-muted-foreground">
                {detail.multiplayer.maxPlayers == null
                  ? t("maxPlayersUnavailable")
                  : t("maxPlayers", {
                      count: detail.multiplayer.maxPlayers,
                    })}
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <EmptyState>{t("noMultiplayer")}</EmptyState>
              <EmptyState>{t("maxPlayersUnavailable")}</EmptyState>
            </div>
          )}
        </DetailSection>

        <DetailSection title={t("ratingsHeading")}>
          <ul className="grid gap-3 sm:grid-cols-3">
            <RatingCard
              label={t("userRatingHeading")}
              rating={detail.userRating}
            />
            <RatingCard
              label={t("criticRatingHeading")}
              rating={detail.criticRating}
            />
            <RatingCard
              label={t("combinedRatingHeading")}
              rating={detail.combinedRating}
            />
          </ul>
        </DetailSection>

        <DetailSection title={t("durationsHeading")}>
          <ul className="grid gap-3 sm:grid-cols-3">
            <DurationCard duration={detail.durations.fast} label={t("fast")} />
            <DurationCard
              duration={detail.durations.normal}
              label={t("normal")}
            />
            <DurationCard
              duration={detail.durations.completionist}
              label={t("completionist")}
            />
          </ul>
        </DetailSection>

        <DetailSection title={t("ageRatingsHeading")}>
          {detail.ageRatings.length > 0 ? (
            <TagList
              items={detail.ageRatings.map(
                (rating) => `${rating.organization} · ${rating.rating}`,
              )}
            />
          ) : (
            <EmptyState>{t("noAgeRatings")}</EmptyState>
          )}
        </DetailSection>
      </div>

      <div className="mt-5 grid gap-5">
        <DetailSection title={t("screenshotsHeading")}>
          <ScreenshotGallery
            screenshots={detail.screenshots}
            title={detail.title}
          />
        </DetailSection>

        <DetailSection title={t("externalLinksHeading")}>
          {detail.externalLinks.length > 0 ? (
            <ul className="flex flex-wrap gap-3">
              {detail.externalLinks.map((link) => (
                <li key={link.url}>
                  <a
                    aria-label={t("externalLinkLabel", { label: link.label })}
                    data-analytics-link={link.label}
                    className="inline-flex rounded-full border border-primary/40 px-4 py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    href={link.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {link.label}
                    <span aria-hidden="true" className="ml-1 text-xs">
                      ↗ {t("externalLinkMarker")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>{t("noExternalLinks")}</EmptyState>
          )}
        </DetailSection>
      </div>
    </main>
  );
}

function DetailTags({
  empty,
  items,
  title,
}: {
  empty: string;
  items: string[];
  title: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
        {title}
      </h3>
      {items.length > 0 ? (
        <TagList items={items} />
      ) : (
        <EmptyState>{empty}</EmptyState>
      )}
    </div>
  );
}

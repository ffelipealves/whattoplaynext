import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";

import { Badge } from "@/components/ui/badge";

import type { GameDetail } from "./get-game-detail";

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
      className="rounded-2xl border border-[#17203a]/10 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2
        className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.02em]"
        id={headingId}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[#17203a]/55">{children}</p>;
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
    <li className="rounded-xl bg-[#f4f7ff] p-4">
      <h3 className="text-sm font-semibold text-[#17203a]/65">{label}</h3>
      {rating ? (
        <>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
            {format.number(rating.value, {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            })}
          </p>
          <p className="mt-1 text-xs text-[#17203a]/60">{rating.source}</p>
          <p className="text-xs text-[#17203a]/60">
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
    <li className="rounded-xl bg-[#f4f7ff] p-4">
      <h3 className="text-sm font-semibold text-[#17203a]/65">{label}</h3>
      {duration ? (
        <>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
            {formatDuration(duration.seconds, t)}
          </p>
          <p className="mt-1 text-xs text-[#17203a]/60">
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
    <main className="mx-auto max-w-7xl px-5 py-10 text-[#17203a] sm:px-8 lg:px-12">
      <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,18rem)_1fr] lg:gap-12">
        <div className="relative aspect-[264/374] overflow-hidden rounded-2xl bg-[#dce6fb] shadow-sm">
          {detail.cover ? (
            <Image
              alt={t("coverAlt", { title: detail.title })}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 640px) 18rem, calc(100vw - 2.5rem)"
              src={detail.cover.url}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-[#17203a]/45">
              {t("noCover")}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            {detail.title}
          </h1>
          <div className="mt-6 max-w-3xl">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#3157d5]">
              {t("summaryHeading")}
            </h2>
            {detail.summary ? (
              <>
                <p className="mt-2 text-base leading-7 text-[#17203a]/75">
                  {detail.summary}
                </p>
                {summaryLanguageDiffers && (
                  <p className="mt-2 text-xs font-medium text-[#17203a]/55">
                    {t("summaryLanguageEnglish")}
                  </p>
                )}
              </>
            ) : (
              <EmptyState>{t("noSummary")}</EmptyState>
            )}
          </div>
          <div className="mt-5">
            <h2 className="text-sm font-semibold text-[#17203a]/65">
              {t("alternativeNamesHeading")}
            </h2>
            {detail.alternativeNames.length > 0 ? (
              <p className="mt-1 text-sm text-[#17203a]/70">
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
            <ul className="divide-y divide-[#17203a]/10">
              {detail.releases.map((release, index) => (
                <li
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  key={`${release.platform.id}-${index}`}
                >
                  <span className="font-medium">{release.platform.label}</span>
                  {release.releaseDate ? (
                    <time
                      className="text-sm text-[#17203a]/65"
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
              <p className="mt-4 text-sm text-[#17203a]/65">
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
          {detail.screenshots.length > 0 ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {detail.screenshots.map((screenshot, index) => (
                <li
                  className="overflow-hidden rounded-xl bg-[#dce6fb]"
                  key={screenshot.url}
                >
                  <Image
                    alt={t("screenshotAlt", {
                      number: index + 1,
                      title: detail.title,
                    })}
                    className="h-auto w-full"
                    height={screenshot.height}
                    sizes="(min-width: 768px) 50vw, 100vw"
                    src={screenshot.url}
                    width={screenshot.width}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>{t("noScreenshots")}</EmptyState>
          )}
        </DetailSection>

        <DetailSection title={t("externalLinksHeading")}>
          {detail.externalLinks.length > 0 ? (
            <ul className="flex flex-wrap gap-3">
              {detail.externalLinks.map((link) => (
                <li key={link.url}>
                  <a
                    aria-label={t("externalLinkLabel", { label: link.label })}
                    className="inline-flex rounded-full border border-[#3157d5]/25 px-4 py-2 text-sm font-semibold text-[#3157d5] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3157d5]"
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
      <h3 className="mb-2 text-sm font-semibold text-[#17203a]/65">{title}</h3>
      {items.length > 0 ? (
        <TagList items={items} />
      ) : (
        <EmptyState>{empty}</EmptyState>
      )}
    </div>
  );
}

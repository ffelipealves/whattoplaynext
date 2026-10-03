import {
  getGameDetail,
  type GameDetail,
} from "@/features/game/get-game-detail";

import { FeaturedCarousel, type FeaturedGame } from "./featured-carousel";

function toFeatured(detail: GameDetail): FeaturedGame {
  const normal = detail.durations.normal;
  return {
    id: detail.id,
    slug: detail.slug,
    title: detail.title,
    summary: detail.summary,
    rating: detail.combinedRating?.value ?? null,
    genres: detail.genres.slice(0, 3).map((genre) => genre.label),
    normalHours: normal ? Math.round(normal.seconds / 3600) : null,
    backdrop: detail.screenshots[0] ?? null,
    cover: detail.cover,
  };
}

/**
 * The details behind the home page's featured games. The search's own
 * results name the games; their details add the screenshot and summary a
 * result lacks. A game whose detail fails is left out, and the section with
 * it when none load: the results below never depend on it.
 */
export async function FeaturedGames({ ids }: { ids: number[] }) {
  const results = await Promise.all(ids.map((id) => getGameDetail(id)));
  const games = results.flatMap((result) =>
    result.ok ? [toFeatured(result.detail)] : [],
  );

  if (games.length === 0) {
    return null;
  }

  return <FeaturedCarousel games={games} />;
}

/** Holds the carousel's place while its details load, so nothing jumps. */
export function FeaturedSkeleton() {
  return (
    <div
      aria-hidden
      className="min-h-[23.75rem] animate-pulse rounded-3xl border border-border bg-card lg:min-h-[26.25rem]"
    />
  );
}

import Image from "next/image";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

import type { GamePage } from "./get-search-results";

type GameSummary = GamePage["items"][number];

type ResultCardProps = {
  game: GameSummary;
};

function toHours(seconds: number): number {
  return Math.round(seconds / 3600);
}

export function ResultCard({ game }: ResultCardProps) {
  const t = useTranslations("Search");

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#17203a]/15 bg-white shadow-sm">
      <div className="relative aspect-[264/374] w-full bg-[#dce6fb]">
        {game.cover ? (
          <Image
            alt={t("coverAlt", { title: game.title })}
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
            src={game.cover.url}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs font-semibold text-[#17203a]/45">
            {t("noCover")}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-[family-name:var(--font-display)] text-base font-semibold tracking-[-0.01em]">
          {game.title}
        </h3>

        <p className="text-xs font-medium text-[#17203a]/55">
          {game.releaseYear ?? "—"}
        </p>

        {game.platforms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {game.platforms.map((platform) => (
              <Badge key={platform.id} variant="secondary">
                {platform.label}
              </Badge>
            ))}
          </div>
        )}

        {game.genres.length > 0 && (
          <p className="text-xs text-[#17203a]/65">
            {game.genres.map((genre) => genre.label).join(" · ")}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs font-semibold text-[#17203a]/70">
          <span>
            {game.rating
              ? `${Math.round(game.rating.value)} · ${t("ratingVotes", { count: game.rating.count })}`
              : t("ratingUnknown")}
          </span>
          <span>
            {game.normalDurationSeconds != null
              ? t("durationHours", {
                  hours: toHours(game.normalDurationSeconds),
                })
              : t("durationUnknown")}
          </span>
        </div>

        {game.gameModes.length > 0 && (
          <p className="text-xs text-[#17203a]/55">
            {game.gameModes.map((mode) => mode.label).join(" · ")}
          </p>
        )}
      </div>
    </article>
  );
}

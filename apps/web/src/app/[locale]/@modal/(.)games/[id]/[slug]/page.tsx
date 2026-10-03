import { getTranslations } from "next-intl/server";

import { GameDetailContent } from "@/features/game/game-detail-page";
import { GameModal } from "@/features/game/game-modal";
import { GameModalFailure } from "@/features/game/game-modal-failure";
import { getGameDetail } from "@/features/game/get-game-detail";
import { parseGameId } from "@/features/game/load-game-detail";

type InterceptedGamePageProps = {
  params: Promise<{ id: string; locale: "en" | "pt-br"; slug: string }>;
};

/**
 * A game opened by a client navigation from inside the site — a result card,
 * the featured carousel — shown over the page it was opened from. A reload or
 * a direct visit renders `games/[id]/[slug]` instead, with its canonical
 * redirect, metadata, and error boundaries.
 *
 * Failures are shown inside the modal rather than thrown, so the page behind
 * it never gives way to an error screen.
 */
export default async function InterceptedGamePage({
  params,
}: InterceptedGamePageProps) {
  const { id, locale } = await params;
  const gameId = parseGameId(id);
  const result =
    gameId === null
      ? ({ ok: false, failure: { code: "GAME_NOT_FOUND" } } as const)
      : await getGameDetail(gameId);

  if (!result.ok) {
    const t = await getTranslations({ locale, namespace: "Game" });
    return (
      <GameModal gameId={gameId ?? 0} title={t("notFoundTitle")}>
        <GameModalFailure failure={result.failure} />
      </GameModal>
    );
  }

  return (
    <GameModal gameId={result.detail.id} title={result.detail.title}>
      <GameDetailContent detail={result.detail} framed={false} />
    </GameModal>
  );
}

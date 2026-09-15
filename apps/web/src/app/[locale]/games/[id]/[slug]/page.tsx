import { permanentRedirect } from "next/navigation";

import { GameDetailPage } from "@/features/game/game-detail-page";
import {
  canonicalGamePath,
  loadGameDetail,
} from "@/features/game/load-game-detail";

export const dynamic = "force-dynamic";

type GamePageProps = {
  params: Promise<{ id: string; locale: string; slug: string }>;
};

export default async function GamePage({ params }: GamePageProps) {
  const { id, locale, slug } = await params;
  const detail = await loadGameDetail(id);

  if (slug !== detail.slug) {
    permanentRedirect(canonicalGamePath(locale, detail));
  }

  return <GameDetailPage detail={detail} />;
}

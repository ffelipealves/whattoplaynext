import { permanentRedirect } from "next/navigation";

import {
  canonicalGamePath,
  loadGameDetail,
} from "@/features/game/load-game-detail";

export const dynamic = "force-dynamic";

type GameRedirectPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export default async function GameRedirectPage({
  params,
}: GameRedirectPageProps) {
  const { id, locale } = await params;
  const detail = await loadGameDetail(id);

  permanentRedirect(canonicalGamePath(locale, detail));
}

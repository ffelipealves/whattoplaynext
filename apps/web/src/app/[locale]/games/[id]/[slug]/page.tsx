import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { permanentRedirect } from "next/navigation";

import { GameDetailPage } from "@/features/game/game-detail-page";
import {
  canonicalGamePath,
  loadGameDetail,
} from "@/features/game/load-game-detail";
import { buildGameMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type GamePageProps = {
  params: Promise<{
    id: string;
    locale: "en" | "pt-br";
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: GamePageProps): Promise<Metadata> {
  const { id, locale } = await params;
  const [detail, t] = await Promise.all([
    loadGameDetail(id),
    getTranslations({ locale, namespace: "Metadata" }),
  ]);

  return buildGameMetadata({
    coverAlt: t("gameCoverAlt", { title: detail.title }),
    description: t("gameDescription", { title: detail.title }),
    detail,
    locale,
    title: t("gameTitle", { title: detail.title }),
  });
}

export default async function GamePage({ params }: GamePageProps) {
  const { id, locale, slug } = await params;
  const detail = await loadGameDetail(id);

  if (slug !== detail.slug) {
    permanentRedirect(canonicalGamePath(locale, detail));
  }

  return <GameDetailPage detail={detail} />;
}

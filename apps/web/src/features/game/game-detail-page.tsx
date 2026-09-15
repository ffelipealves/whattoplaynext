import Image from "next/image";
import { useTranslations } from "next-intl";

import type { GameDetail } from "./get-game-detail";

type GameDetailPageProps = {
  detail: GameDetail;
};

export function GameDetailPage({ detail }: GameDetailPageProps) {
  const t = useTranslations("Game");

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-5 py-10 sm:grid-cols-[minmax(0,18rem)_1fr] sm:px-8 lg:px-12">
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

      <div className="self-center">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-[-0.03em] text-[#17203a] sm:text-5xl">
          {detail.title}
        </h1>
      </div>
    </main>
  );
}

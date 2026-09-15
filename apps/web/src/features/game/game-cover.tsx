import Image from "next/image";
import { useTranslations } from "next-intl";

import { GameImagePlaceholder } from "./game-image-placeholder";
import type { GameDetail } from "./get-game-detail";

const COVER_WIDTH = 264;
const COVER_HEIGHT = 374;

type GameCoverProps = {
  cover: GameDetail["cover"];
  title: string;
};

export function GameCover({ cover, title }: GameCoverProps) {
  const t = useTranslations("Game");
  const width = cover?.width ?? COVER_WIDTH;
  const height = cover?.height ?? COVER_HEIGHT;

  return (
    <div
      className="overflow-hidden rounded-2xl bg-[#dce6fb] shadow-sm"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {cover ? (
        <Image
          alt={t("coverAlt", { title })}
          className="h-full w-full object-cover"
          height={cover.height}
          preload
          sizes="(min-width: 640px) 18rem, calc(100vw - 2.5rem)"
          src={cover.url}
          width={cover.width}
        />
      ) : (
        <GameImagePlaceholder
          height={COVER_HEIGHT}
          label={t("coverPlaceholderLabel", { title })}
          message={t("noCover")}
          width={COVER_WIDTH}
        />
      )}
    </div>
  );
}

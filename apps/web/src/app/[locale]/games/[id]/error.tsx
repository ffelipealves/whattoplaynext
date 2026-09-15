"use client";

import { GameDetailFailure } from "@/features/game/game-detail-failure";

type GameErrorProps = {
  reset: () => void;
};

export default function GameError({ reset }: GameErrorProps) {
  return (
    <>
      <meta content="noindex" name="robots" />
      <GameDetailFailure retry={reset} />
    </>
  );
}

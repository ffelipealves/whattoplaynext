"use client";

import { GameDetailFailure } from "@/features/game/game-detail-failure";
import { failureFromGameDetailError } from "@/features/game/game-detail-error";

type GameErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function GameError({ error, retry }: GameErrorProps) {
  return (
    <GameDetailFailure
      failure={failureFromGameDetailError(error)}
      retry={retry}
    />
  );
}

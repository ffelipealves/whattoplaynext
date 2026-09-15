import { expect, test } from "vitest";

import {
  failureFromGameDetailError,
  gameDetailError,
} from "./game-detail-error";

test.each([
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "UPSTREAM_UNAVAILABLE",
] as const)(
  "carries the classified %s failure through the boundary",
  (code) => {
    const error = gameDetailError({ code });

    expect(error.message).not.toContain(code);
    expect(failureFromGameDetailError(error)).toEqual({ code });
  },
);

test("does not trust an arbitrary error digest", () => {
  expect(
    failureFromGameDetailError(
      Object.assign(new Error("private server detail"), {
        digest: "WTPN_GAME_DETAIL:NOT_A_REAL_CODE",
      }),
    ),
  ).toEqual({ code: "UNKNOWN" });
});

test("carries safe public retry and correlation details", () => {
  const failure = {
    code: "RATE_LIMITED" as const,
    retryAfterSeconds: 30,
    requestId: "detail/request 429",
  };

  expect(failureFromGameDetailError(gameDetailError(failure))).toEqual(failure);
});

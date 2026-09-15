import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import axe, { type Result } from "axe-core";
import { expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import {
  completeGameDetail,
  sparseGameDetail,
} from "../../../test/fixtures/game-detail";

import { GameDetailFailure } from "./game-detail-failure";
import { GameDetailPage } from "./game-detail-page";

async function criticalViolations(container: HTMLElement): Promise<Result[]> {
  const run = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  return run.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
}

function describeViolations(violations: Result[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => node.html)
          .join(" | ")}`,
    )
    .join("\n");
}

function withMessages(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

test("the complete game detail has no critical or serious axe violations", async () => {
  const { container } = render(
    withMessages(<GameDetailPage detail={completeGameDetail} />),
  );

  expect(describeViolations(await criticalViolations(container))).toBe("");
});

test("the sparse game detail has no critical or serious axe violations", async () => {
  const { container } = render(
    withMessages(<GameDetailPage detail={sparseGameDetail} />),
  );

  expect(describeViolations(await criticalViolations(container))).toBe("");
});

test("the recoverable game-detail failure has no critical or serious axe violations", async () => {
  const { container } = render(
    withMessages(
      <GameDetailFailure
        failure={{ code: "UPSTREAM_UNAVAILABLE" }}
        retry={vi.fn()}
      />,
    ),
  );

  expect(describeViolations(await criticalViolations(container))).toBe("");
});

test("the open screenshot viewer has no critical or serious axe violations", async () => {
  render(withMessages(<GameDetailPage detail={completeGameDetail} />));
  fireEvent.click(
    screen.getByRole("button", {
      name: "Open screenshot 1 of The Witcher 3: Wild Hunt",
    }),
  );
  await screen.findByRole("dialog", {
    name: "Screenshot 1 of The Witcher 3: Wild Hunt",
  });

  expect(describeViolations(await criticalViolations(document.body))).toBe("");
});

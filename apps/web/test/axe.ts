import axe, { type Result } from "axe-core";

/**
 * A full axe run over a rendered page takes a few hundred milliseconds on an
 * idle machine and several seconds on a loaded one, past Vitest's 5-second
 * default. Tests that call `criticalViolations` pass this as their timeout.
 */
export const AXE_TEST_TIMEOUT_MS = 30_000;

// axe refuses to start while another run is in progress. A run abandoned by a
// timed-out test keeps going, so each run waits for the previous one instead
// of failing the next test with "Axe is already running".
let previousRun: Promise<unknown> = Promise.resolve();

/**
 * jsdom has no layout or paint, so colour contrast cannot be evaluated here;
 * it is checked in a real browser instead. Everything else axe knows about
 * runs against the markup the page actually ships.
 */
export async function criticalViolations(
  container: HTMLElement,
): Promise<Result[]> {
  const run = previousRun.then(() =>
    axe.run(container, { rules: { "color-contrast": { enabled: false } } }),
  );
  previousRun = run.catch(() => undefined);
  const { violations } = await run;
  return violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
}

export function describeViolations(violations: Result[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => node.html)
          .join(" | ")}`,
    )
    .join("\n");
}

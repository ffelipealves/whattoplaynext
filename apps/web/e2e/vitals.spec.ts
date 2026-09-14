import { expect, test, type Page } from "@playwright/test";

/**
 * Core Web Vitals spot measurements for the search page — lab numbers from one
 * machine, recorded against NFR-003's targets. They are not the 75th-percentile
 * field data that requirement is written in; formal performance testing is a
 * later milestone's concern. Run with `pnpm e2e:vitals`.
 */

const TARGETS = { lcpMs: 2_500, inpMs: 200, cls: 0.1 };
const DESKTOP_MIN_WIDTH = 1024;

type Vitals = { lcpMs: number; cls: number };

/** Starts collecting before any paint, so nothing is missed. */
async function observeVitals(page: Page) {
  await page.addInitScript(() => {
    const store = { lcp: 0, cls: 0, inp: 0 };
    (window as unknown as { __vitals: typeof store }).__vitals = store;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        store.lcp = entry.startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        // Shifts right after user input are expected and excluded by CLS.
        if (!entry.hadRecentInput) {
          store.cls += entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        interactionId?: number;
        duration: number;
      })[]) {
        if (entry.interactionId) {
          store.inp = Math.max(store.inp, entry.duration);
        }
      }
    }).observe({
      type: "event",
      buffered: true,
      durationThreshold: 16,
    } as PerformanceObserverInit);
  });
}

async function readVitals(
  page: Page,
): Promise<{ lcpMs: number; cls: number; inpMs: number }> {
  return page.evaluate(() => {
    const store = (
      window as unknown as {
        __vitals: { lcp: number; cls: number; inp: number };
      }
    ).__vitals;
    return {
      lcpMs: Math.round(store.lcp),
      cls: Number(store.cls.toFixed(3)),
      inpMs: Math.round(store.inp),
    };
  });
}

test("the search page meets its Core Web Vitals targets @vitals", async ({
  page,
}, testInfo) => {
  await observeVitals(page);
  const isDesktop = (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH;

  if (!isDesktop) {
    // A mid-range phone rather than this machine's full CPU.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }

  await page.goto("/en/games", { waitUntil: "load" });
  await expect(
    page.getByRole("status").filter({ hasText: /games$/ }),
  ).not.toHaveText("");

  // LCP is only final once the visitor interacts, which is also what INP needs:
  // one real interaction that updates React state without navigating.
  if (isDesktop) {
    await page
      .getByRole("complementary", { name: "Filters" })
      .getByRole("checkbox")
      .first()
      .click();
  } else {
    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  // Event timing entries are delivered on the next frame.
  await page.waitForTimeout(500);

  const vitals = await readVitals(page);
  const record: Vitals & { inpMs: number; layout: string } = {
    ...vitals,
    layout: isDesktop ? "desktop" : "mobile (4x CPU throttle)",
  };
  testInfo.annotations.push({
    type: "vitals",
    description: JSON.stringify(record),
  });
  console.log(`vitals ${testInfo.project.name}: ${JSON.stringify(record)}`);

  expect.soft(record.lcpMs, "LCP").toBeLessThanOrEqual(TARGETS.lcpMs);
  expect.soft(record.inpMs, "INP").toBeLessThanOrEqual(TARGETS.inpMs);
  expect.soft(record.cls, "CLS").toBeLessThanOrEqual(TARGETS.cls);
});

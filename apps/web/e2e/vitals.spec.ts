import { expect, test, type Page } from "@playwright/test";

/**
 * Core Web Vitals spot measurements for the search page — lab numbers from one
 * machine, recorded against NFR-003's targets. They are not the 75th-percentile
 * field data that requirement is written in; formal performance testing is a
 * later milestone's concern. Run with `pnpm e2e:vitals`.
 */

const TARGETS = { lcpMs: 2_500, inpMs: 200, cls: 0.1 };
const DESKTOP_MIN_WIDTH = 1024;

type Store = {
  lcp: number;
  cls: number;
  interactions: Record<number, { start: number; duration: number }>;
};

/** Starts collecting before any paint, so nothing is missed. */
async function observeVitals(page: Page) {
  await page.addInitScript(() => {
    const store: Store = { lcp: 0, cls: 0, interactions: {} };
    (window as unknown as { __vitals: Store }).__vitals = store;

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
        if (!entry.interactionId) {
          continue;
        }
        // One interaction dispatches several events; its latency is the
        // slowest of them.
        const known = store.interactions[entry.interactionId];
        store.interactions[entry.interactionId] = {
          start: Math.min(known?.start ?? entry.startTime, entry.startTime),
          duration: Math.max(known?.duration ?? 0, entry.duration),
        };
      }
    }).observe({
      type: "event",
      buffered: true,
      durationThreshold: 16,
    } as PerformanceObserverInit);
  });
}

async function readVitals(page: Page) {
  return page.evaluate(() => {
    const store = (window as unknown as { __vitals: Store }).__vitals;
    const durations = Object.values(store.interactions)
      .sort((a, b) => a.start - b.start)
      .map((interaction) => Math.round(interaction.duration));
    return {
      lcpMs: Math.round(store.lcp),
      cls: Number(store.cls.toFixed(3)),
      inpMs: Math.max(0, ...durations),
      interactionsMs: durations,
    };
  });
}

/** Event timing entries arrive on the frame after the interaction. */
async function settle(page: Page) {
  await page.waitForTimeout(400);
}

async function serveControlledImages(page: Page) {
  const transparentPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X2NDWQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.route("**/_next/image?**", async (route) => {
    // Keep enough latency for the reserved boxes to be observed before the
    // image paints, without making the metric depend on IGDB's CDN.
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ body: transparentPng, contentType: "image/png" });
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

  // Two interactions of the same kind. The route sits in a Suspense boundary
  // React hydrates on the first real input, so the first interaction also
  // pays for hydration and the second shows the interaction on its own.
  if (isDesktop) {
    const checkboxes = page
      .getByRole("complementary", { name: "Filters" })
      .getByRole("checkbox");
    await checkboxes.nth(0).click();
    await settle(page);
    await checkboxes.nth(1).click();
    await settle(page);
  } else {
    const trigger = page.getByRole("button", { name: /^Filters/ });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await settle(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await settle(page);
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await settle(page);
  }

  const record = {
    ...(await readVitals(page)),
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

test("the game page keeps zero CLS while cover and screenshots load @vitals", async ({
  page,
}, testInfo) => {
  await observeVitals(page);
  await serveControlledImages(page);

  await page.goto("/en/games/1942/the-witcher-3-wild-hunt", {
    waitUntil: "load",
  });
  await expect(
    page.getByRole("heading", { name: "The Witcher 3: Wild Hunt" }),
  ).toBeVisible();

  const screenshots = page.getByRole("region", { name: "Screenshots" });
  await screenshots.scrollIntoViewIfNeeded();
  await expect(
    screenshots.getByRole("img", {
      name: "Screenshot 1 of The Witcher 3: Wild Hunt",
    }),
  ).toBeVisible();
  await settle(page);

  const record = {
    ...(await readVitals(page)),
    layout:
      (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH
        ? "desktop"
        : "mobile",
  };
  testInfo.annotations.push({
    type: "vitals-game",
    description: JSON.stringify(record),
  });
  console.log(
    `game vitals ${testInfo.project.name}: ${JSON.stringify(record)}`,
  );

  expect(record.cls, "CLS").toBe(0);
});

import { defineConfig, devices, type Project } from "@playwright/test";

/**
 * Ports of their own, so a run never collides with a development server or a
 * locally running API — and never reaches a real provider either.
 */
const API_PORT = 8100;
const WEB_PORT = 3100;
const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_BASE_URL = `http://127.0.0.1:${WEB_PORT}`;

/**
 * Set to measure an application someone else is serving — a build pointed at
 * the live API, say. The suite then starts no servers of its own.
 */
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL;

/** Measurements record numbers rather than guard behavior, so they only run
 * when a project asks for them by name. */
const VITALS = /@vitals/;

/**
 * Every configuration is a named project, chosen with `--project` in the
 * package scripts so nothing depends on shell-specific environment syntax:
 *
 * - `chromium` is the one the quality gate drives on every push;
 * - the desktop and mobile projects are the on-demand browser matrix — every
 *   engine Playwright ships, at both layouts — which would cost more on every
 *   push than the regressions six scenarios could plausibly catch;
 * - the vitals projects take Core Web Vitals spot measurements.
 */
const projects: Project[] = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
    grepInvert: VITALS,
  },
  {
    name: "desktop-firefox",
    use: { ...devices["Desktop Firefox"] },
    grepInvert: VITALS,
  },
  {
    name: "desktop-webkit",
    use: { ...devices["Desktop Safari"] },
    grepInvert: VITALS,
  },
  {
    name: "mobile-chromium",
    use: { ...devices["Pixel 7"] },
    grepInvert: VITALS,
  },
  {
    name: "mobile-webkit",
    use: { ...devices["iPhone 14"] },
    grepInvert: VITALS,
  },
  {
    name: "vitals-desktop",
    use: { ...devices["Desktop Chrome"] },
    grep: VITALS,
  },
  { name: "vitals-mobile", use: { ...devices["Pixel 7"] }, grep: VITALS },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["github"]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: EXTERNAL_BASE_URL ?? WEB_BASE_URL,
    trace: "retain-on-failure",
  },
  projects,
  webServer: EXTERNAL_BASE_URL
    ? undefined
    : [
        {
          // The real application, composed with a catalog that needs no
          // provider and no credentials — the same seam the pytest suite fakes.
          command: `poetry -C ../api run python tests/e2e/fixture_server.py ${API_PORT}`,
          cwd: "../api",
          url: `${API_BASE_URL}/api/v1/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          // A production build: `next dev` refuses to run twice in one
          // directory, which would make a run fail whenever a development
          // server is up.
          command: `pnpm build && pnpm start --port ${WEB_PORT}`,
          url: WEB_BASE_URL,
          env: {
            NEXT_PUBLIC_API_BASE_URL: API_BASE_URL,
            WTPN_SITE_ORIGIN: WEB_BASE_URL,
          },
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});

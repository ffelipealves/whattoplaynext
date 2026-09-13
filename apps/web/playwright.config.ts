import { defineConfig, devices } from "@playwright/test";

/**
 * Ports of their own, so a run never collides with a development server or a
 * locally running API — and never reaches a real provider either.
 */
const API_PORT = 8100;
const WEB_PORT = 3100;
const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_BASE_URL = `http://127.0.0.1:${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // The real application, composed with a catalog that needs no provider
      // and no credentials — the same seam the pytest suite fakes.
      command: `poetry -C ../api run python tests/e2e/fixture_server.py ${API_PORT}`,
      cwd: "../api",
      url: `${API_BASE_URL}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // A production build: `next dev` refuses to run twice in one directory,
      // which would make a run fail whenever a development server is up.
      command: `pnpm build && pnpm start --port ${WEB_PORT}`,
      url: WEB_BASE_URL,
      env: { NEXT_PUBLIC_API_BASE_URL: API_BASE_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});

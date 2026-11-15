import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build with a throwaway local result store, so
 * the shared leaderboard is never polluted by test submissions.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:3300",
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "pnpm --filter web exec next start --port 3300",
    url: "http://127.0.0.1:3300",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      ORIVOXX_DATA_DIR: "/tmp/orivoxx-e2e-results",
      ORIVOXX_ENV: "test",
    },
  },
});

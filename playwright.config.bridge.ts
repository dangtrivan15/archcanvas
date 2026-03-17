/**
 * Playwright config for E2E mock bridge tests.
 *
 * Runs with MOCK_BRIDGE=1 so the Vite preview server uses a mock BridgeSession
 * instead of the real Claude SDK. Only runs bridge-specific test files.
 */

import { defineConfig, devices } from "@playwright/test";

process.env.SLOT_GUARD_POOL = "playwright";

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "ai-bridge.spec.ts",
  globalSetup: ["./test/setup/playwrightSlotGuard.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "line",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "MOCK_BRIDGE=1 npm run build && MOCK_BRIDGE=1 npx vite preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});

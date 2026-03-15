import { defineConfig, devices } from "@playwright/test";

process.env.SLOT_GUARD_POOL = "playwright";

export default defineConfig({
  testDir: "./test/e2e",
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
    command: "npm run build && npx vite preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});

import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for visual regression tests.
 *
 * Deterministic settings: single worker, fixed viewport, disabled animations,
 * and a 1% pixel threshold to absorb sub-pixel rendering differences across
 * CI vs local environments.
 *
 * Usage:
 *   npm run test:visual          — run tests, compare against baselines
 *   npm run test:visual-update   — regenerate baseline snapshots
 */

process.env.SLOT_GUARD_POOL = "playwright-visual";

export default defineConfig({
  testDir: "./test/visual",
  globalSetup: ["./test/setup/playwrightSlotGuard.ts"],

  /* Deterministic: no parallelism, no retries */
  fullyParallel: false,
  workers: 1,
  retries: 0,

  forbidOnly: !!process.env.CI,
  reporter: "line",

  expect: {
    toHaveScreenshot: {
      /* Allow 1% pixel difference to absorb sub-pixel rendering variance */
      maxDiffPixelRatio: 0.01,
      /* Use CSS animations: "disabled" to freeze transitions */
      animations: "disabled",
    },
  },

  use: {
    baseURL: "http://localhost:4173",
    /* Fixed viewport for consistent screenshots */
    viewport: { width: 1280, height: 720 },
    trace: "off",
    screenshot: "off",
    /* Disable CSS animations/transitions for determinism */
    ...devices["Desktop Chrome"],
  },

  projects: [
    {
      name: "visual-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run build && npx vite preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});

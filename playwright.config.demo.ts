/**
 * Playwright config for demo video recording.
 *
 * Records the "Onboard with AI" flow against the running dev server.
 * The dev server's serverGuard() prevents spawning a second instance,
 * so this config reuses the existing `npm run dev` on port 5173.
 *
 * Prerequisites:
 *   1. `npm run dev` running (provides Vite + AI bridge)
 *   2. Claude Code connected (provides the AI session)
 *
 * Usage:
 *   npm run demo:record
 *
 * Output:
 *   demo-videos/ directory with .webm recordings
 *
 * Environment variables:
 *   DEMO_PROJECT_PATH  — path for AI to analyze (default: cwd)
 *   DEMO_TIMEOUT       — max wait for AI in ms (default: 300000 = 5 min)
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "demo-onboard.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: Number(process.env.DEMO_TIMEOUT) || 300_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "off",
    screenshot: "off",
    video: {
      mode: "on",
      size: { width: 1920, height: 1080 },
    },
    viewport: { width: 1920, height: 1080 },
    // Slow down interactions so they're visible in the recording
    launchOptions: {
      slowMo: 150,
    },
  },
  projects: [
    {
      name: "demo",
      use: {
        ...devices["Desktop Chrome"],
        // Override device defaults — use our viewport/video size
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
      },
    },
  ],
  outputDir: "demo-videos",
  // No webServer — reuses the running `npm run dev` (port 5173).
  // The Vite serverGuard() prevents spawning a second dev server,
  // so the user must start it manually before recording.
});

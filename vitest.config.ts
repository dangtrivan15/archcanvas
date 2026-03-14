import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    globalSetup: ["./test/setup/slotGuard.ts"],
    env: {
      SLOT_GUARD_POOL: "vitest",
      // Mirror real architecture: bridge port = app port.
      // 4173 matches the Playwright test server (vite preview), which has
      // no bridge plugin — so detectBridge() reliably returns null.
      ARCHCANVAS_BRIDGE_PORT: "4173",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./test/setup.ts"],
          include: ["test/**/*.test.{ts,tsx}"],
          exclude: ["test/cli/**"],
        },
      },
      {
        test: {
          name: "cli",
          environment: "node",
          include: ["test/cli/**/*.test.{ts,tsx}"],
          globalSetup: ["./test/setup/cliBuild.ts"],
        },
      },
    ],
  },
});

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
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globalSetup: ["./test/setup/slotGuard.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    env: { SLOT_GUARD_POOL: "vitest" },
  },
});

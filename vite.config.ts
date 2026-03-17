import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { aiBridgePlugin } from "./src/core/ai/vitePlugin";
import { themeFlashPlugin } from "./src/core/theme/viteFlashPlugin";
import path from "path";
import fs from "fs";
const host = process.env.TAURI_DEV_HOST;

/**
 * Prevents duplicate dev server instances.
 * Writes a PID file on startup, checks for existing instances,
 * and cleans up on exit. Works regardless of how Vite is started
 * (npm run dev, npx vite, Tauri beforeDevCommand, etc.).
 */
function serverGuard(): Plugin {
  const lockDir = path.join(__dirname, "tmp");
  fs.mkdirSync(lockDir, { recursive: true });
  const pidFile = path.join(lockDir, "archcanvas-dev-server.pid");

  function isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  function cleanup() {
    try {
      const content = fs.readFileSync(pidFile, "utf-8").trim();
      if (parseInt(content, 10) === process.pid) {
        fs.unlinkSync(pidFile);
      }
    } catch {
      // Already gone
    }
  }

  return {
    name: "archcanvas-server-guard",
    configureServer(server) {
      // Check for existing instance
      try {
        const existing = parseInt(
          fs.readFileSync(pidFile, "utf-8").trim(),
          10,
        );
        if (!isNaN(existing) && existing !== process.pid && isAlive(existing)) {
          console.error(
            `\n  Dev server already running (PID ${existing}).` +
              `\n  Stop it first, or remove tmp/archcanvas-dev-server.pid if stale.\n`,
          );
          process.exit(1);
        }
      } catch {
        // No PID file or unreadable — proceed
      }

      // Claim this instance
      fs.writeFileSync(pidFile, process.pid.toString());

      // Clean up on exit
      server.httpServer?.on("close", cleanup);
      process.on("SIGINT", () => {
        cleanup();
        process.exit(0);
      });
      process.on("SIGTERM", () => {
        cleanup();
        process.exit(0);
      });
    },
  };
}

export default defineConfig({
  plugins: [serverGuard(), themeFlashPlugin(), aiBridgePlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      // AI bridge modules (claudeCodeBridge, vitePlugin) and their Node.js-only
      // dependencies are server-side only and must never enter the browser bundle.
      //
      // Tauri plugin packages (@tauri-apps/*) are NOT externalized — they are
      // browser-compatible JS that communicates with the Rust backend via
      // window.__TAURI_INTERNALS__ IPC. They must be bundled so the webview
      // can resolve them. They're code-split via dynamic imports and only
      // loaded when running inside Tauri.
      external: [
        "@anthropic-ai/claude-agent-sdk",
        "ws",
      ],
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    // strictPort: true is required — the AI bridge (CLI's detectBridge) and
    // WebSocket provider hardcode port 5173. If Vite falls back to another port,
    // bridge detection will silently fail. See docs/specs/2026-03-13-i6a-*.md.
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 5174 } : undefined,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/test/**",
        "**/docs/**",
        "**/bak/**",
        "**/tmp/**",
        "**/scripts/**",
        "**/playwright-report/**",
        "**/test-results/**",
        "**/.archcanvas",
        "**/.archcanvas/**"
      ],
    },
  },
});

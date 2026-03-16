/**
 * Vite plugin that hosts the AI bridge: WebSocket + HTTP endpoints on the dev server.
 * Delegates all logic to bridgeServer.ts.
 *
 * This is a Node.js-only module. It must NEVER be bundled into the browser build.
 * The `vite.config.ts` externalises it via `build.rollupOptions.external`.
 *
 * WebSocket endpoint: ws://localhost:5173/__archcanvas_ai
 * HTTP endpoints:
 *   GET  /__archcanvas_ai/health
 *   POST /__archcanvas_ai/api/add-node
 *   POST /__archcanvas_ai/api/add-edge
 *   POST /__archcanvas_ai/api/remove-node
 *   POST /__archcanvas_ai/api/remove-edge
 *   POST /__archcanvas_ai/api/import
 *   POST /__archcanvas_ai/api/list
 *   POST /__archcanvas_ai/api/describe
 *   POST /__archcanvas_ai/api/search
 *   POST /__archcanvas_ai/api/catalog
 */

import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { createBridgeServer, type BridgeServerOptions } from './bridgeServer';

// Re-export types needed by consumers (vitePlugin.test.ts imports StoreActionResult)
export type { StoreActionMessage, StoreActionResult, BridgeServerOptions } from './bridgeServer';

// ---------------------------------------------------------------------------
// Plugin options
// ---------------------------------------------------------------------------

export interface AiBridgePluginOptions {
  /** Injectable SDK query function for bridge sessions. */
  queryFn?: BridgeServerOptions['queryFn'];
  /** Timeout (ms) for request relay to the browser. Defaults to 10 000. */
  requestTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Plugin implementation
// ---------------------------------------------------------------------------

export function aiBridgePlugin(pluginOptions?: AiBridgePluginOptions): Plugin {
  return {
    name: 'archcanvas-ai-bridge',

    configureServer(server) {
      const bridge = createBridgeServer({
        cwd: process.cwd(),
        queryFn: pluginOptions?.queryFn,
        requestTimeoutMs: pluginOptions?.requestTimeoutMs,
      });

      // Attach bridge request handler as Vite middleware
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!bridge.handleRequest(req, res)) {
          next();
        }
      });

      // Attach WebSocket upgrade
      const httpServer = server.httpServer;
      if (!httpServer) return;

      httpServer.on('upgrade', (request: IncomingMessage, socket, head: Buffer) => {
        const url = new URL(request.url ?? '', `http://${request.headers.host}`);
        if (url.pathname !== '/__archcanvas_ai') return; // Let Vite HMR handle other upgrades

        bridge.wss.handleUpgrade(request, socket, head, (ws) => {
          bridge.handleConnection(ws);
        });
      });

      // Clean up on server close
      httpServer.on('close', () => {
        bridge.stop();
      });
    },

    configurePreviewServer(server) {
      const bridge = createBridgeServer({
        cwd: process.cwd(),
        queryFn: pluginOptions?.queryFn,
        requestTimeoutMs: pluginOptions?.requestTimeoutMs,
      });

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!bridge.handleRequest(req, res)) {
          next();
        }
      });

      // Preview server also has httpServer for WebSocket upgrade
      const httpServer = server.httpServer;
      if (!httpServer) return;

      httpServer.on('upgrade', (request: IncomingMessage, socket, head: Buffer) => {
        const url = new URL(request.url ?? '', `http://${request.headers.host}`);
        if (url.pathname !== '/__archcanvas_ai') return;

        bridge.wss.handleUpgrade(request, socket, head, (ws) => {
          bridge.handleConnection(ws);
        });
      });

      httpServer.on('close', () => {
        bridge.stop();
      });
    },
  };
}

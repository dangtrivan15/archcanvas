/**
 * Vite Bridge Plugin
 *
 * Integrates the Claude Code bridge server (PTY + WebSocket) directly into
 * the Vite dev server. When `npm run dev` starts, the bridge WebSocket
 * endpoint is automatically available at ws://<host>:<port>/bridge.
 *
 * This eliminates the need for a separate `npm run bridge` process.
 *
 * Architecture:
 *   Browser <--WebSocket (ws://<host>:<port>/bridge)--> Vite Plugin <--stdin/stdout--> Claude Code CLI
 */

import type { Plugin, ViteDevServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  detectClaudeCode,
  handleConnection,
  type ClaudeDetectionResult,
} from './server';

/** Path for the bridge WebSocket endpoint on the Vite dev server */
export const BRIDGE_WS_PATH = '/bridge';

export interface ViteBridgePluginOptions {
  /** Path to the .archc file for the MCP server (optional) */
  archcFile?: string;
  /** Enable/disable the bridge plugin (default: true) */
  enabled?: boolean;
}

/**
 * Vite plugin that sets up the Claude Code bridge WebSocket on the dev server.
 *
 * Uses the Vite `configureServer` hook to attach a WebSocketServer to the
 * existing Vite HTTP server, handling upgrades on the `/bridge` path.
 */
export function viteBridgePlugin(options: ViteBridgePluginOptions = {}): Plugin {
  const { archcFile, enabled = true } = options;

  let wss: WebSocketServer | null = null;
  let claudeDetection: ClaudeDetectionResult | null = null;

  return {
    name: 'archcanvas-bridge',
    // Only applies during dev
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      if (!enabled) return;

      // Detect Claude Code installation at startup
      claudeDetection = detectClaudeCode();
      if (claudeDetection.found) {
        console.log(`[Bridge] Claude Code detected: v${claudeDetection.version} at ${claudeDetection.path}`);
      } else {
        console.warn(`[Bridge] WARNING: ${claudeDetection.error}`);
      }

      // Create WebSocket server in noServer mode (we handle upgrades ourselves)
      wss = new WebSocketServer({ noServer: true });

      wss.on('connection', (ws: WebSocket) => {
        console.log(`[Bridge] New WebSocket connection (active: ${wss!.clients.size})`);
        handleConnection(ws, archcFile, claudeDetection ?? undefined);
      });

      wss.on('error', (err: Error) => {
        console.error(`[Bridge] WebSocket server error: ${err.message}`);
      });

      // Handle HTTP upgrade requests for the /bridge path
      server.httpServer?.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

        if (url.pathname === BRIDGE_WS_PATH) {
          wss!.handleUpgrade(request, socket, head, (ws) => {
            wss!.emit('connection', ws, request);
          });
        }
        // Let other upgrade requests (like Vite HMR) pass through
      });

      // Add health endpoint as middleware
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        if (url.pathname === '/bridge/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            archcFile: archcFile ?? null,
            uptime: process.uptime(),
            claude: {
              found: claudeDetection?.found ?? false,
              version: claudeDetection?.version ?? null,
              path: claudeDetection?.path ?? null,
              error: claudeDetection?.error ?? null,
            },
          }));
          return;
        }
        next();
      });

      // Log bridge availability after server starts
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address();
        if (addr && typeof addr === 'object') {
          const host = addr.address === '::' || addr.address === '0.0.0.0' ? 'localhost' : addr.address;
          const protocol = server.config.server.https ? 'wss' : 'ws';
          console.log(`[Bridge] WebSocket endpoint: ${protocol}://${host}:${addr.port}${BRIDGE_WS_PATH}`);
          console.log(`[Bridge] Health check: https://${host}:${addr.port}/bridge/health`);
          if (!claudeDetection?.found) {
            console.warn(`[Bridge] WebSocket connections will receive an error until Claude Code is installed.`);
          }
        }
      });
    },
  };
}

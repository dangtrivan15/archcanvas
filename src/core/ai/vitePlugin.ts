/**
 * Vite plugin that hosts the AI bridge: WebSocket + HTTP endpoints on the dev server.
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
 */

import type { Plugin } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, ServerResponse } from 'http';
import type { ClientMessage, ChatEvent } from './types';
import { createBridgeSession, type BridgeSession, type SDKQueryFn, type OnPermissionRequest } from './claudeCodeBridge';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_PATH = '/__archcanvas_ai';
const API_PREFIX = '/__archcanvas_ai/api/';
const HEALTH_PATH = '/__archcanvas_ai/health';
const MUTATION_TIMEOUT_MS = 10_000;

/** Maps HTTP route segments to store action names sent to the browser. */
const ROUTE_TO_ACTION: Record<string, string> = {
  'add-node': 'addNode',
  'add-edge': 'addEdge',
  'remove-node': 'removeNode',
  'remove-edge': 'removeEdge',
  'import': 'import',
};

// ---------------------------------------------------------------------------
// Store-action message types (server ↔ browser via WebSocket)
// ---------------------------------------------------------------------------

export interface StoreActionMessage {
  type: 'store_action';
  action: string;
  args: Record<string, unknown>;
  correlationId: string;
}

export interface StoreActionResult {
  type: 'store_action_result';
  correlationId: string;
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// Plugin options (for testing)
// ---------------------------------------------------------------------------

export interface AiBridgePluginOptions {
  /** Injectable SDK query function for bridge sessions. */
  queryFn?: SDKQueryFn;
}

// ---------------------------------------------------------------------------
// Plugin implementation
// ---------------------------------------------------------------------------

export function aiBridgePlugin(pluginOptions?: AiBridgePluginOptions): Plugin {
  let wss: WebSocketServer | null = null;

  /** Active browser WebSocket connections. */
  const browserClients = new Set<WebSocket>();

  /** Pending HTTP mutation requests waiting for browser response. */
  const pendingMutations = new Map<
    string,
    {
      resolve: (result: StoreActionResult) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  /** Bridge sessions keyed by WebSocket client. */
  const sessions = new Map<WebSocket, BridgeSession>();

  return {
    name: 'archcanvas-ai-bridge',

    configureServer(server) {
      // --- HTTP middleware ---
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? '';

        // Health check
        if (req.method === 'GET' && url === HEALTH_PATH) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        // Mutation endpoints
        if (req.method === 'POST' && url.startsWith(API_PREFIX)) {
          const route = url.slice(API_PREFIX.length);
          const action = ROUTE_TO_ACTION[route];

          if (!action) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: `Unknown route: ${route}` } }));
            return;
          }

          // Read request body
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', () => {
            let args: Record<string, unknown>;
            try {
              args = body ? JSON.parse(body) : {};
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }));
              return;
            }

            // Find a connected browser client to relay to
            const client = findActiveBrowserClient();
            if (!client) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: { code: 'BRIDGE_DISCONNECTED', message: 'No browser client connected' } }));
              return;
            }

            const correlationId = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            // Send store_action to browser
            const storeAction: StoreActionMessage = {
              type: 'store_action',
              action,
              args,
              correlationId,
            };

            try {
              client.send(JSON.stringify(storeAction));
            } catch {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: { code: 'BRIDGE_DISCONNECTED', message: 'Failed to send to browser' } }));
              return;
            }

            // Wait for browser response with timeout
            const timer = setTimeout(() => {
              pendingMutations.delete(correlationId);
              res.writeHead(504, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: { code: 'BRIDGE_TIMEOUT', message: 'Browser did not respond in time' } }));
            }, MUTATION_TIMEOUT_MS);

            pendingMutations.set(correlationId, {
              resolve: (result) => {
                clearTimeout(timer);
                pendingMutations.delete(correlationId);
                let status: number;
                if (result.ok) {
                  status = 200;
                } else if (result.error?.code === 'BRIDGE_DISCONNECTED') {
                  status = 502;
                } else if (result.error?.code === 'BRIDGE_TIMEOUT') {
                  status = 504;
                } else {
                  status = 500;
                }
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }));
              },
              timer,
            });
          });
          return;
        }

        next();
      });

      // --- WebSocket server ---
      const httpServer = server.httpServer;
      if (!httpServer) return;

      wss = new WebSocketServer({ noServer: true });

      httpServer.on('upgrade', (request: IncomingMessage, socket, head: Buffer) => {
        const url = new URL(request.url ?? '', `http://${request.headers.host}`);
        if (url.pathname !== WS_PATH) return; // Let Vite HMR handle other upgrades

        wss!.handleUpgrade(request, socket, head, (ws) => {
          wss!.emit('connection', ws, request);
        });
      });

      wss.on('connection', (ws: WebSocket) => {
        browserClients.add(ws);

        // Create a bridge session for this client.
        // Wire onPermissionRequest to forward permission events via WebSocket.
        const onPermissionRequest: OnPermissionRequest = (event) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(event));
          }
        };
        const session = createBridgeSession({
          cwd: process.cwd(),
          onPermissionRequest,
          ...(pluginOptions?.queryFn ? { queryFn: pluginOptions.queryFn } : {}),
        });
        sessions.set(ws, session);

        ws.on('message', async (data: Buffer | string) => {
          let msg: ClientMessage | StoreActionResult;
          try {
            msg = JSON.parse(typeof data === 'string' ? data : data.toString());
          } catch {
            return; // Ignore malformed messages
          }

          // Handle store_action_result from browser (response to mutation relay)
          if ('type' in msg && (msg as StoreActionResult).type === 'store_action_result') {
            const result = msg as StoreActionResult;
            const pending = pendingMutations.get(result.correlationId);
            if (pending) {
              pending.resolve(result);
            }
            return;
          }

          // Handle client messages for AI chat
          const clientMsg = msg as ClientMessage;
          const bridgeSession = sessions.get(ws);
          if (!bridgeSession) return;

          switch (clientMsg.type) {
            case 'chat': {
              try {
                const stream = bridgeSession.sendMessage(clientMsg.content, clientMsg.context);
                for await (const event of stream) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(event));
                  }
                }
              } catch (err) {
                if (ws.readyState === WebSocket.OPEN) {
                  const errorEvent: ChatEvent = {
                    type: 'error',
                    requestId: clientMsg.requestId,
                    message: err instanceof Error ? err.message : String(err),
                    code: 'BRIDGE_ERROR',
                  };
                  ws.send(JSON.stringify(errorEvent));
                }
              }
              break;
            }

            case 'abort': {
              bridgeSession.abort();
              break;
            }

            case 'load_history': {
              bridgeSession.loadHistory(clientMsg.messages);
              break;
            }

            case 'permission_response': {
              bridgeSession.respondToPermission(clientMsg.id, clientMsg.allowed);
              break;
            }
          }
        });

        ws.on('close', () => {
          browserClients.delete(ws);
          const bridgeSession = sessions.get(ws);
          if (bridgeSession) {
            bridgeSession.destroy();
            sessions.delete(ws);
          }

          // Reject any pending mutations that were waiting on this client
          for (const [id, pending] of pendingMutations) {
            clearTimeout(pending.timer);
            pending.resolve({
              type: 'store_action_result',
              correlationId: id,
              ok: false,
              error: { code: 'BRIDGE_DISCONNECTED', message: 'Browser connection lost' },
            });
          }
        });
      });
    },
  };

  function findActiveBrowserClient(): WebSocket | null {
    for (const client of browserClients) {
      if (client.readyState === WebSocket.OPEN) {
        return client;
      }
    }
    return null;
  }
}

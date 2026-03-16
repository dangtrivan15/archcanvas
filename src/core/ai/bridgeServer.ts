/**
 * Standalone bridge server — HTTP + WebSocket endpoints for AI integration.
 *
 * Extracted from vitePlugin.ts so the same logic can be:
 * 1. Embedded in Vite dev/preview servers (via handleRequest / handleConnection)
 * 2. Run as a standalone Node.js process (via start/stop)
 *
 * This is a Node.js-only module. It must NEVER be bundled into the browser build.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  ClientMessage,
  ChatEvent,
  SetPermissionModeClientMessage,
  SetEffortClientMessage,
  PermissionResponseClientMessage,
  QuestionResponseClientMessage,
} from './types';
import {
  createBridgeSession,
  type BridgeSession,
  type SDKQueryFn,
  type OnPermissionRequest,
  type OnAskUserQuestion,
} from './claudeCodeBridge';
import { createArchCanvasMcpServer, MCP_TOOL_NAMES } from './mcpTools';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_PATH = '/__archcanvas_ai';
const API_PREFIX = '/__archcanvas_ai/api/';
const HEALTH_PATH = '/__archcanvas_ai/health';
const REQUEST_TIMEOUT_MS = 10_000;

/** Maps HTTP route segments to store action names sent to the browser. */
const ROUTE_TO_ACTION: Record<string, string> = {
  // writes
  'add-node': 'addNode',
  'add-edge': 'addEdge',
  'remove-node': 'removeNode',
  'remove-edge': 'removeEdge',
  'import': 'import',
  // reads
  'list': 'list',
  'describe': 'describe',
  'search': 'search',
  'catalog': 'catalog',
};

// ---------------------------------------------------------------------------
// Store-action message types (server <-> browser via WebSocket)
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
// Options
// ---------------------------------------------------------------------------

export interface BridgeServerOptions {
  /** Port to listen on. Use 0 for OS-assigned free port. Defaults to 17248. */
  port?: number;
  /** Working directory for bridge sessions. Defaults to process.cwd(). */
  cwd?: string;
  /** Host to bind to. Defaults to '127.0.0.1'. */
  host?: string;
  /** Injectable SDK query function for bridge sessions. */
  queryFn?: SDKQueryFn;
  /** Timeout (ms) for request relay to the browser. Defaults to 10 000. */
  requestTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// createBridgeServer
// ---------------------------------------------------------------------------

export function createBridgeServer(options: BridgeServerOptions = {}) {
  const { port = 17248, cwd = process.cwd(), host = '127.0.0.1' } = options;

  const httpServer = createServer();
  const wss = new WebSocketServer({ noServer: true });

  /** Active browser WebSocket connections. */
  const browserClients = new Set<WebSocket>();

  /** Pending HTTP requests waiting for browser response. */
  const pendingRequests = new Map<
    string,
    {
      resolve: (result: StoreActionResult) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  /** Bridge sessions keyed by WebSocket client. */
  const sessions = new Map<WebSocket, BridgeSession>();

  // --- Guard against SDK unhandled rejections ---
  // The Claude Agent SDK has a bug where handleControlRequest doesn't
  // catch transport.write() errors after the session is aborted.  This
  // causes an unhandled rejection ("Operation aborted") that crashes the
  // server.  We catch it here so the server stays up.
  const rejectionHandler = (reason: unknown) => {
    if (reason instanceof Error && reason.message === 'Operation aborted') {
      return;
    }
    console.error('[archcanvas-ai-bridge] Unhandled rejection:', reason);
  };

  function findActiveBrowserClient(): WebSocket | null {
    for (const client of browserClients) {
      if (client.readyState === WebSocket.OPEN) return client;
    }
    return null;
  }

  // --- HTTP request handler ---
  // Returns true if the request was handled, false to pass to next middleware.
  function handleRequest(req: IncomingMessage, res: ServerResponse): boolean {
    const pathname = new URL(req.url ?? '', 'http://localhost').pathname;

    // Health check
    if (req.method === 'GET' && pathname === HEALTH_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return true;
    }

    // API routes
    if (req.method === 'POST' && pathname.startsWith(API_PREFIX)) {
      const route = pathname.slice(API_PREFIX.length);
      const action = ROUTE_TO_ACTION[route];

      if (!action) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: `Unknown route: ${route}` } }));
        return true;
      }

      // Read request body, relay via relayStoreAction, write HTTP response
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        let args: Record<string, unknown>;
        try {
          args = body ? JSON.parse(body) : {};
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }));
          return;
        }

        const result = await relayStoreAction(action, args);

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
      });
      return true;
    }

    return false; // Not handled
  }

  // --- WebSocket connection handler ---
  function handleConnection(ws: WebSocket) {
    browserClients.add(ws);

    // Track the current client requestId so that side-channel events
    // (permission_request, ask_user_question) can be remapped to the
    // client's ULID.
    let currentClientRequestId: string | undefined;

    const onPermissionRequest: OnPermissionRequest = (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        const remapped = currentClientRequestId
          ? { ...event, requestId: currentClientRequestId }
          : event;
        ws.send(JSON.stringify(remapped));
      }
    };

    const onAskUserQuestion: OnAskUserQuestion = (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        const remapped = currentClientRequestId
          ? { ...event, requestId: currentClientRequestId }
          : event;
        ws.send(JSON.stringify(remapped));
      }
    };

    const session = createBridgeSession({
      cwd,
      onPermissionRequest,
      onAskUserQuestion,
      ...(options.queryFn ? { queryFn: options.queryFn } : {}),
      mcpServers: { archcanvas: mcpServer },
      allowedTools: MCP_TOOL_NAMES,
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
        const pending = pendingRequests.get(result.correlationId);
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
          currentClientRequestId = clientMsg.requestId;
          try {
            const stream = bridgeSession.sendMessage(clientMsg.content, clientMsg.context);
            for await (const event of stream) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ ...event, requestId: clientMsg.requestId }));
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

        case 'interrupt': {
          bridgeSession.interrupt();
          break;
        }

        case 'load_history': {
          bridgeSession.loadHistory(clientMsg.messages);
          break;
        }

        case 'permission_response': {
          const permMsg = clientMsg as PermissionResponseClientMessage;
          bridgeSession.respondToPermission(permMsg.id, permMsg.allowed, {
            updatedPermissions: permMsg.updatedPermissions,
            interrupt: permMsg.interrupt,
          });
          break;
        }

        case 'set_permission_mode': {
          bridgeSession.setPermissionMode(
            (clientMsg as SetPermissionModeClientMessage).mode,
          );
          break;
        }

        case 'set_effort': {
          bridgeSession.setEffort(
            (clientMsg as SetEffortClientMessage).effort,
          );
          break;
        }

        case 'question_response': {
          const qMsg = clientMsg as QuestionResponseClientMessage;
          bridgeSession.respondToQuestion(qMsg.id, qMsg.answers);
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
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timer);
        pending.resolve({
          type: 'store_action_result',
          correlationId: id,
          ok: false,
          error: { code: 'BRIDGE_DISCONNECTED', message: 'Browser connection lost' },
        });
      }
    });
  }

  // --- Wire up standalone server ---
  httpServer.on('request', (req, res) => {
    if (!handleRequest(req, res)) {
      res.writeHead(404);
      res.end();
    }
  });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    if (url.pathname === WS_PATH) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', handleConnection);

  // --- Relay a store action to the browser (reusable by HTTP + MCP) ---
  async function relayStoreAction(
    action: string,
    args: Record<string, unknown>,
  ): Promise<StoreActionResult> {
    const client = findActiveBrowserClient();
    if (!client) {
      return {
        type: 'store_action_result',
        correlationId: '',
        ok: false,
        error: { code: 'BRIDGE_DISCONNECTED', message: 'No browser client connected' },
      };
    }

    const correlationId = `relay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storeAction: StoreActionMessage = { type: 'store_action', action, args, correlationId };

    try {
      client.send(JSON.stringify(storeAction));
    } catch {
      return {
        type: 'store_action_result',
        correlationId,
        ok: false,
        error: { code: 'BRIDGE_DISCONNECTED', message: 'Failed to send to browser' },
      };
    }

    const timeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
    return new Promise<StoreActionResult>((resolve) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(correlationId);
        resolve({
          type: 'store_action_result',
          correlationId,
          ok: false,
          error: { code: 'BRIDGE_TIMEOUT', message: 'Browser did not respond in time' },
        });
      }, timeoutMs);

      pendingRequests.set(correlationId, {
        resolve: (result) => {
          clearTimeout(timer);
          pendingRequests.delete(correlationId);
          resolve(result);
        },
        timer,
      });
    });
  }

  // --- Create in-process MCP server with tools bound to relayStoreAction ---
  const mcpServer = createArchCanvasMcpServer(relayStoreAction);

  return {
    /** Start the standalone HTTP + WebSocket server. */
    async start() {
      process.on('unhandledRejection', rejectionHandler);
      return new Promise<{ port: number }>((resolve) => {
        httpServer.listen(port, host, () => {
          const addr = httpServer.address();
          const actualPort = typeof addr === 'object' && addr ? addr.port : port;
          resolve({ port: actualPort });
        });
      });
    },

    /** Stop the server and clean up all connections. */
    async stop() {
      process.off('unhandledRejection', rejectionHandler);
      return new Promise<void>((resolve) => {
        // Close all WebSocket connections
        for (const client of browserClients) {
          client.close();
        }
        wss.close();
        httpServer.close(() => resolve());
      });
    },

    /** HTTP request handler for embedding in Vite middleware. Returns true if handled. */
    handleRequest,

    /** WebSocket connection handler for embedding in Vite. */
    handleConnection,

    /** WebSocket server instance for Vite upgrade handling. */
    get wss() { return wss; },

    /** Relay a store action to the browser and return the result. Reusable by HTTP and MCP handlers. */
    relayStoreAction,
  };
}

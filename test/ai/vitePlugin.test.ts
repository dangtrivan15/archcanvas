import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { tmpdir } from 'os';
import { WebSocket } from 'ws';
import { aiBridgePlugin, type StoreActionResult } from '@/core/ai/vitePlugin';
import type { SDKQueryFn, SDKMessage } from '@/core/ai/claudeCodeBridge';
import type { Plugin, ViteDevServer } from 'vite';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MiddlewareFn = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;

/**
 * Creates a minimal mock of a Vite dev server:
 * - HTTP server that routes requests through registered middleware
 * - `middlewares.use()` matching Vite's Connect-style middleware API
 * - Emits 'upgrade' events for WebSocket handling
 */
function createMockViteServer() {
  const handlers: MiddlewareFn[] = [];

  const httpServer = http.createServer((req, res) => {
    // Run request through middleware stack
    let idx = 0;
    const next = () => {
      if (idx < handlers.length) {
        handlers[idx++](req, res, next);
      } else {
        // No middleware handled it
        res.writeHead(404);
        res.end('Not found');
      }
    };
    next();
  });

  return {
    httpServer,
    middlewares: {
      use(fn: MiddlewareFn) {
        handlers.push(fn);
      },
    },
  };
}

/** Create a mock SDKQueryFn that returns simple text + done. */
function createMockSDKQueryFn(): SDKQueryFn {
  return () => {
    return (async function* () {
      yield {
        type: 'system',
        subtype: 'init',
        session_id: 'test-session',
        uuid: 'sys-uuid',
        tools: [],
        model: 'test',
        cwd: '/tmp',
        mcp_servers: [],
        permissionMode: 'default',
        slash_commands: [],
        output_style: 'text',
        skills: [],
        plugins: [],
        apiKeySource: 'env',
        claude_code_version: '1.0',
        agents: [],
        betas: [],
      } satisfies SDKMessage;
      yield {
        type: 'assistant',
        uuid: 'ast-uuid',
        session_id: 'test-session',
        message: { content: [{ type: 'text', text: 'Hello from AI' }] },
        parent_tool_use_id: null,
      } satisfies SDKMessage;
      yield {
        type: 'result',
        subtype: 'success',
        uuid: 'res-uuid',
        session_id: 'test-session',
        duration_ms: 50,
        duration_api_ms: 40,
        is_error: false,
        num_turns: 1,
        result: 'done',
        stop_reason: 'end_turn',
        total_cost_usd: 0.001,
        usage: { input_tokens: 10, output_tokens: 5 },
        modelUsage: {},
        permission_denials: [],
      } satisfies SDKMessage;
    })();
  };
}

/** Wait for a condition to be true, with timeout. */
async function waitFor(fn: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise(r => setTimeout(r, 10));
  }
}

/** Simple HTTP request helper. */
function httpRequest(
  port: number,
  method: string,
  path: string,
  body?: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port, method, path, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Set up the plugin, start the server, return port. */
function setupServer(mockQueryFn?: SDKQueryFn) {
  const server = createMockViteServer();
  const plugin = aiBridgePlugin({ queryFn: mockQueryFn ?? createMockSDKQueryFn() });
  const configureFn = (plugin as Plugin & { configureServer: (s: unknown) => void }).configureServer;
  configureFn!.call(plugin, server as unknown as ViteDevServer);
  return server;
}

async function startServer(server: ReturnType<typeof createMockViteServer>): Promise<number> {
  await new Promise<void>((resolve) => {
    server.httpServer.listen(0, 'localhost', () => resolve());
  });
  return (server.httpServer.address() as import('net').AddressInfo).port;
}

async function stopServer(server: ReturnType<typeof createMockViteServer>): Promise<void> {
  await new Promise<void>((resolve) => {
    server.httpServer.close(() => resolve());
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aiBridgePlugin — HTTP endpoints', () => {
  let server: ReturnType<typeof createMockViteServer>;
  let port: number;

  beforeEach(async () => {
    server = setupServer();
    port = await startServer(server);
  });

  afterEach(async () => {
    await stopServer(server);
  });

  it('GET /health returns { ok: true }', async () => {
    const resp = await httpRequest(port, 'GET', '/__archcanvas_ai/health');
    expect(resp.status).toBe(200);
    expect(JSON.parse(resp.body)).toEqual({ ok: true });
  });

  it('POST to unknown API route returns 404', async () => {
    const resp = await httpRequest(port, 'POST', '/__archcanvas_ai/api/unknown-action', '{}');
    expect(resp.status).toBe(404);
    const body = JSON.parse(resp.body);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('POST mutation with no browser client returns 502 BRIDGE_DISCONNECTED', async () => {
    const resp = await httpRequest(port, 'POST', '/__archcanvas_ai/api/add-node', '{"id":"svc","type":"compute/service"}');
    expect(resp.status).toBe(502);
    const body = JSON.parse(resp.body);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('BRIDGE_DISCONNECTED');
  });

  it('POST mutation with invalid JSON returns 400', async () => {
    // Need a connected browser client for the request to get past the disconnected check
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    const resp = await httpRequest(port, 'POST', '/__archcanvas_ai/api/add-node', 'not-json{{{');
    expect(resp.status).toBe(400);
    const body = JSON.parse(resp.body);
    expect(body.error.code).toBe('INVALID_JSON');

    ws.close();
    await new Promise<void>(r => ws.on('close', r));
  });

  it('non-matching requests fall through to 404', async () => {
    const resp = await httpRequest(port, 'GET', '/some/other/path');
    expect(resp.status).toBe(404);
  });
});

describe('aiBridgePlugin — WebSocket lifecycle', () => {
  let server: ReturnType<typeof createMockViteServer>;
  let port: number;

  beforeEach(async () => {
    server = setupServer();
    port = await startServer(server);
  });

  afterEach(async () => {
    await stopServer(server);
  });

  it('accepts WebSocket connections on /__archcanvas_ai', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
    await new Promise<void>(r => ws.on('close', r));
  });

  it('streams ChatEvents back when receiving a chat message', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    const received: unknown[] = [];
    ws.on('message', (data) => {
      received.push(JSON.parse(data.toString()));
    });

    // Send a chat message
    ws.send(JSON.stringify({
      type: 'chat',
      requestId: 'req-1',
      content: 'Hello',
      context: {
        projectName: 'test',
        currentScope: '@root',
        projectPath: tmpdir(),
      },
    }));

    // Wait for done event
    await waitFor(() => received.some((e: unknown) => (e as { type: string }).type === 'done'), 5000);

    const textEvents = received.filter((e: unknown) => (e as { type: string }).type === 'text');
    expect(textEvents.length).toBeGreaterThan(0);
    expect((textEvents[0] as { content: string }).content).toBe('Hello from AI');

    const doneEvents = received.filter((e: unknown) => (e as { type: string }).type === 'done');
    expect(doneEvents).toHaveLength(1);

    ws.close();
    await new Promise<void>(r => ws.on('close', r));
  });

  it('handles interrupt message without crashing', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    ws.send(JSON.stringify({ type: 'interrupt' }));
    await new Promise(r => setTimeout(r, 50));
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
    await new Promise<void>(r => ws.on('close', r));
  });

  it('handles load_history message without crashing', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    ws.send(JSON.stringify({
      type: 'load_history',
      messages: [
        { role: 'user', content: 'hello', timestamp: Date.now() },
        { role: 'assistant', content: 'hi', timestamp: Date.now() },
      ],
    }));

    await new Promise(r => setTimeout(r, 50));
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
    await new Promise<void>(r => ws.on('close', r));
  });

  it('cleans up session on disconnect and allows reconnection', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws.on('open', resolve));
    ws.close();
    await new Promise<void>(r => ws.on('close', r));

    // Reconnect
    const ws2 = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws2.on('open', resolve));
    expect(ws2.readyState).toBe(WebSocket.OPEN);
    ws2.close();
    await new Promise<void>(r => ws2.on('close', r));
  });
});

describe('aiBridgePlugin — HTTP mutation relay', () => {
  let server: ReturnType<typeof createMockViteServer>;
  let port: number;

  beforeEach(async () => {
    server = setupServer();
    port = await startServer(server);
  });

  afterEach(async () => {
    await stopServer(server);
  });

  it('relays mutation to browser via WebSocket and returns result', async () => {
    const browser = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => browser.on('open', resolve));

    browser.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'store_action') {
        const result: StoreActionResult = {
          type: 'store_action_result',
          correlationId: msg.correlationId,
          ok: true,
          data: { nodeId: 'svc-a' },
        };
        browser.send(JSON.stringify(result));
      }
    });

    const resp = await httpRequest(
      port,
      'POST',
      '/__archcanvas_ai/api/add-node',
      JSON.stringify({ id: 'svc-a', type: 'compute/service' }),
    );

    expect(resp.status).toBe(200);
    const body = JSON.parse(resp.body);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ nodeId: 'svc-a' });

    browser.close();
    await new Promise<void>(r => browser.on('close', r));
  });

  it('returns 502 BRIDGE_DISCONNECTED when browser disconnects mid-request', async () => {
    const browser = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => browser.on('open', resolve));

    // Browser disconnects instead of responding
    browser.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'store_action') {
        browser.close();
      }
    });

    const resp = await httpRequest(
      port,
      'POST',
      '/__archcanvas_ai/api/add-node',
      JSON.stringify({ id: 'svc-a', type: 'compute/service' }),
    );

    expect(resp.status).toBe(502);
    const body = JSON.parse(resp.body);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('BRIDGE_DISCONNECTED');
  });

  it('relays add-edge mutation with correct action name', async () => {
    const browser = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => browser.on('open', resolve));

    let receivedAction: { action: string; args: Record<string, unknown> } | null = null;
    browser.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'store_action') {
        receivedAction = msg;
        browser.send(JSON.stringify({
          type: 'store_action_result',
          correlationId: msg.correlationId,
          ok: true,
          data: { edgeId: 'edge-1' },
        }));
      }
    });

    await httpRequest(port, 'POST', '/__archcanvas_ai/api/add-edge', JSON.stringify({ from: 'svc-a', to: 'db' }));

    expect(receivedAction).not.toBeNull();
    expect(receivedAction!.action).toBe('addEdge');
    expect(receivedAction!.args).toEqual({ from: 'svc-a', to: 'db' });

    browser.close();
    await new Promise<void>(r => browser.on('close', r));
  });

  it('relays remove-node mutation with correct action name', async () => {
    const browser = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => browser.on('open', resolve));

    let receivedAction: { action: string } | null = null;
    browser.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'store_action') {
        receivedAction = msg;
        browser.send(JSON.stringify({
          type: 'store_action_result',
          correlationId: msg.correlationId,
          ok: true,
        }));
      }
    });

    await httpRequest(port, 'POST', '/__archcanvas_ai/api/remove-node', JSON.stringify({ id: 'svc-a' }));
    expect(receivedAction!.action).toBe('removeNode');

    browser.close();
    await new Promise<void>(r => browser.on('close', r));
  });

  it('relays remove-edge mutation with correct action name', async () => {
    const browser = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => browser.on('open', resolve));

    let receivedAction: { action: string } | null = null;
    browser.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'store_action') {
        receivedAction = msg;
        browser.send(JSON.stringify({
          type: 'store_action_result',
          correlationId: msg.correlationId,
          ok: true,
        }));
      }
    });

    await httpRequest(port, 'POST', '/__archcanvas_ai/api/remove-edge', JSON.stringify({ from: 'a', to: 'b' }));
    expect(receivedAction!.action).toBe('removeEdge');

    browser.close();
    await new Promise<void>(r => browser.on('close', r));
  });

  it('relays import mutation with correct action name', async () => {
    const browser = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => browser.on('open', resolve));

    let receivedAction: { action: string } | null = null;
    browser.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'store_action') {
        receivedAction = msg;
        browser.send(JSON.stringify({
          type: 'store_action_result',
          correlationId: msg.correlationId,
          ok: true,
        }));
      }
    });

    await httpRequest(port, 'POST', '/__archcanvas_ai/api/import', JSON.stringify({ file: 'arch.yaml' }));
    expect(receivedAction!.action).toBe('import');

    browser.close();
    await new Promise<void>(r => browser.on('close', r));
  });

  it('returns 504 BRIDGE_TIMEOUT when browser does not respond in time', async () => {
    // Use a short timeout so the test doesn't have to wait 10 seconds.
    // We create a separate server with a tiny requestTimeoutMs.
    const shortTimeoutServer = createMockViteServer();
    const shortTimeoutPlugin = aiBridgePlugin({
      queryFn: createMockSDKQueryFn(),
      requestTimeoutMs: 100,
    });
    const configureFn = (shortTimeoutPlugin as Plugin & { configureServer: (s: unknown) => void }).configureServer;
    configureFn!.call(shortTimeoutPlugin, shortTimeoutServer as unknown as ViteDevServer);

    const shortPort = await startServer(shortTimeoutServer);

    try {
      const browser = new WebSocket(`ws://localhost:${shortPort}/__archcanvas_ai`);
      await new Promise<void>((resolve) => browser.on('open', resolve));

      // Browser receives the store_action but never sends store_action_result
      browser.on('message', () => {
        // Deliberately do nothing — simulate a non-responsive browser
      });

      const resp = await httpRequest(
        shortPort,
        'POST',
        '/__archcanvas_ai/api/add-node',
        JSON.stringify({ id: 'svc-timeout', type: 'compute/service' }),
      );

      expect(resp.status).toBe(504);
      const body = JSON.parse(resp.body);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('BRIDGE_TIMEOUT');

      browser.close();
      await new Promise<void>(r => browser.on('close', r));
    } finally {
      await stopServer(shortTimeoutServer);
    }
  });

  it('forwards browser error responses to HTTP client', async () => {
    const browser = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => browser.on('open', resolve));

    browser.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'store_action') {
        browser.send(JSON.stringify({
          type: 'store_action_result',
          correlationId: msg.correlationId,
          ok: false,
          error: { code: 'ENGINE_ERROR', message: 'Node not found' },
        }));
      }
    });

    const resp = await httpRequest(
      port,
      'POST',
      '/__archcanvas_ai/api/remove-node',
      JSON.stringify({ id: 'nonexistent' }),
    );

    expect(resp.status).toBe(500);
    const body = JSON.parse(resp.body);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('ENGINE_ERROR');
    expect(body.error.message).toBe('Node not found');

    browser.close();
    await new Promise<void>(r => browser.on('close', r));
  });
});

describe('aiBridgePlugin — permission relay', () => {
  let server: ReturnType<typeof createMockViteServer>;
  let port: number;

  beforeEach(async () => {
    server = setupServer();
    port = await startServer(server);
  });

  afterEach(async () => {
    await stopServer(server);
  });

  it('permission_response message does not crash the server', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws.on('open', resolve));

    // Send permission response for nonexistent permission — should not crash
    ws.send(JSON.stringify({
      type: 'permission_response',
      id: 'perm-nonexistent',
      allowed: true,
    }));

    await new Promise(r => setTimeout(r, 50));
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
    await new Promise<void>(r => ws.on('close', r));
  });
});

describe('aiBridgePlugin — new client messages', () => {
  let server: ReturnType<typeof createMockViteServer>;
  let port: number;

  beforeEach(async () => {
    server = setupServer();
    port = await startServer(server);
  });

  afterEach(async () => {
    await stopServer(server);
  });

  it('set_permission_mode message does not crash the server', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ type: 'set_permission_mode', mode: 'acceptEdits' }));
    await new Promise(r => setTimeout(r, 50));
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
    await new Promise<void>(r => ws.on('close', r));
  });

  it('set_effort message does not crash the server', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ type: 'set_effort', effort: 'low' }));
    await new Promise(r => setTimeout(r, 50));
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
    await new Promise<void>(r => ws.on('close', r));
  });

  it('permission_response with updatedPermissions and interrupt does not crash', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/__archcanvas_ai`);
    await new Promise<void>((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({
      type: 'permission_response',
      id: 'perm-1',
      allowed: true,
      updatedPermissions: [{ tool: 'Bash', permission: 'allow' }],
    }));
    await new Promise(r => setTimeout(r, 50));
    ws.send(JSON.stringify({
      type: 'permission_response',
      id: 'perm-2',
      allowed: false,
      interrupt: true,
    }));
    await new Promise(r => setTimeout(r, 50));
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
    await new Promise<void>(r => ws.on('close', r));
  });
});

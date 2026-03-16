import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { tmpdir } from 'os';
import { WebSocket } from 'ws';
import { aiBridgePlugin } from '@/core/ai/vitePlugin';
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

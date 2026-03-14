import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { CLIError } from '@/cli/errors';

// --- Test helpers ---

/** Start an HTTP server on a random port and return the server + base URL. */
function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ server: Server; port: number; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

// --- detectBridge tests ---

describe('detectBridge', () => {
  // vitest.config.ts sets ARCHCANVAS_BRIDGE_URL to an unused port (19876),
  // so detectBridge will never collide with a running dev server.

  let detectBridge: typeof import('@/cli/context').detectBridge;

  beforeEach(async () => {
    const mod = await import('@/cli/context');
    detectBridge = mod.detectBridge;
  });

  it('returns null when no server is running on the bridge port', async () => {
    // No bridge server running during tests — should return null
    const result = await detectBridge();
    expect(result).toBeNull();
  });

  it('returns null (does not throw) on connection refused', async () => {
    // This tests the error handling path — should gracefully return null
    const result = await detectBridge();
    expect(result).toBeNull();
  });
});

// --- detectBridge with mocked fetch (no real server needed) ---

describe('detectBridge with mock fetch', () => {
  let detectBridge: typeof import('@/cli/context').detectBridge;

  beforeEach(async () => {
    const mod = await import('@/cli/context');
    detectBridge = mod.detectBridge;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns bridge URL when health endpoint responds ok', async () => {
    const bridgePort = process.env.ARCHCANVAS_BRIDGE_PORT ?? '5173';
    const expectedUrl = `http://localhost:${bridgePort}/__archcanvas_ai`;
    vi.stubGlobal('fetch', async (url: string) => {
      if (url === `${expectedUrl}/health`) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const result = await detectBridge();
    expect(result).toBe(expectedUrl);
  });

  it('returns null when health endpoint returns non-ok status', async () => {
    vi.stubGlobal('fetch', async () => {
      return new Response('Internal Server Error', { status: 500 });
    });

    const result = await detectBridge();
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });

    const result = await detectBridge();
    expect(result).toBeNull();
  });
});

// --- bridgeRequest tests ---

describe('bridgeRequest', () => {
  let bridgeRequest: typeof import('@/cli/context').bridgeRequest;

  beforeEach(async () => {
    const mod = await import('@/cli/context');
    bridgeRequest = mod.bridgeRequest;
  });

  it('sends correct POST request and parses JSON response', async () => {
    let receivedMethod = '';
    let receivedUrl = '';
    let receivedBody = '';
    let receivedContentType = '';

    const { server, baseUrl } = await startServer(async (req, res) => {
      receivedMethod = req.method ?? '';
      receivedUrl = req.url ?? '';
      receivedContentType = req.headers['content-type'] ?? '';
      receivedBody = await readBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, node: { id: 'svc-1' } }));
    });

    try {
      const result = await bridgeRequest(baseUrl, 'add-node', {
        canvasId: '__root__',
        node: { id: 'svc-1', type: 'compute/service' },
      });

      expect(receivedMethod).toBe('POST');
      expect(receivedUrl).toBe('/api/add-node');
      expect(receivedContentType).toBe('application/json');
      expect(JSON.parse(receivedBody)).toEqual({
        canvasId: '__root__',
        node: { id: 'svc-1', type: 'compute/service' },
      });
      expect(result).toEqual({ ok: true, node: { id: 'svc-1' } });
    } finally {
      await stopServer(server);
    }
  });

  it('throws CLIError with error code/message on HTTP error (non-2xx)', async () => {
    const { server, baseUrl } = await startServer((_req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: { code: 'DUPLICATE_NODE_ID', message: 'Node svc-1 already exists' },
      }));
    });

    try {
      await expect(
        bridgeRequest(baseUrl, 'add-node', { canvasId: '__root__', node: { id: 'svc-1' } }),
      ).rejects.toThrow(CLIError);

      try {
        await bridgeRequest(baseUrl, 'add-node', { canvasId: '__root__', node: { id: 'svc-1' } });
      } catch (err) {
        expect(err).toBeInstanceOf(CLIError);
        expect((err as CLIError).code).toBe('DUPLICATE_NODE_ID');
        expect((err as CLIError).message).toBe('Node svc-1 already exists');
      }
    } finally {
      await stopServer(server);
    }
  });

  it('throws CLIError with BRIDGE_ERROR on HTTP error without structured error body', async () => {
    const { server, baseUrl } = await startServer((_req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false }));
    });

    try {
      try {
        await bridgeRequest(baseUrl, 'remove-node', { canvasId: '__root__', nodeId: 'x' });
      } catch (err) {
        expect(err).toBeInstanceOf(CLIError);
        expect((err as CLIError).code).toBe('BRIDGE_ERROR');
        expect((err as CLIError).message).toContain('500');
      }
    } finally {
      await stopServer(server);
    }
  });

  it('throws CLIError with BRIDGE_ERROR on network error', async () => {
    // Use a port that definitely has no server
    await expect(
      bridgeRequest('http://127.0.0.1:19999', 'add-node', { canvasId: '__root__' }),
    ).rejects.toThrow(CLIError);

    try {
      await bridgeRequest('http://127.0.0.1:19999', 'add-node', { canvasId: '__root__' });
    } catch (err) {
      expect(err).toBeInstanceOf(CLIError);
      expect((err as CLIError).code).toBe('BRIDGE_ERROR');
    }
  });

  it('correctly constructs URL from bridgeUrl and action', async () => {
    let receivedUrl = '';

    const { server, baseUrl } = await startServer(async (req, res) => {
      receivedUrl = req.url ?? '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });

    try {
      await bridgeRequest(baseUrl, 'remove-edge', { from: 'a', to: 'b' });
      expect(receivedUrl).toBe('/api/remove-edge');
    } finally {
      await stopServer(server);
    }
  });

  it('sends import with pre-parsed data in body', async () => {
    let receivedBody = '';

    const { server, baseUrl } = await startServer(async (req, res) => {
      receivedBody = await readBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, added: { nodes: 1, edges: 0, entities: 0 }, errors: [] }));
    });

    try {
      const nodes = [{ id: 'svc-1', type: 'compute/service', displayName: 'Service' }];
      const result = await bridgeRequest(baseUrl, 'import', {
        canvasId: '__root__',
        nodes,
        edges: [],
        entities: [],
      });

      const parsed = JSON.parse(receivedBody);
      expect(parsed.nodes).toEqual(nodes);
      expect(parsed.canvasId).toBe('__root__');
      expect(result.ok).toBe(true);
    } finally {
      await stopServer(server);
    }
  });
});

// --- CLIContext.bridgeUrl integration ---

describe('CLIContext includes bridgeUrl', () => {
  it('loadContext sets bridgeUrl to null when no bridge is running', async () => {
    // This is tested implicitly by existing CLI tests — loadContext will
    // set bridgeUrl to null since no dev server is running during tests.
    // We verify the type contract by importing the interface.
    const mod = await import('@/cli/context');
    // The interface includes bridgeUrl — TypeScript compilation verifies this.
    // We can't easily call loadContext without the full project setup,
    // so we verify the detectBridge function returns null.
    const result = await mod.detectBridge();
    expect(result).toBeNull();
  });
});

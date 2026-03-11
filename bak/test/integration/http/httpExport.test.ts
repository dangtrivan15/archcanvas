/**
 * HTTP Export Endpoint Integration Tests (Feature #313).
 *
 * Tests the export REST endpoints:
 *   - GET /api/export/markdown → text/markdown
 *   - GET /api/export/mermaid → text/plain
 *   - GET /api/export/markdown?withMermaid=true → summary + mermaid
 *   - Content-Type headers
 *   - Accept: application/json → { content: '...' } wrapper
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHttpServer, type HttpServerOptions } from '@/cli/server/httpServer';
import { GraphContext } from '@/cli/context';
import type { Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ─── Helpers ─────────────────────────────────────────────────

async function startServer(
  ctx: GraphContext,
  port = 0,
): Promise<{ server: Server; baseUrl: string }> {
  const options: HttpServerOptions = { port, host: '127.0.0.1', cors: false };
  const server = createHttpServer(ctx, options);

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
      } else {
        reject(new Error('Could not get server address'));
      }
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function httpGet(
  url: string,
  headers?: Record<string, string>,
): Promise<{ status: number; headers: Headers; text: string; json: () => unknown }> {
  const resp = await fetch(url, { headers });
  const text = await resp.text();
  return {
    status: resp.status,
    headers: resp.headers,
    text,
    json: () => JSON.parse(text),
  };
}

// ─── Tests ───────────────────────────────────────────────────

describe('HTTP Export Endpoints (Feature #313)', () => {
  let tmpDir: string;
  let archcFile: string;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-http-export-'));
    archcFile = path.join(tmpDir, 'test.archc');

    const ctx = GraphContext.createNew('Export Test Arch');
    await ctx.saveAs(archcFile);
    const reloaded = await GraphContext.loadFromFile(archcFile);

    // Add nodes and edges for meaningful export content
    const svc = reloaded.textApi.addNode({ type: 'compute/service', displayName: 'AuthService' });
    const db = reloaded.textApi.addNode({ type: 'data/database', displayName: 'UserDB' });
    reloaded.textApi.addEdge({
      fromNode: svc.id,
      toNode: db.id,
      type: 'sync',
      label: 'SQL queries',
    });
    await reloaded.save(true);

    const s = await startServer(reloaded);
    server = s.server;
    baseUrl = s.baseUrl;
  });

  afterEach(async () => {
    await closeServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── GET /api/export/markdown ──────────────────────────────

  it('GET /api/export/markdown returns markdown with text/markdown content type', async () => {
    const res = await httpGet(`${baseUrl}/api/export/markdown`);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type')!;
    expect(ct).toContain('text/markdown');
    expect(res.text).toContain('AuthService');
    expect(res.text).toContain('UserDB');
  });

  it('GET /api/export/markdown returns generateMarkdownSummary() output', async () => {
    const res = await httpGet(`${baseUrl}/api/export/markdown`);
    expect(res.status).toBe(200);
    // Should be pure markdown, no mermaid block by default
    // The exact content depends on the export API, but it should contain node names
    expect(res.text).toContain('AuthService');
  });

  // ── GET /api/export/mermaid ──────────────────────────────

  it('GET /api/export/mermaid returns mermaid diagram with text/plain content type', async () => {
    const res = await httpGet(`${baseUrl}/api/export/mermaid`);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type')!;
    expect(ct).toContain('text/plain');
    expect(res.text).toContain('graph');
  });

  it('GET /api/export/mermaid returns generateMermaid() output', async () => {
    const res = await httpGet(`${baseUrl}/api/export/mermaid`);
    expect(res.status).toBe(200);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(0);
  });

  // ── GET /api/export/markdown?withMermaid=true ──────────────

  it('GET /api/export/markdown?withMermaid=true returns generateSummaryWithMermaid()', async () => {
    const res = await httpGet(`${baseUrl}/api/export/markdown?withMermaid=true`);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type')!;
    expect(ct).toContain('text/markdown');
    // Should contain both markdown and mermaid content
    expect(res.text).toContain('AuthService');
    expect(res.text).toContain('graph');
  });

  it('GET /api/export/markdown?withMermaid=false returns plain markdown (no mermaid)', async () => {
    const plainRes = await httpGet(`${baseUrl}/api/export/markdown`);
    const withFalse = await httpGet(`${baseUrl}/api/export/markdown?withMermaid=false`);
    expect(withFalse.status).toBe(200);
    // Should be same as without param
    expect(withFalse.text).toBe(plainRes.text);
  });

  // ── GET /api/export/summary ───────────────────────────────

  it('GET /api/export/summary returns markdown+mermaid with text/markdown content type', async () => {
    const res = await httpGet(`${baseUrl}/api/export/summary`);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type')!;
    expect(ct).toContain('text/markdown');
    expect(res.text).toContain('AuthService');
  });

  // ── Accept header content negotiation ─────────────────────

  it('Accept: application/json wraps markdown export in { content: "..." }', async () => {
    const res = await httpGet(`${baseUrl}/api/export/markdown`, {
      Accept: 'application/json',
    });
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type')!;
    expect(ct).toContain('application/json');
    const body = res.json() as { content: string };
    expect(body.content).toBeDefined();
    expect(typeof body.content).toBe('string');
    expect(body.content).toContain('AuthService');
  });

  it('Accept: application/json wraps mermaid export in { content: "..." }', async () => {
    const res = await httpGet(`${baseUrl}/api/export/mermaid`, {
      Accept: 'application/json',
    });
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type')!;
    expect(ct).toContain('application/json');
    const body = res.json() as { content: string };
    expect(body.content).toBeDefined();
    expect(typeof body.content).toBe('string');
    expect(body.content).toContain('graph');
  });

  it('Accept: application/json wraps summary export in { content: "..." }', async () => {
    const res = await httpGet(`${baseUrl}/api/export/summary`, {
      Accept: 'application/json',
    });
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type')!;
    expect(ct).toContain('application/json');
    const body = res.json() as { content: string };
    expect(body.content).toBeDefined();
    expect(body.content).toContain('AuthService');
  });

  it('Accept: application/json wraps markdown?withMermaid=true in { content: "..." }', async () => {
    const res = await httpGet(`${baseUrl}/api/export/markdown?withMermaid=true`, {
      Accept: 'application/json',
    });
    expect(res.status).toBe(200);
    const body = res.json() as { content: string };
    expect(body.content).toContain('AuthService');
    expect(body.content).toContain('graph');
  });

  it('Accept: text/plain returns raw text (no JSON wrapping)', async () => {
    const res = await httpGet(`${baseUrl}/api/export/markdown`, {
      Accept: 'text/plain',
    });
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type')!;
    expect(ct).toContain('text/markdown');
    // Should NOT be JSON
    expect(() => JSON.parse(res.text)).toThrow();
  });

  it('No Accept header returns raw text (default behavior)', async () => {
    const res = await httpGet(`${baseUrl}/api/export/markdown`);
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type')!;
    expect(ct).toContain('text/markdown');
  });

  // ── Empty architecture ────────────────────────────────────

  it('export endpoints work with empty architecture', async () => {
    // Create a fresh empty architecture
    const emptyCtx = GraphContext.createNew('Empty Arch');
    const emptyFile = path.join(tmpDir, 'empty.archc');
    await emptyCtx.saveAs(emptyFile);
    const emptyReloaded = await GraphContext.loadFromFile(emptyFile);
    const { server: emptyServer, baseUrl: emptyBaseUrl } = await startServer(emptyReloaded);

    try {
      const md = await httpGet(`${emptyBaseUrl}/api/export/markdown`);
      expect(md.status).toBe(200);
      expect(typeof md.text).toBe('string');

      const mermaid = await httpGet(`${emptyBaseUrl}/api/export/mermaid`);
      expect(mermaid.status).toBe(200);
      expect(typeof mermaid.text).toBe('string');

      const summary = await httpGet(`${emptyBaseUrl}/api/export/summary`);
      expect(summary.status).toBe(200);
      expect(typeof summary.text).toBe('string');
    } finally {
      await closeServer(emptyServer);
    }
  });
});

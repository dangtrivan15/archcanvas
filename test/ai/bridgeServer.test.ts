import { describe, it, expect, afterEach } from 'vitest';
import { createBridgeServer } from '../../src/core/ai/bridgeServer';

describe('bridgeServer', () => {
  let server: ReturnType<typeof createBridgeServer> | null = null;

  afterEach(async () => {
    if (server) await server.stop();
    server = null;
  });

  it('starts and stops cleanly', async () => {
    server = createBridgeServer({ port: 0, cwd: '/tmp' });
    const { port } = await server.start();
    expect(port).toBeGreaterThan(0);
    await server.stop();
    server = null;
  });

  it('responds to health check', async () => {
    server = createBridgeServer({ port: 0, cwd: '/tmp' });
    const { port } = await server.start();
    const res = await fetch(`http://127.0.0.1:${port}/__archcanvas_ai/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('returns 404 for unknown routes', async () => {
    server = createBridgeServer({ port: 0, cwd: '/tmp' });
    const { port } = await server.start();
    const res = await fetch(`http://127.0.0.1:${port}/__archcanvas_ai/api/unknown`, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('returns 502 when no browser client is connected', async () => {
    server = createBridgeServer({ port: 0, cwd: '/tmp' });
    const { port } = await server.start();
    const res = await fetch(`http://127.0.0.1:${port}/__archcanvas_ai/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(502);
  });
});

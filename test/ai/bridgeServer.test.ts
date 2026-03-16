import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
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

});

describe('bridgeServer — relayStoreAction', () => {
  let server: ReturnType<typeof createBridgeServer> | null = null;

  afterEach(async () => {
    if (server) await server.stop();
    server = null;
  });

  it('relays to browser and returns result', async () => {
    server = createBridgeServer({ port: 0, cwd: '/tmp' });
    const { port } = await server.start();

    // Connect a mock browser client that auto-responds to store_action
    const ws = new WebSocket(`ws://127.0.0.1:${port}/__archcanvas_ai`);
    await new Promise((r) => ws.on('open', r));
    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'store_action') {
        ws.send(JSON.stringify({
          type: 'store_action_result',
          correlationId: msg.correlationId,
          ok: true,
          data: { items: [] },
        }));
      }
    });

    const result = await server.relayStoreAction('list', {});
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ items: [] });

    ws.close();
  });

  it('returns error when no browser connected', async () => {
    server = createBridgeServer({ port: 0, cwd: '/tmp' });
    await server.start();

    const result = await server.relayStoreAction('list', {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('BRIDGE_DISCONNECTED');
  });
});

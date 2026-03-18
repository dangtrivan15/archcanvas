// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createBridgeServer, type RelayStoreActionFn } from '../../src/core/ai/bridgeServer';
import type { BridgeSession } from '../../src/core/ai/claudeCodeBridge';

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

describe('bridgeServer — idle timeout', () => {
  let server: ReturnType<typeof createBridgeServer> | null = null;

  afterEach(async () => {
    if (server) await server.stop();
    server = null;
  });

  it('fires onIdleTimeout when last client disconnects and no reconnect within timeout', async () => {
    let idleFired = false;
    server = createBridgeServer({
      port: 0,
      cwd: '/tmp',
      idleTimeoutMs: 200,
      onIdleTimeout: () => { idleFired = true; },
    });
    const { port } = await server.start();

    // Connect and then disconnect a client
    const ws = new WebSocket(`ws://127.0.0.1:${port}/__archcanvas_ai`);
    await new Promise((r) => ws.on('open', r));
    ws.close();
    await new Promise((r) => ws.on('close', r));

    // Not fired yet — timeout hasn't elapsed
    expect(idleFired).toBe(false);

    // Wait for idle timeout to fire
    await new Promise((r) => setTimeout(r, 300));
    expect(idleFired).toBe(true);
  });

  it('cancels idle timeout when a new client connects before it fires', async () => {
    let idleFired = false;
    server = createBridgeServer({
      port: 0,
      cwd: '/tmp',
      idleTimeoutMs: 300,
      onIdleTimeout: () => { idleFired = true; },
    });
    const { port } = await server.start();

    // Connect and disconnect first client
    const ws1 = new WebSocket(`ws://127.0.0.1:${port}/__archcanvas_ai`);
    await new Promise((r) => ws1.on('open', r));
    ws1.close();
    await new Promise((r) => ws1.on('close', r));

    // Wait 100ms, then reconnect before 300ms idle fires
    await new Promise((r) => setTimeout(r, 100));
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}/__archcanvas_ai`);
    await new Promise((r) => ws2.on('open', r));

    // Wait past the original timeout
    await new Promise((r) => setTimeout(r, 300));
    expect(idleFired).toBe(false);

    ws2.close();
  });

  it('does not fire idle timeout if there were never any connections', async () => {
    let idleFired = false;
    server = createBridgeServer({
      port: 0,
      cwd: '/tmp',
      idleTimeoutMs: 100,
      onIdleTimeout: () => { idleFired = true; },
    });
    await server.start();

    // Wait well past the timeout — should not fire since no client ever connected
    await new Promise((r) => setTimeout(r, 200));
    expect(idleFired).toBe(false);
  });

  it('does not fire when idleTimeoutMs is not set', async () => {
    let idleFired = false;
    server = createBridgeServer({
      port: 0,
      cwd: '/tmp',
      onIdleTimeout: () => { idleFired = true; },
    });
    const { port } = await server.start();

    const ws = new WebSocket(`ws://127.0.0.1:${port}/__archcanvas_ai`);
    await new Promise((r) => ws.on('open', r));
    ws.close();
    await new Promise((r) => ws.on('close', r));

    await new Promise((r) => setTimeout(r, 200));
    expect(idleFired).toBe(false);
  });
});

describe('bridgeServer — sessionFactory', () => {
  let server: ReturnType<typeof createBridgeServer> | null = null;

  afterEach(async () => {
    if (server) await server.stop();
    server = null;
  });

  it('uses sessionFactory to create sessions with relay function', async () => {
    let capturedRelay: RelayStoreActionFn | null = null;

    const mockSession: BridgeSession = {
      async *sendMessage() { yield { type: 'done' as const, requestId: '' }; },
      respondToPermission() {},
      respondToQuestion() {},
      loadHistory() {},
      setPermissionMode() {},
      setEffort() {},
      interrupt() {},
      destroy() {},
    };

    server = createBridgeServer({
      port: 0,
      cwd: '/tmp',
      sessionFactory: (relay) => {
        capturedRelay = relay;
        return mockSession;
      },
    });
    const { port } = await server.start();

    const ws = new WebSocket(`ws://127.0.0.1:${port}/__archcanvas_ai`);
    await new Promise((r) => ws.on('open', r));

    // sessionFactory should have been called with a relay function
    expect(capturedRelay).toBeTypeOf('function');

    ws.close();
  });

  it('mock session can relay store actions to the browser via factory relay', async () => {
    let capturedRelay: RelayStoreActionFn | null = null;
    const storeActions: { action: string; args: Record<string, unknown> }[] = [];

    const mockSession: BridgeSession = {
      async *sendMessage() {
        // Use the relay to add a node — this goes through WebSocket to browser
        if (capturedRelay) {
          await capturedRelay('addNode', {
            canvasId: '__root__',
            id: 'svc-test',
            type: 'compute/service',
            name: 'Test Service',
          });
        }
        yield { type: 'text' as const, requestId: '', content: 'Added a node.' };
        yield { type: 'done' as const, requestId: '' };
      },
      respondToPermission() {},
      respondToQuestion() {},
      loadHistory() {},
      setPermissionMode() {},
      setEffort() {},
      interrupt() {},
      destroy() {},
    };

    server = createBridgeServer({
      port: 0,
      cwd: '/tmp',
      sessionFactory: (relay) => {
        capturedRelay = relay;
        return mockSession;
      },
    });
    const { port } = await server.start();

    // Connect a mock browser that records store actions and auto-responds
    const ws = new WebSocket(`ws://127.0.0.1:${port}/__archcanvas_ai`);
    await new Promise((r) => ws.on('open', r));

    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'store_action') {
        storeActions.push({ action: msg.action, args: msg.args });
        ws.send(JSON.stringify({
          type: 'store_action_result',
          correlationId: msg.correlationId,
          ok: true,
          data: { nodeId: 'svc-test' },
        }));
      }
    });

    // Send a chat message to trigger the mock session
    ws.send(JSON.stringify({
      type: 'chat',
      requestId: 'req-1',
      content: 'add a service',
      context: { projectName: 'test', projectPath: '/tmp', canvasId: '__root__', architecture: '' },
    }));

    // Wait for the relay round-trip
    await new Promise((r) => setTimeout(r, 200));

    expect(storeActions).toHaveLength(1);
    expect(storeActions[0].action).toBe('addNode');
    expect(storeActions[0].args).toMatchObject({
      canvasId: '__root__',
      id: 'svc-test',
      type: 'compute/service',
    });

    ws.close();
  });
});

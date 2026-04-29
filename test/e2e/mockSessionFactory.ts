/**
 * Scenario-based mock session factory for E2E bridge tests.
 *
 * Each scenario is an async generator that receives the relay function and
 * project context, calls relay actions, and yields ChatEvents. The chat
 * message content is used as the scenario key (exact match).
 *
 * To add a new test scenario:
 * 1. Add an async generator function to the `scenarios` map below
 * 2. Add a Playwright test in ai-bridge.spec.ts that sends the scenario key
 *
 * Activated via MOCK_BRIDGE=1 env var in vite.config.ts.
 */

import type { BridgeSession } from '../../src-web/core/ai/claudeCodeBridge';
import type { RelayStoreActionFn, StoreActionResult } from '../../src-web/core/ai/bridgeServer';
import type { ChatEvent, ProjectContext } from '../../src-web/core/ai/types';

// ---------------------------------------------------------------------------
// Scenario type + registry
// ---------------------------------------------------------------------------

type Scenario = (
  relay: RelayStoreActionFn,
  context: ProjectContext,
) => AsyncGenerator<ChatEvent>;

const scenarios = new Map<string, Scenario>();

// ---------------------------------------------------------------------------
// Helper — yield text or error based on relay result
// ---------------------------------------------------------------------------

function textEvent(content: string): ChatEvent {
  return { type: 'text', requestId: '', content };
}

function doneEvent(): ChatEvent {
  return { type: 'done', requestId: '' };
}

function resultText(label: string, result: StoreActionResult): string {
  return result.ok
    ? `${label}: ok`
    : `${label}: FAILED (${result.error?.code}: ${result.error?.message})`;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/** Add a single service node. */
scenarios.set('add-node', async function* (relay, ctx) {
  const r = await relay('addNode', {
    canvasId: ctx.currentScope ?? '__root__',
    id: 'mock-svc-1',
    type: 'compute/service',
    name: 'Mock Service',
  });
  yield textEvent(resultText('addNode', r));
  yield doneEvent();
});

/** Add two nodes and connect them with an edge. */
scenarios.set('add-edge', async function* (relay, ctx) {
  const canvasId = ctx.currentScope ?? '__root__';

  const r1 = await relay('addNode', {
    canvasId, id: 'gateway-1', type: 'network/api-gateway', name: 'Gateway',
  });
  yield textEvent(resultText('addNode(gateway)', r1));

  const r2 = await relay('addNode', {
    canvasId, id: 'svc-1', type: 'compute/service', name: 'Backend',
  });
  yield textEvent(resultText('addNode(backend)', r2));

  const r3 = await relay('addEdge', {
    canvasId,
    edge: {
      from: { node: 'gateway-1' },
      to: { node: 'svc-1' },
      protocol: 'HTTP',
      label: 'routes to',
    },
  });
  yield textEvent(resultText('addEdge', r3));
  yield doneEvent();
});

/** Add a node then remove it. */
scenarios.set('remove-node', async function* (relay, ctx) {
  const canvasId = ctx.currentScope ?? '__root__';

  await relay('addNode', {
    canvasId, id: 'temp-1', type: 'compute/worker', name: 'Temp Worker',
  });
  yield textEvent('Added temp-1');

  const r = await relay('removeNode', { canvasId, nodeId: 'temp-1' });
  yield textEvent(resultText('removeNode', r));
  yield doneEvent();
});

/** Add nodes then list them, returning the list data in chat. */
scenarios.set('list-nodes', async function* (relay, ctx) {
  const canvasId = ctx.currentScope ?? '__root__';

  await relay('addNode', {
    canvasId, id: 'db-1', type: 'data/database', name: 'Primary DB',
  });
  await relay('addNode', {
    canvasId, id: 'cache-1', type: 'data/cache', name: 'Redis Cache',
  });

  const r = await relay('list', { canvasId, type: 'nodes' });
  if (r.ok) {
    const data = r.data as { nodes?: Array<{ id: string }> };
    const ids = (data.nodes ?? []).map((n) => n.id).join(', ');
    yield textEvent(`list: ${ids}`);
  } else {
    yield textEvent(resultText('list', r));
  }
  yield doneEvent();
});

/** Import multiple nodes and edges in a single batch. */
scenarios.set('import-batch', async function* (relay, ctx) {
  const canvasId = ctx.currentScope ?? '__root__';

  const r = await relay('import', {
    canvasId,
    nodes: [
      { id: 'web-1', type: 'compute/service', displayName: 'Web App' },
      { id: 'api-1', type: 'compute/service', displayName: 'API Server' },
      { id: 'db-1', type: 'data/database', displayName: 'Postgres' },
    ],
    edges: [
      { from: { node: 'web-1' }, to: { node: 'api-1' }, protocol: 'HTTP' },
      { from: { node: 'api-1' }, to: { node: 'db-1' }, protocol: 'SQL' },
    ],
  });

  if (r.ok) {
    const data = r.data as { added: { nodes: number; edges: number } };
    yield textEvent(`imported: ${data.added.nodes} nodes, ${data.added.edges} edges`);
  } else {
    yield textEvent(resultText('import', r));
  }
  yield doneEvent();
});

/** Build a small microservice architecture (3 nodes, 2 edges). */
scenarios.set('full-arch', async function* (relay, ctx) {
  const canvasId = ctx.currentScope ?? '__root__';

  await relay('addNode', { canvasId, id: 'gw-1', type: 'network/api-gateway', name: 'API Gateway' });
  await relay('addNode', { canvasId, id: 'users-svc', type: 'compute/service', name: 'Users Service' });
  await relay('addNode', { canvasId, id: 'users-db', type: 'data/database', name: 'Users DB' });

  await relay('addEdge', {
    canvasId,
    edge: { from: { node: 'gw-1' }, to: { node: 'users-svc' }, protocol: 'gRPC', label: 'user requests' },
  });
  await relay('addEdge', {
    canvasId,
    edge: { from: { node: 'users-svc' }, to: { node: 'users-db' }, protocol: 'SQL', label: 'queries' },
  });

  yield textEvent('Built architecture: 3 nodes, 2 edges');
  yield doneEvent();
});

// ---------------------------------------------------------------------------
// Factory export
// ---------------------------------------------------------------------------

export function createMockSessionFactory() {
  return (relay: RelayStoreActionFn): BridgeSession => ({
    async *sendMessage(content, context) {
      const scenario = scenarios.get(content.trim());
      if (scenario) {
        yield* scenario(relay, context);
      } else {
        yield textEvent(`Unknown scenario: "${content.trim()}". Available: ${[...scenarios.keys()].join(', ')}`);
        yield doneEvent();
      }
    },
    respondToPermission() {},
    respondToQuestion() {},
    loadHistory() {},
    clearHistory() {},
    setPermissionMode() {},
    setEffort() {},
    interrupt() {},
    destroy() {},
  });
}

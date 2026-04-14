import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClaudeCodeProvider } from '@/core/ai/webSocketProvider';
import type { ChatEvent, ProjectContext } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type WSListener = (event: { data: string }) => void;
type WSEventCallback = () => void;

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static OPEN_STATIC = 1;

  readyState = MockWebSocket.CONNECTING;
  url: string;

  private listeners = new Map<string, Array<WSListener | WSEventCallback>>();
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Auto-connect on next tick by default (tests can override)
    MockWebSocket.instances.push(this);
  }

  addEventListener(event: string, cb: WSListener | WSEventCallback): void {
    const list = this.listeners.get(event) ?? [];
    list.push(cb);
    this.listeners.set(event, list);
  }

  removeEventListener(event: string, cb: WSListener | WSEventCallback): void {
    const list = this.listeners.get(event) ?? [];
    this.listeners.set(
      event,
      list.filter((l) => l !== cb),
    );
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.fireEvent('close');
  }

  // --- Test helpers ---

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.fireEvent('open');
  }

  simulateMessage(data: string): void {
    const listeners = this.listeners.get('message') ?? [];
    for (const cb of listeners) {
      (cb as WSListener)({ data });
    }
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.fireEvent('close');
  }

  simulateError(): void {
    this.fireEvent('error');
  }

  private fireEvent(event: string): void {
    const listeners = this.listeners.get(event) ?? [];
    for (const cb of listeners) {
      (cb as WSEventCallback)();
    }
  }

  // Track instances for test access
  static instances: MockWebSocket[] = [];
  static reset(): void {
    MockWebSocket.instances = [];
  }
  static latest(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// ---------------------------------------------------------------------------
// Mock stores (graphStore, fileStore)
// ---------------------------------------------------------------------------

const mockAddNode = vi.fn().mockReturnValue({ ok: true, data: {} });
const mockAddEdge = vi.fn().mockReturnValue({ ok: true, data: {} });
const mockAddEntity = vi.fn().mockReturnValue({ ok: true, data: {} });
const mockRemoveNode = vi.fn().mockReturnValue({ ok: true, data: {} });
const mockRemoveEdge = vi.fn().mockReturnValue({ ok: true, data: {} });
const mockSave = vi.fn().mockResolvedValue(undefined);

vi.mock('@/store/graphStore', () => ({
  useGraphStore: {
    getState: () => ({
      addNode: mockAddNode,
      addEdge: mockAddEdge,
      addEntity: mockAddEntity,
      removeNode: mockRemoveNode,
      removeEdge: mockRemoveEdge,
    }),
  },
}));

const mockGetCanvas = vi.fn().mockReturnValue({ data: { nodes: [], edges: [], entities: [] } });
let mockProject: unknown = null;

vi.mock('@/store/fileStore', () => ({
  useFileStore: {
    getState: () => ({
      fs: {},
      save: mockSave,
      getCanvas: (...args: unknown[]) => mockGetCanvas(...args),
      get project() { return mockProject; },
    }),
  },
}));

const mockResolve = vi.fn().mockReturnValue({
  metadata: { namespace: 'compute', name: 'service', displayName: 'Service', description: '', tags: [] },
  spec: { ports: [] },
});
const mockRegistrySearch = vi.fn().mockReturnValue([]);
const mockListByNamespace = vi.fn().mockReturnValue([]);
const mockRegistryList = vi.fn().mockReturnValue([]);

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: {
    getState: () => ({
      resolve: mockResolve,
      search: mockRegistrySearch,
      listByNamespace: mockListByNamespace,
      list: mockRegistryList,
      projectLocalKeys: new Set<string>(),
      overrides: [],
    }),
  },
}));

vi.mock('@/storage/fileResolver', () => ({
  ROOT_CANVAS_KEY: '__root__',
}));

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let provider: WebSocketClaudeCodeProvider;
const BRIDGE_PORT = process.env.ARCHCANVAS_BRIDGE_PORT ?? '5173';
const TEST_URL = `ws://localhost:${BRIDGE_PORT}/__archcanvas_ai`;

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.reset();
  // Install mock WebSocket globally
  vi.stubGlobal('WebSocket', MockWebSocket);
  provider = new WebSocketClaudeCodeProvider();
  mockAddNode.mockClear();
  mockAddEdge.mockClear();
  mockRemoveNode.mockClear();
  mockRemoveEdge.mockClear();
  mockSave.mockClear();
  mockAddEntity.mockClear();
  mockGetCanvas.mockClear();
  mockGetCanvas.mockReturnValue({ data: { nodes: [], edges: [], entities: [] } });
  mockProject = null;
  mockResolve.mockClear();
  mockResolve.mockReturnValue({
    metadata: { namespace: 'compute', name: 'service', displayName: 'Service', description: '', tags: [] },
    spec: { ports: [] },
  });
  mockRegistrySearch.mockClear();
  mockListByNamespace.mockClear();
  mockRegistryList.mockClear();
});

afterEach(() => {
  provider.disconnect();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function connectProvider(): MockWebSocket {
  provider.connect(TEST_URL);
  const ws = MockWebSocket.latest();
  ws.simulateOpen();
  return ws;
}

const defaultContext: ProjectContext = {
  projectName: 'TestProject',
  currentScope: '@root',
  projectPath: '.',
};

async function collectEvents(
  iterable: AsyncIterable<ChatEvent>,
): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('WebSocketClaudeCodeProvider', () => {
  // -----------------------------------------------------------------------
  // Connection
  // -----------------------------------------------------------------------

  describe('connection', () => {
    it('creates a WebSocket to the given URL', () => {
      provider.connect(TEST_URL);
      const ws = MockWebSocket.latest();
      expect(ws).toBeDefined();
      expect(ws.url).toBe(TEST_URL);
    });

    it('reports available=true when WebSocket is open', () => {
      expect(provider.available).toBe(false);
      connectProvider();
      expect(provider.available).toBe(true);
    });

    it('reports available=false when WebSocket is closed', () => {
      const ws = connectProvider();
      ws.simulateClose();
      expect(provider.available).toBe(false);
    });

    it('fires connectionChange callback on open and close', () => {
      const cb = vi.fn();
      provider.setConnectionChangeCallback(cb);
      const ws = connectProvider();
      expect(cb).toHaveBeenCalledWith(true);

      ws.simulateClose();
      expect(cb).toHaveBeenCalledWith(false);
    });

    it('disconnect() prevents auto-reconnect', () => {
      connectProvider();
      provider.disconnect();
      // After disconnect, no new WebSocket should be created
      const countBefore = MockWebSocket.instances.length;
      vi.advanceTimersByTime(60_000);
      expect(MockWebSocket.instances.length).toBe(countBefore);
    });
  });

  // -----------------------------------------------------------------------
  // Reconnection
  // -----------------------------------------------------------------------

  describe('auto-reconnect', () => {
    it('reconnects with exponential backoff after unexpected close', () => {
      const ws = connectProvider();
      const initialCount = MockWebSocket.instances.length;

      // Simulate unexpected close (not intentional disconnect)
      ws.simulateClose();

      // After 1s: first reconnect attempt
      vi.advanceTimersByTime(999);
      expect(MockWebSocket.instances.length).toBe(initialCount);
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(initialCount + 1);

      // Second close → 2s backoff
      const ws2 = MockWebSocket.latest();
      ws2.simulateClose();
      vi.advanceTimersByTime(1999);
      expect(MockWebSocket.instances.length).toBe(initialCount + 1);
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(initialCount + 2);

      // Third close → 4s backoff
      const ws3 = MockWebSocket.latest();
      ws3.simulateClose();
      vi.advanceTimersByTime(3999);
      expect(MockWebSocket.instances.length).toBe(initialCount + 2);
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(initialCount + 3);
    });

    it('caps backoff at 30s', () => {
      const ws = connectProvider();

      // Simulate many failed reconnects to exceed max backoff
      let currentWs = ws;
      for (let i = 0; i < 10; i++) {
        currentWs.simulateClose();
        vi.advanceTimersByTime(30_000);
        currentWs = MockWebSocket.latest();
      }

      // After many retries, the next backoff should still be capped at 30s
      currentWs.simulateClose();
      const countBefore = MockWebSocket.instances.length;
      vi.advanceTimersByTime(29_999);
      expect(MockWebSocket.instances.length).toBe(countBefore);
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(countBefore + 1);
    });

    it('resets backoff on successful reconnect', () => {
      const ws = connectProvider();
      const initialCount = MockWebSocket.instances.length;

      // First disconnect → reconnect after 1s
      ws.simulateClose();
      vi.advanceTimersByTime(1000);
      const ws2 = MockWebSocket.latest();
      ws2.simulateOpen(); // successful reconnect resets the counter

      // Second disconnect → should be 1s again (not 2s)
      ws2.simulateClose();
      vi.advanceTimersByTime(999);
      expect(MockWebSocket.instances.length).toBe(initialCount + 1);
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(initialCount + 2);
    });
  });

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------

  describe('sendMessage', () => {
    it('sends a chat message with requestId over WebSocket', () => {
      const ws = connectProvider();
      provider.sendMessage('Hello', defaultContext);
      expect(ws.sent.length).toBe(1);

      const msg = JSON.parse(ws.sent[0]);
      expect(msg.type).toBe('chat');
      expect(msg.content).toBe('Hello');
      expect(msg.context).toEqual(defaultContext);
      expect(msg.requestId).toBeDefined();
      expect(typeof msg.requestId).toBe('string');
    });

    it('returns an AsyncIterable that yields ChatEvents filtered by requestId', async () => {
      const ws = connectProvider();
      const stream = provider.sendMessage('Hello', defaultContext);
      const requestId = JSON.parse(ws.sent[0]).requestId;

      // Simulate server response
      const collectPromise = collectEvents(stream);

      // Send events matching the requestId
      ws.simulateMessage(
        JSON.stringify({ type: 'text', requestId, content: 'Hi there' }),
      );
      ws.simulateMessage(
        JSON.stringify({ type: 'done', requestId }),
      );

      const events = await collectPromise;
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'text', requestId, content: 'Hi there' });
      expect(events[1]).toEqual({ type: 'done', requestId });
    });

    it('filters out events with different requestId', async () => {
      const ws = connectProvider();
      const stream = provider.sendMessage('Hello', defaultContext);
      const requestId = JSON.parse(ws.sent[0]).requestId;

      const collectPromise = collectEvents(stream);

      // Send event with wrong requestId — should be ignored
      ws.simulateMessage(
        JSON.stringify({ type: 'text', requestId: 'other-id', content: 'Wrong' }),
      );
      // Send correct events
      ws.simulateMessage(
        JSON.stringify({ type: 'text', requestId, content: 'Right' }),
      );
      ws.simulateMessage(
        JSON.stringify({ type: 'done', requestId }),
      );

      const events = await collectPromise;
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('text');
      if (events[0].type === 'text') {
        expect(events[0].content).toBe('Right');
      }
    });

    it('completes on error event', async () => {
      const ws = connectProvider();
      const stream = provider.sendMessage('Hello', defaultContext);
      const requestId = JSON.parse(ws.sent[0]).requestId;

      const collectPromise = collectEvents(stream);

      ws.simulateMessage(
        JSON.stringify({ type: 'text', requestId, content: 'Partial' }),
      );
      ws.simulateMessage(
        JSON.stringify({ type: 'error', requestId, message: 'Something failed' }),
      );

      const events = await collectPromise;
      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('error');
    });

    it('yields error event when not connected', async () => {
      // Don't connect
      const stream = provider.sendMessage('Hello', defaultContext);
      const events = await collectEvents(stream);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      if (events[0].type === 'error') {
        expect(events[0].message).toBe('Not connected to AI bridge');
      }
    });

    it('yields multiple text events incrementally', async () => {
      const ws = connectProvider();
      const stream = provider.sendMessage('Hello', defaultContext);
      const requestId = JSON.parse(ws.sent[0]).requestId;

      const collectPromise = collectEvents(stream);

      ws.simulateMessage(
        JSON.stringify({ type: 'text', requestId, content: 'Part 1 ' }),
      );
      ws.simulateMessage(
        JSON.stringify({ type: 'text', requestId, content: 'Part 2 ' }),
      );
      ws.simulateMessage(
        JSON.stringify({ type: 'text', requestId, content: 'Part 3' }),
      );
      ws.simulateMessage(
        JSON.stringify({ type: 'done', requestId }),
      );

      const events = await collectPromise;
      expect(events).toHaveLength(4);
      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents).toHaveLength(3);
    });

    it('yields tool_call and tool_result events', async () => {
      const ws = connectProvider();
      const stream = provider.sendMessage('Add a service', defaultContext);
      const requestId = JSON.parse(ws.sent[0]).requestId;

      const collectPromise = collectEvents(stream);

      ws.simulateMessage(
        JSON.stringify({
          type: 'tool_call',
          requestId,
          id: 'tc-1',
          name: 'Bash',
          args: { command: 'archcanvas add-node --id svc --type compute/service --json' },
        }),
      );
      ws.simulateMessage(
        JSON.stringify({
          type: 'tool_result',
          requestId,
          id: 'tc-1',
          result: '{"ok":true}',
        }),
      );
      ws.simulateMessage(
        JSON.stringify({ type: 'done', requestId }),
      );

      const events = await collectPromise;
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('tool_call');
      expect(events[1].type).toBe('tool_result');
    });
  });

  // -----------------------------------------------------------------------
  // loadHistory
  // -----------------------------------------------------------------------

  describe('loadHistory', () => {
    it('sends load_history message over WebSocket', () => {
      const ws = connectProvider();
      const messages = [
        { role: 'user' as const, content: 'Hello', timestamp: 1 },
        { role: 'assistant' as const, content: 'Hi', timestamp: 2 },
      ];
      provider.loadHistory(messages);
      expect(ws.sent.length).toBe(1);

      const msg = JSON.parse(ws.sent[0]);
      expect(msg.type).toBe('load_history');
      expect(msg.messages).toEqual(messages);
    });

    it('no-ops when not connected', () => {
      // Not connected, should not throw
      provider.loadHistory([]);
    });
  });

  // -----------------------------------------------------------------------
  // interrupt
  // -----------------------------------------------------------------------

  describe('interrupt', () => {
    it('sends interrupt message over WebSocket', () => {
      const ws = connectProvider();
      provider.interrupt();
      expect(ws.sent.length).toBe(1);

      const msg = JSON.parse(ws.sent[0]);
      expect(msg.type).toBe('interrupt');
    });

    it('terminates the active event stream immediately', async () => {
      connectProvider();
      const stream = provider.sendMessage('hello', defaultContext);

      // Interrupt before any events arrive — the stream should terminate
      // without ever receiving a done/error event from the server
      provider.interrupt();

      const events: ChatEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Stream terminated cleanly with no events
      expect(events.length).toBe(0);
    });

    it('ignores events arriving after interrupt', async () => {
      const ws = connectProvider();
      const stream = provider.sendMessage('hello', defaultContext);

      const chatMsg = JSON.parse(ws.sent[0]);
      const requestId = chatMsg.requestId;

      // Interrupt immediately
      provider.interrupt();

      // Simulate events arriving after interrupt (from server-side lag)
      ws.simulateMessage(JSON.stringify({
        type: 'text',
        requestId,
        content: 'late text',
      }));

      const events: ChatEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      // No events should be collected — interrupt happened before any were queued
      expect(events.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // sendPermissionResponse
  // -----------------------------------------------------------------------

  describe('sendPermissionResponse', () => {
    it('sends permission_response message', () => {
      const ws = connectProvider();
      provider.sendPermissionResponse('perm-1', true);
      expect(ws.sent.length).toBe(1);

      const msg = JSON.parse(ws.sent[0]);
      expect(msg.type).toBe('permission_response');
      expect(msg.id).toBe('perm-1');
      expect(msg.allowed).toBe(true);
    });

    it('sends deny response', () => {
      const ws = connectProvider();
      provider.sendPermissionResponse('perm-2', false);
      const msg = JSON.parse(ws.sent[0]);
      expect(msg.allowed).toBe(false);
    });

    it('includes updatedPermissions when provided with SDK-shaped suggestions', () => {
      const ws = connectProvider();
      provider.sendPermissionResponse('perm-3', true, {
        updatedPermissions: [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' }],
      });
      const msg = JSON.parse(ws.sent[0]);
      expect(msg.type).toBe('permission_response');
      expect(msg.id).toBe('perm-3');
      expect(msg.allowed).toBe(true);
      expect(msg.updatedPermissions).toEqual([{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' }]);
      expect(msg.interrupt).toBeUndefined();
    });

    it('includes interrupt when provided', () => {
      const ws = connectProvider();
      provider.sendPermissionResponse('perm-4', false, { interrupt: true });
      const msg = JSON.parse(ws.sent[0]);
      expect(msg.type).toBe('permission_response');
      expect(msg.id).toBe('perm-4');
      expect(msg.allowed).toBe(false);
      expect(msg.interrupt).toBe(true);
      expect(msg.updatedPermissions).toBeUndefined();
    });

    it('omits optional fields when options not provided', () => {
      const ws = connectProvider();
      provider.sendPermissionResponse('perm-5', true);
      const msg = JSON.parse(ws.sent[0]);
      expect(msg).not.toHaveProperty('updatedPermissions');
      expect(msg).not.toHaveProperty('interrupt');
    });
  });

  // -----------------------------------------------------------------------
  // Store action handler
  // -----------------------------------------------------------------------

  describe('store action handler', () => {
    it('routes store_action to graphStore methods and sends result back', async () => {
      const ws = connectProvider();

      ws.simulateMessage(
        JSON.stringify({
          type: 'store_action',
          action: 'addNode',
          args: { canvasId: '@root', id: 'svc-1', type: 'compute/service' },
          correlationId: 'corr-1',
        }),
      );

      // Wait for handler to complete
      await vi.advanceTimersByTimeAsync(0);

      // addNode is called with enriched InlineNode (displayName resolved from registry)
      expect(mockAddNode).toHaveBeenCalledWith('@root', {
        id: 'svc-1',
        type: 'compute/service',
        displayName: 'Service',
        args: undefined,
      });
      // No auto-save — dirty tracking handles persistence
      expect(mockSave).not.toHaveBeenCalled();

      // Check response sent back
      expect(ws.sent.length).toBe(1);
      const response = JSON.parse(ws.sent[0]);
      expect(response.type).toBe('store_action_result');
      expect(response.correlationId).toBe('corr-1');
      expect(response.ok).toBe(true);
      expect(response.data).toEqual({ ok: true, data: {} });
    });

    it('returns error for unknown store action', async () => {
      const ws = connectProvider();

      ws.simulateMessage(
        JSON.stringify({
          type: 'store_action',
          action: 'nonexistentMethod',
          args: {},
          correlationId: 'corr-2',
        }),
      );

      await vi.advanceTimersByTimeAsync(0);

      expect(ws.sent.length).toBe(1);
      const response = JSON.parse(ws.sent[0]);
      expect(response.type).toBe('store_action_result');
      expect(response.correlationId).toBe('corr-2');
      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('UNKNOWN_ACTION');
    });

    // NO_FILESYSTEM test removed — auto-save was removed per ephemeral bridge design.
    // Dirty tracking marks canvases; user saves via Cmd+S.
  });

  // -----------------------------------------------------------------------
  // Dispatcher: addNode enrichment
  // -----------------------------------------------------------------------

  describe('addNode enrichment', () => {
    it('returns UNKNOWN_NODE_TYPE with suggestions when type is not registered', async () => {
      mockResolve.mockReturnValue(null);
      mockRegistrySearch.mockReturnValue([
        { metadata: { namespace: 'compute', name: 'service', displayName: 'Service', description: '', tags: [] }, spec: {} },
      ]);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'addNode',
        args: { canvasId: '__root__', id: 'x', type: 'compute/nonexistent' },
        correlationId: 'enrich-1',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe('UNKNOWN_NODE_TYPE');
      expect(r.error.message).toContain('compute/service');
    });

    it('resolves dot→slash substitution for type', async () => {
      // First resolve returns null (dot format), second returns the nodeDef (slash format)
      mockResolve
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({
          metadata: { namespace: 'compute', name: 'service', displayName: 'Service', description: '', tags: [] },
          spec: { ports: [] },
        });
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'addNode',
        args: { canvasId: '__root__', id: 'svc-dot', type: 'compute.service' },
        correlationId: 'enrich-2',
      }));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockAddNode).toHaveBeenCalledWith('__root__', expect.objectContaining({
        id: 'svc-dot', type: 'compute/service', displayName: 'Service',
      }));
      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
    });

    it('uses provided name instead of registry displayName', async () => {
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'addNode',
        args: { canvasId: '__root__', id: 'svc-named', type: 'compute/service', name: 'My API' },
        correlationId: 'enrich-3',
      }));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockAddNode).toHaveBeenCalledWith('__root__', expect.objectContaining({
        displayName: 'My API',
      }));
    });

    it('returns INVALID_ARGS for malformed args JSON', async () => {
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'addNode',
        args: { canvasId: '__root__', id: 'x', type: 'compute/service', args: '{bad json' },
        correlationId: 'enrich-4',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe('INVALID_ARGS');
    });
  });

  // -----------------------------------------------------------------------
  // Dispatcher: import
  // -----------------------------------------------------------------------

  describe('import dispatcher', () => {
    it('imports pre-parsed nodes/edges/entities and returns counts', async () => {
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'import',
        args: {
          canvasId: '__root__',
          nodes: [{ id: 'n1', type: 'compute/service', displayName: 'N1' }],
          edges: [{ from: { node: 'n1' }, to: { node: 'n2' } }],
          entities: [{ name: 'E1', description: 'Entity' }],
        },
        correlationId: 'imp-1',
      }));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockAddNode).toHaveBeenCalledTimes(1);
      expect(mockAddEdge).toHaveBeenCalledTimes(1);
      expect(mockAddEntity).toHaveBeenCalledTimes(1);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
      expect(r.data.added).toEqual({ nodes: 1, edges: 1, entities: 1 });
      expect(r.data.errors).toEqual([]);
    });

    it('returns CANVAS_NOT_FOUND when canvas does not exist', async () => {
      mockGetCanvas.mockReturnValue(null);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'import',
        args: { canvasId: 'nonexistent', nodes: [], edges: [], entities: [] },
        correlationId: 'imp-2',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe('CANVAS_NOT_FOUND');
    });

    it('collects errors without stopping on first failure', async () => {
      mockAddNode.mockReturnValue({ ok: false, error: { code: 'DUPLICATE_NODE_ID' } });
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'import',
        args: {
          canvasId: '__root__',
          nodes: [
            { id: 'dup1', type: 'compute/service', displayName: 'Dup1' },
            { id: 'dup2', type: 'compute/service', displayName: 'Dup2' },
          ],
          edges: [], entities: [],
        },
        correlationId: 'imp-3',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
      expect(r.data.added.nodes).toBe(0);
      expect(r.data.errors).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Dispatcher: list
  // -----------------------------------------------------------------------

  describe('list dispatcher', () => {
    const canvasData = {
      data: {
        nodes: [
          { id: 'svc-1', type: 'compute/service', displayName: 'API' },
          { id: 'db-1', type: 'data/database', displayName: 'DB' },
        ],
        edges: [
          { from: { node: 'svc-1' }, to: { node: 'db-1' }, label: 'reads', protocol: 'TCP' },
        ],
        entities: [
          { name: 'Order', description: 'An order' },
        ],
      },
    };

    it('lists all items by default', async () => {
      mockGetCanvas.mockReturnValue(canvasData);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'list',
        args: { canvasId: '__root__' },
        correlationId: 'list-1',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
      expect(r.data.nodes).toHaveLength(2);
      expect(r.data.edges).toHaveLength(1);
      expect(r.data.entities).toHaveLength(1);
    });

    it('filters by type=nodes', async () => {
      mockGetCanvas.mockReturnValue(canvasData);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'list',
        args: { canvasId: '__root__', type: 'nodes' },
        correlationId: 'list-2',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
      expect(r.data.nodes).toHaveLength(2);
      expect(r.data.edges).toBeUndefined();
      expect(r.data.entities).toBeUndefined();
    });

    it('returns CANVAS_NOT_FOUND for unknown canvas', async () => {
      mockGetCanvas.mockReturnValue(null);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'list',
        args: { canvasId: 'nope' },
        correlationId: 'list-3',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe('CANVAS_NOT_FOUND');
    });

    it('formats node output with id, type, displayName', async () => {
      mockGetCanvas.mockReturnValue(canvasData);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'list',
        args: { canvasId: '__root__', type: 'nodes' },
        correlationId: 'list-4',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.data.nodes[0]).toEqual({ id: 'svc-1', type: 'compute/service', displayName: 'API' });
    });
  });

  // -----------------------------------------------------------------------
  // Dispatcher: describe
  // -----------------------------------------------------------------------

  describe('describe dispatcher', () => {
    const canvasData = {
      data: {
        nodes: [
          { id: 'svc-1', type: 'compute/service', displayName: 'API', args: { lang: 'TS' }, notes: [], codeRefs: ['src/api.ts'] },
          { id: 'db-1', type: 'data/database', displayName: 'DB' },
        ],
        edges: [
          { from: { node: 'svc-1' }, to: { node: 'db-1' }, label: 'reads', protocol: 'TCP' },
        ],
        entities: [],
      },
    };

    it('describes a node by ID with connected edges and ports', async () => {
      mockGetCanvas.mockReturnValue(canvasData);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'describe',
        args: { canvasId: '__root__', id: 'svc-1' },
        correlationId: 'desc-1',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
      expect(r.data.node.id).toBe('svc-1');
      expect(r.data.node.type).toBe('compute/service');
      expect(r.data.node.displayName).toBe('API');
      expect(r.data.node.args).toEqual({ lang: 'TS' });
      expect(r.data.node.codeRefs).toEqual(['src/api.ts']);
      expect(r.data.node.connectedEdges).toHaveLength(1);
      expect(r.data.node.ports).toEqual([]);
    });

    it('returns NODE_NOT_FOUND for unknown node ID', async () => {
      mockGetCanvas.mockReturnValue(canvasData);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'describe',
        args: { canvasId: '__root__', id: 'nonexistent' },
        correlationId: 'desc-2',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe('NODE_NOT_FOUND');
    });

    it('describes full architecture when no id is given', async () => {
      mockProject = {
        canvases: new Map([
          ['__root__', { data: { project: { name: 'TestProj' }, nodes: [{ id: 'a' }], edges: [], entities: [] } }],
          ['child', { data: { nodes: [{ id: 'b' }, { id: 'c' }], edges: [{ from: { node: 'b' }, to: { node: 'c' } }], entities: [] } }],
        ]),
      };
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'describe',
        args: {},
        correlationId: 'desc-3',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
      expect(r.data.project).toBe('TestProj');
      expect(r.data.scopes).toHaveLength(2);
      expect(r.data.scopes[0].nodeCount).toBe(1);
      expect(r.data.scopes[1].nodeCount).toBe(2);
      expect(r.data.scopes[1].edgeCount).toBe(1);
    });

    it('returns PROJECT_LOAD_FAILED when no project', async () => {
      mockProject = null;
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'describe',
        args: {},
        correlationId: 'desc-4',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(false);
      expect(r.error.code).toBe('PROJECT_LOAD_FAILED');
    });
  });

  // -----------------------------------------------------------------------
  // Dispatcher: search
  // -----------------------------------------------------------------------

  describe('search dispatcher', () => {
    beforeEach(() => {
      mockProject = {
        canvases: new Map([
          ['__root__', {
            data: {
              nodes: [
                { id: 'svc-api', type: 'compute/service', displayName: 'API Service' },
                { id: 'db-main', type: 'data/database', displayName: 'Main DB' },
              ],
              edges: [
                { from: { node: 'svc-api' }, to: { node: 'db-main' }, label: 'reads from' },
              ],
              entities: [
                { name: 'Order', description: 'Customer order' },
              ],
            },
          }],
        ]),
      };
    });

    it('searches across nodes by displayName', async () => {
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'search',
        args: { query: 'Main DB' },
        correlationId: 'search-1',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
      expect(r.data.results).toHaveLength(1);
      expect(r.data.results[0].type).toBe('node');
      expect(r.data.results[0].item.id).toBe('db-main');
    });

    it('is case-insensitive', async () => {
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'search',
        args: { query: 'main db' },
        correlationId: 'search-2',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.data.results).toHaveLength(1);
    });

    it('filters by type', async () => {
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'search',
        args: { query: 'order', type: 'entities' },
        correlationId: 'search-3',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.data.results).toHaveLength(1);
      expect(r.data.results[0].type).toBe('entity');
    });

    it('returns empty results for non-matching query', async () => {
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'search',
        args: { query: 'zzzznotfound' },
        correlationId: 'search-4',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
      expect(r.data.results).toHaveLength(0);
    });

    it('searches edge labels', async () => {
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'search',
        args: { query: 'reads' },
        correlationId: 'search-5',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.data.results.some((item: { type: string }) => item.type === 'edge')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Dispatcher: catalog
  // -----------------------------------------------------------------------

  describe('catalog dispatcher', () => {
    const mockDefs = [
      { metadata: { namespace: 'compute', name: 'service', displayName: 'Service', description: 'A service', tags: ['core'] } },
      { metadata: { namespace: 'data', name: 'database', displayName: 'Database', description: 'A database', tags: [] } },
    ];

    it('returns all node types', async () => {
      mockRegistryList.mockReturnValue(mockDefs);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'catalog',
        args: {},
        correlationId: 'cat-1',
      }));
      await vi.advanceTimersByTimeAsync(0);

      const r = JSON.parse(ws.sent[0]);
      expect(r.ok).toBe(true);
      expect(r.data.nodeTypes).toHaveLength(2);
      expect(r.data.nodeTypes[0]).toEqual({
        type: 'compute/service',
        displayName: 'Service',
        namespace: 'compute',
        description: 'A service',
        tags: ['core'],
        source: 'built-in',
      });
    });

    it('filters by namespace', async () => {
      mockListByNamespace.mockReturnValue([mockDefs[1]]);
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({
        type: 'store_action', action: 'catalog',
        args: { namespace: 'data' },
        correlationId: 'cat-2',
      }));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockListByNamespace).toHaveBeenCalledWith('data');
      const r = JSON.parse(ws.sent[0]);
      expect(r.data.nodeTypes).toHaveLength(1);
      expect(r.data.nodeTypes[0].type).toBe('data/database');
    });
  });

  // -----------------------------------------------------------------------
  // New methods: sendSetPermissionMode, sendSetEffort
  // -----------------------------------------------------------------------

  describe('sendSetPermissionMode', () => {
    it('sends correct message', () => {
      const sent: string[] = [];
      const provider2 = new WebSocketClaudeCodeProvider();
      (provider2 as any).ws = {
        readyState: WebSocket.OPEN,
        send: (data: string) => sent.push(data),
      };
      provider2.sendSetPermissionMode('acceptEdits');
      expect(sent).toHaveLength(1);
      expect(JSON.parse(sent[0])).toEqual({
        type: 'set_permission_mode',
        mode: 'acceptEdits',
      });
    });
  });

  describe('sendSetEffort', () => {
    it('sends correct message', () => {
      const sent: string[] = [];
      const provider2 = new WebSocketClaudeCodeProvider();
      (provider2 as any).ws = {
        readyState: WebSocket.OPEN,
        send: (data: string) => sent.push(data),
      };
      provider2.sendSetEffort('low');
      expect(sent).toHaveLength(1);
      expect(JSON.parse(sent[0])).toEqual({
        type: 'set_effort',
        effort: 'low',
      });
    });
  });

  // -----------------------------------------------------------------------
  // New event types: status, rate_limit
  // -----------------------------------------------------------------------

  describe('new event types', () => {
    it('routes status and rate_limit events through the existing event handler', () => {
      const ws = connectProvider();
      const received: Array<Record<string, unknown>> = [];
      (provider as any).eventListeners.set('req-status', (event: Record<string, unknown>) => {
        received.push(event);
      });
      ws.simulateMessage(JSON.stringify({
        type: 'status',
        requestId: 'req-status',
        message: 'Reading file...',
      }));
      ws.simulateMessage(JSON.stringify({
        type: 'rate_limit',
        requestId: 'req-status',
        message: 'Rate limited, retrying in 5s',
      }));
      expect(received).toHaveLength(2);
      expect(received[0].type).toBe('status');
      expect(received[1].type).toBe('rate_limit');
    });
  });

  // -----------------------------------------------------------------------
  // Malformed messages
  // -----------------------------------------------------------------------

  describe('message handling edge cases', () => {
    it('ignores malformed JSON messages', () => {
      const ws = connectProvider();
      // Should not throw
      ws.simulateMessage('not valid json {{{');
    });

    it('ignores messages without a type', () => {
      const ws = connectProvider();
      ws.simulateMessage(JSON.stringify({ foo: 'bar' }));
    });

    it('ignores ChatEvents with no matching listener', () => {
      const ws = connectProvider();
      // A message with a requestId but no active listener for it
      ws.simulateMessage(
        JSON.stringify({ type: 'text', requestId: 'orphan', content: 'nobody listening' }),
      );
      // Should not throw
    });
  });
});

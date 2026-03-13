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
const mockRemoveNode = vi.fn().mockReturnValue({ ok: true, data: {} });
const mockRemoveEdge = vi.fn().mockReturnValue({ ok: true, data: {} });
const mockSave = vi.fn().mockResolvedValue(undefined);

vi.mock('@/store/graphStore', () => ({
  useGraphStore: {
    getState: () => ({
      addNode: mockAddNode,
      addEdge: mockAddEdge,
      removeNode: mockRemoveNode,
      removeEdge: mockRemoveEdge,
    }),
  },
}));

vi.mock('@/store/fileStore', () => ({
  useFileStore: {
    getState: () => ({
      fs: {},
      save: mockSave,
    }),
  },
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
  // abort
  // -----------------------------------------------------------------------

  describe('abort', () => {
    it('sends abort message over WebSocket', () => {
      const ws = connectProvider();
      provider.abort();
      expect(ws.sent.length).toBe(1);

      const msg = JSON.parse(ws.sent[0]);
      expect(msg.type).toBe('abort');
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
          args: { canvasId: '@root', node: { id: 'svc-1', type: 'compute/service' } },
          correlationId: 'corr-1',
        }),
      );

      // Wait for async handler to complete
      await vi.advanceTimersByTimeAsync(0);

      expect(mockAddNode).toHaveBeenCalledWith('@root', {
        id: 'svc-1',
        type: 'compute/service',
      });
      expect(mockSave).toHaveBeenCalled();

      // Check response sent back
      expect(ws.sent.length).toBe(1);
      const response = JSON.parse(ws.sent[0]);
      expect(response.type).toBe('store_action_result');
      expect(response.correlationId).toBe('corr-1');
      expect(response.result).toEqual({ ok: true, data: {} });
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
      expect(response.result.ok).toBe(false);
      expect(response.result.error.code).toBe('UNKNOWN_ACTION');
    });

    it('returns error when no filesystem is available', async () => {
      // Override fileStore mock to have no fs
      const { useFileStore } = await import('@/store/fileStore');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(useFileStore, 'getState').mockReturnValue({ fs: null, save: mockSave } as any);

      const ws = connectProvider();

      ws.simulateMessage(
        JSON.stringify({
          type: 'store_action',
          action: 'addNode',
          args: { canvasId: '@root', node: { id: 'x', type: 'compute/service' } },
          correlationId: 'corr-3',
        }),
      );

      await vi.advanceTimersByTimeAsync(0);

      expect(ws.sent.length).toBe(1);
      const response = JSON.parse(ws.sent[0]);
      expect(response.result.ok).toBe(false);
      expect(response.result.error.code).toBe('NO_FILESYSTEM');
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

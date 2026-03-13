import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '@/store/chatStore';
import type { ChatProvider, ChatEvent, ProjectContext, ChatMessage } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// Mock stores that chatStore reads from
// ---------------------------------------------------------------------------

vi.mock('@/store/fileStore', () => ({
  useFileStore: {
    getState: () => ({
      project: {
        root: {
          data: {
            project: { name: 'MockProject', description: 'A test project' },
          },
        },
      },
      fs: { fake: true },
    }),
  },
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: {
    getState: () => ({
      currentCanvasId: '@root',
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock ChatProvider factory
// ---------------------------------------------------------------------------

function createMockProvider(
  id: string,
  overrides: Partial<ChatProvider> = {},
): ChatProvider & {
  sentMessages: Array<{ content: string; context: ProjectContext }>;
  abortCalled: boolean;
  loadHistoryCalled: ChatMessage[] | null;
  emitEvents: (events: ChatEvent[]) => void;
  sendPermissionResponse: ReturnType<typeof vi.fn>;
} {
  const sentMessages: Array<{ content: string; context: ProjectContext }> = [];
  let abortCalled = false;
  let loadHistoryCalled: ChatMessage[] | null = null;
  let eventResolver: ((events: ChatEvent[]) => void) | null = null;
  let pendingEvents: ChatEvent[] | null = null;

  const provider = {
    id,
    displayName: `Mock ${id}`,
    available: true,
    sentMessages,
    abortCalled,
    loadHistoryCalled,
    sendPermissionResponse: vi.fn(),

    emitEvents(events: ChatEvent[]) {
      if (eventResolver) {
        eventResolver(events);
        eventResolver = null;
      } else {
        pendingEvents = events;
      }
    },

    sendMessage(content: string, context: ProjectContext): AsyncIterable<ChatEvent> {
      sentMessages.push({ content, context });

      async function* generator(): AsyncGenerator<ChatEvent> {
        const events: ChatEvent[] = await new Promise<ChatEvent[]>((resolve) => {
          if (pendingEvents) {
            resolve(pendingEvents);
            pendingEvents = null;
          } else {
            eventResolver = resolve;
          }
        });
        for (const event of events) {
          yield event;
        }
      }

      return generator();
    },

    loadHistory(messages: ChatMessage[]) {
      loadHistoryCalled = messages;
      provider.loadHistoryCalled = messages;
    },

    abort() {
      abortCalled = true;
      provider.abortCalled = true;
    },

    ...overrides,
  };

  return provider;
}

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  useChatStore.setState({
    messages: [],
    isStreaming: false,
    activeProviderId: null,
    providers: new Map(),
    error: null,
  });
});

// ===========================================================================
// Tests
// ===========================================================================

describe('chatStore', () => {
  // -----------------------------------------------------------------------
  // registerProvider
  // -----------------------------------------------------------------------

  describe('registerProvider', () => {
    it('adds a provider to the providers map', () => {
      const provider = createMockProvider('test-1');
      useChatStore.getState().registerProvider(provider);
      expect(useChatStore.getState().providers.has('test-1')).toBe(true);
    });

    it('auto-selects first registered provider', () => {
      const provider = createMockProvider('test-1');
      useChatStore.getState().registerProvider(provider);
      expect(useChatStore.getState().activeProviderId).toBe('test-1');
    });

    it('does not overwrite active provider on second registration', () => {
      const p1 = createMockProvider('test-1');
      const p2 = createMockProvider('test-2');
      useChatStore.getState().registerProvider(p1);
      useChatStore.getState().registerProvider(p2);
      expect(useChatStore.getState().activeProviderId).toBe('test-1');
      expect(useChatStore.getState().providers.size).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // setActiveProvider
  // -----------------------------------------------------------------------

  describe('setActiveProvider', () => {
    it('switches active provider', () => {
      const p1 = createMockProvider('p1');
      const p2 = createMockProvider('p2');
      useChatStore.getState().registerProvider(p1);
      useChatStore.getState().registerProvider(p2);

      useChatStore.getState().setActiveProvider('p2');
      expect(useChatStore.getState().activeProviderId).toBe('p2');
    });

    it('ignores unknown provider id', () => {
      const p1 = createMockProvider('p1');
      useChatStore.getState().registerProvider(p1);
      useChatStore.getState().setActiveProvider('nonexistent');
      expect(useChatStore.getState().activeProviderId).toBe('p1');
    });
  });

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------

  describe('sendMessage', () => {
    it('adds user message to messages array', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      // Pre-supply events so the generator completes
      provider.emitEvents([
        { type: 'text', requestId: 'r1', content: 'Reply' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('Hello AI');

      const msgs = useChatStore.getState().messages;
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('Hello AI');
      expect(msgs[0].timestamp).toBeGreaterThan(0);
    });

    it('builds assistant message incrementally from text events', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'text', requestId: 'r1', content: 'Hello ' },
        { type: 'text', requestId: 'r1', content: 'world' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('Hi');

      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(2);
      expect(msgs[1].role).toBe('assistant');
      expect(msgs[1].content).toBe('Hello world');
    });

    it('stores all events on the assistant message', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      const events: ChatEvent[] = [
        { type: 'thinking', requestId: 'r1', content: 'Let me think...' },
        { type: 'text', requestId: 'r1', content: 'Here is my answer' },
        { type: 'tool_call', requestId: 'r1', id: 'tc-1', name: 'Bash', args: { command: 'ls' } },
        { type: 'tool_result', requestId: 'r1', id: 'tc-1', result: 'file.txt' },
        { type: 'done', requestId: 'r1' },
      ];
      provider.emitEvents(events);

      await useChatStore.getState().sendMessage('Do something');

      const assistantMsg = useChatStore.getState().messages[1];
      expect(assistantMsg.events).toHaveLength(5);
      expect(assistantMsg.events!.map((e) => e.type)).toEqual([
        'thinking',
        'text',
        'tool_call',
        'tool_result',
        'done',
      ]);
    });

    it('sets isStreaming during iteration', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      // Don't emit events yet to keep the stream open
      const sendPromise = useChatStore.getState().sendMessage('Hello');

      // isStreaming should be true while awaiting
      expect(useChatStore.getState().isStreaming).toBe(true);

      // Complete the stream
      provider.emitEvents([{ type: 'done', requestId: 'r1' }]);
      await sendPromise;

      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('prevents concurrent sendMessage calls', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      // Start first message (will block on events)
      const firstPromise = useChatStore.getState().sendMessage('First');

      // Try to send a second message while first is streaming
      const secondSentBefore = provider.sentMessages.length;
      const secondPromise = useChatStore.getState().sendMessage('Second');
      await secondPromise; // Should resolve immediately (guarded)
      expect(provider.sentMessages.length).toBe(secondSentBefore); // Second was not sent to provider

      // Complete first
      provider.emitEvents([{ type: 'done', requestId: 'r1' }]);
      await firstPromise;

      // Only one user message + no assistant content for blocked call
      expect(provider.sentMessages).toHaveLength(1);
      expect(provider.sentMessages[0].content).toBe('First');
    });

    it('assembles ProjectContext from other stores', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([{ type: 'done', requestId: 'r1' }]);
      await useChatStore.getState().sendMessage('Test context');

      expect(provider.sentMessages).toHaveLength(1);
      const ctx = provider.sentMessages[0].context;
      expect(ctx.projectName).toBe('MockProject');
      expect(ctx.projectDescription).toBe('A test project');
      expect(ctx.currentScope).toBe('@root');
      expect(ctx.projectPath).toBe('.');
    });

    it('sets error on error event', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'text', requestId: 'r1', content: 'Partial response' },
        { type: 'error', requestId: 'r1', message: 'Connection lost' },
      ]);

      await useChatStore.getState().sendMessage('Hello');

      expect(useChatStore.getState().error).toBe('Connection lost');
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('sets error when no active provider', async () => {
      await useChatStore.getState().sendMessage('No provider');
      expect(useChatStore.getState().error).toBe('No active AI provider');
    });

    it('clears error on new sendMessage', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      // Set an error state first
      useChatStore.setState({ error: 'Previous error' });

      provider.emitEvents([{ type: 'done', requestId: 'r1' }]);
      await useChatStore.getState().sendMessage('New message');

      // Error cleared (unless a new one occurred)
      expect(useChatStore.getState().error).toBeNull();
    });

    it('handles provider throwing during iteration', async () => {
      const throwingProvider: ChatProvider = {
        id: 'thrower',
        displayName: 'Thrower',
        available: true,
        sendMessage(): AsyncIterable<ChatEvent> {
          // eslint-disable-next-line require-yield
          async function* gen(): AsyncGenerator<ChatEvent> {
            throw new Error('Stream exploded');
          }
          return gen();
        },
        loadHistory() {},
        abort() {},
      };

      useChatStore.getState().registerProvider(throwingProvider);
      await useChatStore.getState().sendMessage('Boom');

      expect(useChatStore.getState().error).toBe('Stream exploded');
      expect(useChatStore.getState().isStreaming).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // respondToPermission
  // -----------------------------------------------------------------------

  describe('respondToPermission', () => {
    it('delegates to provider sendPermissionResponse', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      useChatStore.getState().respondToPermission('perm-1', true);
      expect(provider.sendPermissionResponse).toHaveBeenCalledWith('perm-1', true);
    });

    it('passes denied response', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      useChatStore.getState().respondToPermission('perm-2', false);
      expect(provider.sendPermissionResponse).toHaveBeenCalledWith('perm-2', false);
    });

    it('no-ops when no active provider', () => {
      // Should not throw
      useChatStore.getState().respondToPermission('perm-1', true);
    });
  });

  // -----------------------------------------------------------------------
  // abort
  // -----------------------------------------------------------------------

  describe('abort', () => {
    it('calls provider.abort() and sets isStreaming to false', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);
      useChatStore.setState({ isStreaming: true });

      useChatStore.getState().abort();

      expect(provider.abortCalled).toBe(true);
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('resets isStreaming even when no active provider', () => {
      useChatStore.setState({ isStreaming: true });
      useChatStore.getState().abort();
      // isStreaming is always reset to prevent stuck state
      expect(useChatStore.getState().isStreaming).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // clearHistory
  // -----------------------------------------------------------------------

  describe('clearHistory', () => {
    it('clears messages and error', () => {
      useChatStore.setState({
        messages: [
          { role: 'user', content: 'Hello', timestamp: 1 },
          { role: 'assistant', content: 'Hi', timestamp: 2 },
        ],
        error: 'Some error',
      });

      useChatStore.getState().clearHistory();

      expect(useChatStore.getState().messages).toHaveLength(0);
      expect(useChatStore.getState().error).toBeNull();
    });
  });
});

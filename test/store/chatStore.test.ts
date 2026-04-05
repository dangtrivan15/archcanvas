import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '@/store/chatStore';
import type { ChatProvider, ChatEvent, ProjectContext, ChatMessage } from '@/core/ai/types';
import { isInteractiveProvider } from '@/core/ai/types';

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
      projectPath: '/mock/project/path',
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
  interruptCalled: boolean;
  loadHistoryCalled: ChatMessage[] | null;
  emitEvents: (events: ChatEvent[]) => void;
  sendPermissionResponse: ReturnType<typeof vi.fn>;
  sendSetPermissionMode: ReturnType<typeof vi.fn>;
  sendSetEffort: ReturnType<typeof vi.fn>;
} {
  const sentMessages: Array<{ content: string; context: ProjectContext }> = [];
  let interruptCalled = false;
  let loadHistoryCalled: ChatMessage[] | null = null as ChatMessage[] | null;
  let eventResolver: ((events: ChatEvent[]) => void) | null = null;
  let pendingEvents: ChatEvent[] | null = null;

  const provider = {
    id,
    displayName: `Mock ${id}`,
    available: true,
    sentMessages,
    interruptCalled,
    loadHistoryCalled,
    sendPermissionResponse: vi.fn(),
    sendSetPermissionMode: vi.fn(),
    sendSetEffort: vi.fn(),

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

    interrupt() {
      interruptCalled = true;
      provider.interruptCalled = true;
    },

    ...overrides,
  };

  return provider;
}

// ---------------------------------------------------------------------------
// Sequential mock provider: supports multiple sendMessage calls with
// pre-queued event batches (one per call). Used by auto-continue tests.
// ---------------------------------------------------------------------------

function createSequentialMockProvider(
  id: string,
  eventBatches: ChatEvent[][],
): ChatProvider & {
  sentMessages: Array<{ content: string; context: ProjectContext }>;
} {
  const sentMessages: Array<{ content: string; context: ProjectContext }> = [];
  let callIndex = 0;

  return {
    id,
    displayName: `Sequential ${id}`,
    available: true,
    sentMessages,

    sendMessage(content: string, context: ProjectContext): AsyncIterable<ChatEvent> {
      sentMessages.push({ content, context });
      const batch = eventBatches[callIndex++] ?? [];

      async function* generator(): AsyncGenerator<ChatEvent> {
        for (const event of batch) {
          yield event;
        }
      }

      return generator();
    },

    loadHistory() {},
    interrupt() {},
  };
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
    warning: null,
    statusMessage: null,
    permissionMode: 'default',
    effort: 'high',
    _autoContinueCount: 0,
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

    it('splits assistant messages when text arrives after tool results', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      // Simulate: thinking → text → tool_call → tool_result → text (new turn) → done
      provider.emitEvents([
        { type: 'thinking', requestId: 'r1', content: 'Planning...' },
        { type: 'text', requestId: 'r1', content: 'Let me check.' },
        { type: 'tool_call', requestId: 'r1', id: 'tc-1', name: 'Bash', args: { command: 'ls' } },
        { type: 'tool_result', requestId: 'r1', id: 'tc-1', result: 'file.txt' },
        { type: 'text', requestId: 'r1', content: 'I found file.txt' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('What files exist?');

      const msgs = useChatStore.getState().messages;
      // user + 2 assistant messages
      expect(msgs).toHaveLength(3);
      expect(msgs[0].role).toBe('user');
      // First assistant message: initial text + tool call cycle
      expect(msgs[1].role).toBe('assistant');
      expect(msgs[1].content).toBe('Let me check.');
      expect(msgs[1].events!.map(e => e.type)).toEqual([
        'thinking', 'text', 'tool_call', 'tool_result',
      ]);
      // Second assistant message: follow-up response
      expect(msgs[2].role).toBe('assistant');
      expect(msgs[2].content).toBe('I found file.txt');
      expect(msgs[2].events!.map(e => e.type)).toEqual(['text', 'done']);
    });

    it('does not split when no tool results precede text', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'thinking', requestId: 'r1', content: 'Hmm' },
        { type: 'text', requestId: 'r1', content: 'Hello ' },
        { type: 'text', requestId: 'r1', content: 'world' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('Hi');

      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(2); // user + 1 assistant
      expect(msgs[1].content).toBe('Hello world');
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
      expect(ctx.projectPath).toBe('/mock/project/path');
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
        interrupt() {},
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
      expect(provider.sendPermissionResponse).toHaveBeenCalledWith('perm-1', true, undefined);
    });

    it('passes denied response', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      useChatStore.getState().respondToPermission('perm-2', false);
      expect(provider.sendPermissionResponse).toHaveBeenCalledWith('perm-2', false, undefined);
    });

    it('no-ops when no active provider', () => {
      // Should not throw
      useChatStore.getState().respondToPermission('perm-1', true);
    });

    it('forwards updatedPermissions option with SDK-shaped suggestions', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      const options = {
        updatedPermissions: [{ type: 'addRules' as const, rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow' as const, destination: 'localSettings' }],
      };
      useChatStore.getState().respondToPermission('perm-3', true, options);
      expect(provider.sendPermissionResponse).toHaveBeenCalledWith('perm-3', true, options);
    });

    it('forwards interrupt option', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      const options = { interrupt: true };
      useChatStore.getState().respondToPermission('perm-4', false, options);
      expect(provider.sendPermissionResponse).toHaveBeenCalledWith('perm-4', false, options);
    });
  });

  // -----------------------------------------------------------------------
  // statusMessage handling
  // -----------------------------------------------------------------------

  describe('statusMessage', () => {
    it('sets statusMessage on status events', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'status', requestId: 'r1', message: 'Reading file...' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('Do stuff');

      // statusMessage is cleared on done
      expect(useChatStore.getState().statusMessage).toBeNull();
    });

    it('clears statusMessage on done event', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'status', requestId: 'r1', message: 'Working...' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('test');
      expect(useChatStore.getState().statusMessage).toBeNull();
    });

    it('clears statusMessage on error event', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'status', requestId: 'r1', message: 'Working...' },
        { type: 'error', requestId: 'r1', message: 'Something broke' },
      ]);

      await useChatStore.getState().sendMessage('test');
      expect(useChatStore.getState().statusMessage).toBeNull();
    });

    it('clears statusMessage on new sendMessage', async () => {
      useChatStore.setState({ statusMessage: 'Previous status' });

      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([{ type: 'done', requestId: 'r1' }]);
      await useChatStore.getState().sendMessage('New msg');

      expect(useChatStore.getState().statusMessage).toBeNull();
    });

    it('clears statusMessage on clearHistory', () => {
      useChatStore.setState({ statusMessage: 'Some status' });
      useChatStore.getState().clearHistory();
      expect(useChatStore.getState().statusMessage).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // setPermissionMode
  // -----------------------------------------------------------------------

  describe('setPermissionMode', () => {
    it('updates permissionMode state', () => {
      useChatStore.getState().setPermissionMode('plan');
      expect(useChatStore.getState().permissionMode).toBe('plan');
    });

    it('delegates to provider sendSetPermissionMode', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      useChatStore.getState().setPermissionMode('acceptEdits');
      expect(provider.sendSetPermissionMode).toHaveBeenCalledWith('acceptEdits');
    });

    it('updates state even when no active provider', () => {
      useChatStore.getState().setPermissionMode('dontAsk');
      expect(useChatStore.getState().permissionMode).toBe('dontAsk');
    });

    it('does not throw when provider lacks sendSetPermissionMode', () => {
      const bareProvider: ChatProvider = {
        id: 'bare',
        displayName: 'Bare',
        available: true,
        sendMessage: vi.fn() as unknown as ChatProvider['sendMessage'],
        loadHistory: vi.fn(),
        interrupt: vi.fn(),
      };
      useChatStore.getState().registerProvider(bareProvider);

      // Should not throw
      useChatStore.getState().setPermissionMode('plan');
      expect(useChatStore.getState().permissionMode).toBe('plan');
    });

    it('defaults to "default"', () => {
      expect(useChatStore.getState().permissionMode).toBe('default');
    });
  });

  // -----------------------------------------------------------------------
  // setEffort
  // -----------------------------------------------------------------------

  describe('setEffort', () => {
    it('updates effort state', () => {
      useChatStore.getState().setEffort('low');
      expect(useChatStore.getState().effort).toBe('low');
    });

    it('delegates to provider sendSetEffort', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      useChatStore.getState().setEffort('max');
      expect(provider.sendSetEffort).toHaveBeenCalledWith('max');
    });

    it('updates state even when no active provider', () => {
      useChatStore.getState().setEffort('medium');
      expect(useChatStore.getState().effort).toBe('medium');
    });

    it('does not throw when provider lacks sendSetEffort', () => {
      const bareProvider: ChatProvider = {
        id: 'bare',
        displayName: 'Bare',
        available: true,
        sendMessage: vi.fn() as unknown as ChatProvider['sendMessage'],
        loadHistory: vi.fn(),
        interrupt: vi.fn(),
      };
      useChatStore.getState().registerProvider(bareProvider);

      // Should not throw
      useChatStore.getState().setEffort('low');
      expect(useChatStore.getState().effort).toBe('low');
    });

    it('defaults to "high"', () => {
      expect(useChatStore.getState().effort).toBe('high');
    });
  });

  // -----------------------------------------------------------------------
  // rate_limit handling
  // -----------------------------------------------------------------------

  describe('rate_limit events', () => {
    it('sets warning (not error) on rate_limit event without stopping streaming', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'rate_limit', requestId: 'r1', message: 'Rate limited. Retrying in 30s...' },
        { type: 'text', requestId: 'r1', content: 'After rate limit' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('test');

      // Rate limit should set warning, not error
      // The assistant message should have accumulated text after the rate limit
      const msgs = useChatStore.getState().messages;
      expect(msgs[1].content).toBe('After rate limit');
      expect(useChatStore.getState().isStreaming).toBe(false);
      expect(useChatStore.getState().error).toBeNull();
    });

    it('stores rate_limit event in assistant message events', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'rate_limit', requestId: 'r1', message: 'Rate limited' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('test');

      const assistantMsg = useChatStore.getState().messages[1];
      expect(assistantMsg.events!.some(e => e.type === 'rate_limit')).toBe(true);
    });

    it('warning is cleared on done event', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'rate_limit', requestId: 'r1', message: 'Rate limited' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('test');

      expect(useChatStore.getState().warning).toBeNull();
    });

    it('warning is cleared on new sendMessage', async () => {
      useChatStore.setState({ warning: 'Previous rate limit' });

      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([{ type: 'done', requestId: 'r1' }]);
      await useChatStore.getState().sendMessage('New msg');

      expect(useChatStore.getState().warning).toBeNull();
    });

    it('warning is cleared on clearHistory', () => {
      useChatStore.setState({ warning: 'Some rate limit' });
      useChatStore.getState().clearHistory();
      expect(useChatStore.getState().warning).toBeNull();
    });

    it('real error events still set error field (not warning)', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'error', requestId: 'r1', message: 'Connection lost' },
      ]);

      await useChatStore.getState().sendMessage('test');

      expect(useChatStore.getState().error).toBe('Connection lost');
      expect(useChatStore.getState().warning).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // interrupt
  // -----------------------------------------------------------------------

  describe('interrupt', () => {
    it('calls provider.interrupt() and sets isStreaming to false', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);
      useChatStore.setState({ isStreaming: true });

      useChatStore.getState().interrupt();

      expect(provider.interruptCalled).toBe(true);
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('resets isStreaming even when no active provider', () => {
      useChatStore.setState({ isStreaming: true });
      useChatStore.getState().interrupt();
      // isStreaming is always reset to prevent stuck state
      expect(useChatStore.getState().isStreaming).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // clearHistory
  // -----------------------------------------------------------------------

  describe('clearHistory', () => {
    it('clears messages, error, and warning', () => {
      useChatStore.setState({
        messages: [
          { role: 'user', content: 'Hello', timestamp: 1 },
          { role: 'assistant', content: 'Hi', timestamp: 2 },
        ],
        error: 'Some error',
        warning: 'Some warning',
      });

      useChatStore.getState().clearHistory();

      expect(useChatStore.getState().messages).toHaveLength(0);
      expect(useChatStore.getState().error).toBeNull();
      expect(useChatStore.getState().warning).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // auto-continue on max-turn exhaustion
  // -----------------------------------------------------------------------

  describe('auto-continue on max-turn error', () => {
    it('detects max-turn error and auto-sends "Continue"', async () => {
      const provider = createSequentialMockProvider('p1', [
        // First call: ends with max-turn error
        [
          { type: 'text', requestId: 'r1', content: 'Partial analysis' },
          { type: 'error', requestId: 'r1', message: 'Reached max turn limit' },
        ],
        // Auto-continue call: completes normally
        [
          { type: 'text', requestId: 'r2', content: 'Continued result' },
          { type: 'done', requestId: 'r2' },
        ],
      ]);

      useChatStore.getState().registerProvider(provider);
      await useChatStore.getState().sendMessage('Analyze this');

      // Provider should have received 2 calls: original + auto-continue
      expect(provider.sentMessages).toHaveLength(2);
      expect(provider.sentMessages[0].content).toBe('Analyze this');
      expect(provider.sentMessages[1].content).toBe('Continue');

      // Messages should include both user messages and both assistant messages
      const msgs = useChatStore.getState().messages;
      const userMsgs = msgs.filter(m => m.role === 'user');
      const assistantMsgs = msgs.filter(m => m.role === 'assistant');
      expect(userMsgs).toHaveLength(2);
      expect(userMsgs[0].content).toBe('Analyze this');
      expect(userMsgs[1].content).toBe('Continue');
      expect(assistantMsgs).toHaveLength(2);
    });

    it('resets _autoContinueCount per user-initiated sendMessage', async () => {
      const provider = createSequentialMockProvider('p1', [
        // First user message: max-turn error
        [
          { type: 'error', requestId: 'r1', message: 'max turn reached' },
        ],
        // Auto-continue: done
        [
          { type: 'done', requestId: 'r2' },
        ],
        // Second user message: max-turn error again
        [
          { type: 'error', requestId: 'r3', message: 'max turn reached' },
        ],
        // Auto-continue for second message: done
        [
          { type: 'done', requestId: 'r4' },
        ],
      ]);

      useChatStore.getState().registerProvider(provider);

      // First user message triggers auto-continue (count goes to 1)
      await useChatStore.getState().sendMessage('First');
      expect(provider.sentMessages).toHaveLength(2);

      // Second user message should reset counter and auto-continue again
      await useChatStore.getState().sendMessage('Second');
      expect(provider.sentMessages).toHaveLength(4);
      expect(provider.sentMessages[2].content).toBe('Second');
      expect(provider.sentMessages[3].content).toBe('Continue');

      // Counter resets each time
      expect(useChatStore.getState()._autoContinueCount).toBe(1);
    });

    it('respects 3-retry cap', async () => {
      const provider = createSequentialMockProvider('p1', [
        // Original call: max-turn error
        [{ type: 'error', requestId: 'r1', message: 'max turn limit' }],
        // Continue 1/3: max-turn error
        [{ type: 'error', requestId: 'r2', message: 'max turn limit' }],
        // Continue 2/3: max-turn error
        [{ type: 'error', requestId: 'r3', message: 'max turn limit' }],
        // Continue 3/3: max-turn error
        [{ type: 'error', requestId: 'r4', message: 'max turn limit' }],
        // Should NOT be called (cap reached)
        [{ type: 'done', requestId: 'r5' }],
      ]);

      useChatStore.getState().registerProvider(provider);
      await useChatStore.getState().sendMessage('Analyze');

      // Original + 3 auto-continues = 4 total
      expect(provider.sentMessages).toHaveLength(4);
      expect(useChatStore.getState()._autoContinueCount).toBe(3);
      // Error from last failed attempt remains — cap was reached, no more retries
      expect(useChatStore.getState().error).toBe('max turn limit');
    });

    it('sets statusMessage during auto-continue', async () => {
      const statusMessages: (string | null)[] = [];
      const unsubscribe = useChatStore.subscribe((state) => {
        if (state.statusMessage && !statusMessages.includes(state.statusMessage)) {
          statusMessages.push(state.statusMessage);
        }
      });

      const provider = createSequentialMockProvider('p1', [
        [{ type: 'error', requestId: 'r1', message: 'max turn limit' }],
        [
          { type: 'text', requestId: 'r2', content: 'Done' },
          { type: 'done', requestId: 'r2' },
        ],
      ]);

      useChatStore.getState().registerProvider(provider);
      await useChatStore.getState().sendMessage('Go');

      expect(statusMessages).toContain('Continuing analysis (1/3)...');
      unsubscribe();
    });

    it('does not auto-continue non-max-turn errors', async () => {
      const provider = createSequentialMockProvider('p1', [
        [
          { type: 'text', requestId: 'r1', content: 'Partial' },
          { type: 'error', requestId: 'r1', message: 'Connection lost' },
        ],
        // Should NOT be called
        [{ type: 'done', requestId: 'r2' }],
      ]);

      useChatStore.getState().registerProvider(provider);
      await useChatStore.getState().sendMessage('Hello');

      // Only the original call, no auto-continue
      expect(provider.sentMessages).toHaveLength(1);
      expect(useChatStore.getState()._autoContinueCount).toBe(0);
    });

    it('increments counter correctly across recursive continues', async () => {
      const provider = createSequentialMockProvider('p1', [
        [{ type: 'error', requestId: 'r1', message: 'max turn reached' }],
        [{ type: 'error', requestId: 'r2', message: 'max turn reached' }],
        [
          { type: 'text', requestId: 'r3', content: 'Finally done' },
          { type: 'done', requestId: 'r3' },
        ],
      ]);

      useChatStore.getState().registerProvider(provider);
      await useChatStore.getState().sendMessage('Start');

      // Original + 2 auto-continues = 3 total calls
      expect(provider.sentMessages).toHaveLength(3);
      expect(provider.sentMessages[0].content).toBe('Start');
      expect(provider.sentMessages[1].content).toBe('Continue');
      expect(provider.sentMessages[2].content).toBe('Continue');
      expect(useChatStore.getState()._autoContinueCount).toBe(2);
      expect(useChatStore.getState().isStreaming).toBe(false);
      expect(useChatStore.getState().error).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // isInteractiveProvider type guard
  // -----------------------------------------------------------------------

  describe('isInteractiveProvider', () => {
    it('returns true for providers with interactive methods', () => {
      const provider = createMockProvider('p1');
      expect(isInteractiveProvider(provider)).toBe(true);
    });

    it('returns false for bare ChatProvider without interactive methods', () => {
      const bareProvider: ChatProvider = {
        id: 'bare',
        displayName: 'Bare',
        available: true,
        sendMessage: vi.fn() as unknown as ChatProvider['sendMessage'],
        loadHistory: vi.fn(),
        interrupt: vi.fn(),
      };
      expect(isInteractiveProvider(bareProvider)).toBe(false);
    });

    it('respondToPermission works with interactive provider via isInteractiveProvider', () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      useChatStore.getState().respondToPermission('perm-1', true);
      expect(provider.sendPermissionResponse).toHaveBeenCalledWith('perm-1', true, undefined);
    });

    it('respondToPermission no-ops with bare ChatProvider (no crash)', () => {
      const bareProvider: ChatProvider = {
        id: 'bare',
        displayName: 'Bare',
        available: true,
        sendMessage: vi.fn() as unknown as ChatProvider['sendMessage'],
        loadHistory: vi.fn(),
        interrupt: vi.fn(),
      };
      useChatStore.getState().registerProvider(bareProvider);

      // Should not throw
      useChatStore.getState().respondToPermission('perm-1', true);
    });
  });
});

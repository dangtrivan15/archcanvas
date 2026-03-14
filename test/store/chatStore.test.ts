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
  interruptCalled: boolean;
  loadHistoryCalled: ChatMessage[] | null;
  emitEvents: (events: ChatEvent[]) => void;
  sendPermissionResponse: ReturnType<typeof vi.fn>;
  sendSetPermissionMode: ReturnType<typeof vi.fn>;
  sendSetEffort: ReturnType<typeof vi.fn>;
} {
  const sentMessages: Array<{ content: string; context: ProjectContext }> = [];
  let interruptCalled = false;
  let loadHistoryCalled: ChatMessage[] | null = null;
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
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  useChatStore.setState({
    messages: [],
    isStreaming: false,
    activeProviderId: null,
    providers: new Map(),
    error: null,
    statusMessage: null,
    permissionMode: 'default',
    effort: 'high',
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
    it('sets error on rate_limit event without stopping streaming', async () => {
      const provider = createMockProvider('p1');
      useChatStore.getState().registerProvider(provider);

      provider.emitEvents([
        { type: 'rate_limit', requestId: 'r1', message: 'Rate limited. Retrying in 30s...' },
        { type: 'text', requestId: 'r1', content: 'After rate limit' },
        { type: 'done', requestId: 'r1' },
      ]);

      await useChatStore.getState().sendMessage('test');

      // Rate limit message was in error, but done cleared streaming
      // The assistant message should have accumulated text after the rate limit
      const msgs = useChatStore.getState().messages;
      expect(msgs[1].content).toBe('After rate limit');
      expect(useChatStore.getState().isStreaming).toBe(false);
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

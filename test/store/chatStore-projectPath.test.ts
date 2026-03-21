import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '@/store/chatStore';
import type { ChatProvider, ChatEvent, ProjectContext } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// Mock stores — projectPath is null (no longer blocks chat)
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
      projectPath: null, // No projectPath set
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

function createMockProvider(id: string): ChatProvider & {
  sentMessages: Array<{ content: string; context: ProjectContext }>;
  emitEvents: (events: ChatEvent[]) => void;
} {
  const sentMessages: Array<{ content: string; context: ProjectContext }> = [];
  let eventResolver: ((events: ChatEvent[]) => void) | null = null;
  let pendingEvents: ChatEvent[] | null = null;

  return {
    id,
    displayName: `Mock ${id}`,
    available: true,
    sentMessages,

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chatStore — projectPath no longer blocks chat', () => {
  it('allows sending messages when projectPath is null', async () => {
    const provider = createMockProvider('p1');
    useChatStore.getState().registerProvider(provider);

    // Pre-emit done event so streaming completes
    provider.emitEvents([
      { type: 'text', requestId: 'r', content: 'Hi!' },
      { type: 'done', requestId: 'r' },
    ]);

    await useChatStore.getState().sendMessage('Hello');

    // No error should be set
    expect(useChatStore.getState().error).toBeNull();
    // Message should have been sent to provider
    expect(provider.sentMessages).toHaveLength(1);
  });

  it('assembles context without projectPath', async () => {
    const provider = createMockProvider('p1');
    useChatStore.getState().registerProvider(provider);

    provider.emitEvents([
      { type: 'text', requestId: 'r', content: 'Hi!' },
      { type: 'done', requestId: 'r' },
    ]);

    await useChatStore.getState().sendMessage('Hello');

    // Context should NOT contain projectPath
    const sentContext = provider.sentMessages[0].context;
    expect(sentContext.projectPath).toBeUndefined();
    expect(sentContext.projectName).toBe('MockProject');
  });
});

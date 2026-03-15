import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '@/store/chatStore';
import type { ChatProvider, ChatEvent, ProjectContext } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// Mock stores — projectPath is null to test the guard
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

describe('chatStore — projectPath guard', () => {
  it('sets error when projectPath is null', async () => {
    const provider = createMockProvider('p1');
    useChatStore.getState().registerProvider(provider);

    await useChatStore.getState().sendMessage('Hello');

    expect(useChatStore.getState().error).toBe(
      'Project path is required for AI chat. Set it in project settings.',
    );
    // Message should NOT have been sent to provider
    expect(provider.sentMessages).toHaveLength(0);
  });

  it('does not add user message when projectPath is null', async () => {
    const provider = createMockProvider('p1');
    useChatStore.getState().registerProvider(provider);

    await useChatStore.getState().sendMessage('Hello');

    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it('does not set isStreaming when projectPath is null', async () => {
    const provider = createMockProvider('p1');
    useChatStore.getState().registerProvider(provider);

    await useChatStore.getState().sendMessage('Hello');

    expect(useChatStore.getState().isStreaming).toBe(false);
  });
});

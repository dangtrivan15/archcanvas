import { create } from 'zustand';
import type {
  ChatProvider,
  ChatMessage,
  ProjectContext,
} from '@/core/ai/types';
import { useFileStore } from './fileStore';
import { useNavigationStore } from './navigationStore';
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  activeProviderId: string | null;
  providers: Map<string, ChatProvider>;
  error: string | null;
  /** Latest status message from the AI (e.g., "Reading file..."). Cleared on done/error. */
  statusMessage: string | null;

  registerProvider(provider: ChatProvider): void;
  setActiveProvider(id: string): void;
  sendMessage(content: string): Promise<void>;
  respondToPermission(
    id: string,
    allowed: boolean,
    options?: {
      updatedPermissions?: Array<{ tool: string; permission: 'allow' }>;
      interrupt?: boolean;
    },
  ): void;
  /** Send user's answers to an AskUserQuestion card back to the bridge. */
  respondToQuestion(id: string, answers: Record<string, string>): void;
  abort(): void;
  clearHistory(): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assembleContext(): ProjectContext {
  const fileState = useFileStore.getState();
  const navState = useNavigationStore.getState();

  const projectName =
    fileState.project?.root.data.project?.name ?? 'Untitled';
  const projectDescription =
    fileState.project?.root.data.project?.description ?? undefined;
  const projectPath = fileState.fs ? '.' : '';
  const currentScope = navState.currentCanvasId;

  return {
    projectName,
    projectDescription,
    currentScope,
    projectPath,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  activeProviderId: null,
  providers: new Map(),
  error: null,
  statusMessage: null,

  registerProvider(provider: ChatProvider) {
    const next = new Map(get().providers);
    next.set(provider.id, provider);
    const updates: Partial<ChatState> = { providers: next };
    // Auto-select if no active provider
    if (!get().activeProviderId) {
      updates.activeProviderId = provider.id;
    }
    set(updates);
  },

  setActiveProvider(id: string) {
    if (get().providers.has(id)) {
      set({ activeProviderId: id });
    }
  },

  async sendMessage(content: string) {
    const { isStreaming, activeProviderId, providers } = get();

    // Guard: no concurrent streaming
    if (isStreaming) return;

    if (!activeProviderId) {
      set({ error: 'No active AI provider' });
      return;
    }

    const provider = providers.get(activeProviderId);
    if (!provider) {
      set({ error: `Provider "${activeProviderId}" not found` });
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isStreaming: true,
      error: null,
      statusMessage: null,
    }));

    // Build context from other stores
    const context = assembleContext();

    // Prepare assistant message (will be built incrementally)
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      events: [],
      timestamp: Date.now(),
    };

    try {
      const stream = provider.sendMessage(content, context);

      for await (const event of stream) {
        // Accumulate text content
        if (event.type === 'text') {
          assistantMessage.content += event.content;
        }

        // Track all events
        assistantMessage.events!.push(event);

        // Handle status events — show latest status message
        if (event.type === 'status') {
          set({ statusMessage: event.message });
        }

        // Handle rate_limit events — show as temporary warning without stopping the stream
        if (event.type === 'rate_limit') {
          set({ error: event.message });
        }

        // Handle error events
        if (event.type === 'error') {
          set({ error: event.message, statusMessage: null });
        }

        // Clear status on done
        if (event.type === 'done') {
          set({ statusMessage: null });
        }

        // Update messages with current assistant message state
        set((state) => {
          const msgs = [...state.messages];
          // Replace or append the assistant message at the end
          const lastIdx = msgs.length - 1;
          if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
            msgs[lastIdx] = { ...assistantMessage };
          } else {
            msgs.push({ ...assistantMessage });
          }
          return { messages: msgs };
        });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      set({ isStreaming: false, statusMessage: null });
    }
  },

  respondToPermission(
    id: string,
    allowed: boolean,
    options?: {
      updatedPermissions?: Array<{ tool: string; permission: 'allow' }>;
      interrupt?: boolean;
    },
  ) {
    const { activeProviderId, providers } = get();
    if (!activeProviderId) return;

    const provider = providers.get(activeProviderId);
    if (!provider) return;

    // Duck-type check: only WebSocket-backed providers expose sendPermissionResponse
    if ('sendPermissionResponse' in provider && typeof (provider as any).sendPermissionResponse === 'function') {
      (provider as any).sendPermissionResponse(id, allowed, options);
    }
  },

  respondToQuestion(id: string, answers: Record<string, string>) {
    const { activeProviderId, providers } = get();
    if (!activeProviderId) return;

    const provider = providers.get(activeProviderId);
    if (!provider) return;

    // Duck-type check: only WebSocket-backed providers expose sendQuestionResponse
    if ('sendQuestionResponse' in provider && typeof (provider as any).sendQuestionResponse === 'function') {
      (provider as any).sendQuestionResponse(id, answers);
    }
  },

  abort() {
    const { activeProviderId, providers } = get();
    set({ isStreaming: false }); // Always reset, even if no provider
    if (!activeProviderId) return;

    const provider = providers.get(activeProviderId);
    provider?.abort();
  },

  clearHistory() {
    set({ messages: [], error: null, statusMessage: null });
  },
}));

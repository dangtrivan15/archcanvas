import { create } from 'zustand';
import type {
  ChatProvider,
  ChatMessage,
  ProjectContext,
  PermissionSuggestion,
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
  /** Current permission mode for the AI session. */
  permissionMode: string;
  /** Current effort level for the AI session. */
  effort: string;

  registerProvider(provider: ChatProvider): void;
  setActiveProvider(id: string): void;
  sendMessage(content: string): Promise<void>;
  respondToPermission(
    id: string,
    allowed: boolean,
    options?: {
      updatedPermissions?: PermissionSuggestion[];
      interrupt?: boolean;
    },
  ): void;
  /** Send user's answers to an AskUserQuestion card back to the bridge. */
  respondToQuestion(id: string, answers: Record<string, string>): void;
  /** Change the permission mode and notify the active provider. */
  setPermissionMode(mode: string): void;
  /** Change the effort level and notify the active provider. */
  setEffort(effort: string): void;
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
  permissionMode: 'default',
  effort: 'high',

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

    // Index in messages[] where this stream's assistant messages begin
    const streamStartIdx = get().messages.length;
    // Completed assistant messages from this stream (split on tool cycles)
    const completedMessages: ChatMessage[] = [];
    // Current in-progress assistant message
    let currentMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      events: [],
      timestamp: Date.now(),
    };
    // Whether we've seen a tool_result since the last message split
    let hasCompletedToolCycle = false;

    try {
      const stream = provider.sendMessage(content, context);

      for await (const event of stream) {
        // Split into a new message when text/thinking arrives after tool results.
        // This makes conversations feel more natural: tool-use in one bubble,
        // the follow-up response in the next.
        if (
          (event.type === 'text' || event.type === 'thinking') &&
          hasCompletedToolCycle &&
          currentMsg.events!.length > 0
        ) {
          completedMessages.push({ ...currentMsg });
          currentMsg = {
            role: 'assistant',
            content: '',
            events: [],
            timestamp: Date.now(),
          };
          hasCompletedToolCycle = false;
        }

        // Accumulate text content
        if (event.type === 'text') {
          currentMsg.content += event.content;
        }

        // Track tool_result for message splitting
        if (event.type === 'tool_result') {
          hasCompletedToolCycle = true;
        }

        // Track all events
        currentMsg.events!.push(event);

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

        // Update messages: replace everything from streamStartIdx onwards
        set((state) => {
          const before = state.messages.slice(0, streamStartIdx);
          return {
            messages: [...before, ...completedMessages, { ...currentMsg }],
          };
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
      updatedPermissions?: PermissionSuggestion[];
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

  setPermissionMode(mode: string) {
    set({ permissionMode: mode });

    const { activeProviderId, providers } = get();
    if (!activeProviderId) return;

    const provider = providers.get(activeProviderId);
    if (!provider) return;

    // Duck-type check: only WebSocket-backed providers expose sendSetPermissionMode
    if ('sendSetPermissionMode' in provider && typeof (provider as any).sendSetPermissionMode === 'function') {
      (provider as any).sendSetPermissionMode(mode);
    }
  },

  setEffort(effort: string) {
    set({ effort });

    const { activeProviderId, providers } = get();
    if (!activeProviderId) return;

    const provider = providers.get(activeProviderId);
    if (!provider) return;

    // Duck-type check: only WebSocket-backed providers expose sendSetEffort
    if ('sendSetEffort' in provider && typeof (provider as any).sendSetEffort === 'function') {
      (provider as any).sendSetEffort(effort);
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

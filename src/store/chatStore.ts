import { create } from 'zustand';
import type {
  ChatProvider,
  ChatMessage,
  ProjectContext,
  PermissionSuggestion,
} from '@/core/ai/types';
import { isInteractiveProvider } from '@/core/ai/types';
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
  /** Transient warning (e.g., rate-limit). Shown as amber banner; cleared on done/new message. */
  warning: string | null;
  /** Latest status message from the AI (e.g., "Reading file..."). Cleared on done/error. */
  statusMessage: string | null;
  /** Current permission mode for the AI session. */
  permissionMode: string;
  /** Current effort level for the AI session. */
  effort: string;
  /** Internal auto-continue counter. Resets per user-initiated message. */
  _autoContinueCount: number;

  registerProvider(provider: ChatProvider): void;
  setActiveProvider(id: string): void;
  sendMessage(content: string): Promise<void>;
  /** Internal helper for message sending with auto-continue support. */
  _sendMessageInternal(content: string): Promise<void>;
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
  /** Interrupt the current turn. Stops streaming but preserves session context. */
  interrupt(): void;
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
  const projectPath = fileState.projectPath ?? '.';
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
  warning: null,
  statusMessage: null,
  permissionMode: 'default',
  effort: 'high',
  _autoContinueCount: 0,

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
    set({ _autoContinueCount: 0 });
    await get()._sendMessageInternal(content);
  },

  async _sendMessageInternal(content: string) {
    // Guard: project path required for AI CWD
    const projectPath = useFileStore.getState().projectPath;
    if (!projectPath) {
      set({ error: 'Project path is required for AI chat. Set it in project settings.' });
      return;
    }

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
      warning: null,
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
          set({ warning: event.message });
        }

        // Handle error events
        if (event.type === 'error') {
          set({ error: event.message, statusMessage: null });
        }

        // Clear status on done
        if (event.type === 'done') {
          set({ statusMessage: null, warning: null });
        }

        // Update messages: replace everything from streamStartIdx onwards
        set((state) => {
          const before = state.messages.slice(0, streamStartIdx);
          return {
            messages: [...before, ...completedMessages, { ...currentMsg }],
          };
        });
      }

      // Auto-continue on max-turns exhaustion (up to 3 times per user message)
      const lastEvent = currentMsg.events?.at(-1);
      const count = get()._autoContinueCount;
      if (
        lastEvent?.type === 'error' &&
        lastEvent.message.toLowerCase().includes('max turn') &&
        count < 3
      ) {
        set({ _autoContinueCount: count + 1, error: null });
        set({ statusMessage: `Continuing analysis (${count + 1}/3)...` });
        // Reset isStreaming so the recursive call can re-enter streaming mode
        set({ isStreaming: false });
        await get()._sendMessageInternal('Continue');
        return;
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      set({ isStreaming: false, statusMessage: null, warning: null });
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

    if (isInteractiveProvider(provider)) {
      provider.sendPermissionResponse(id, allowed, options);
    }
  },

  respondToQuestion(id: string, answers: Record<string, string>) {
    const { activeProviderId, providers } = get();
    if (!activeProviderId) return;

    const provider = providers.get(activeProviderId);
    if (!provider) return;

    if (isInteractiveProvider(provider)) {
      provider.sendQuestionResponse(id, answers);
    }
  },

  setPermissionMode(mode: string) {
    set({ permissionMode: mode });

    const { activeProviderId, providers } = get();
    if (!activeProviderId) return;

    const provider = providers.get(activeProviderId);
    if (!provider) return;

    if (isInteractiveProvider(provider)) {
      provider.sendSetPermissionMode(mode);
    }
  },

  setEffort(effort: string) {
    set({ effort });

    const { activeProviderId, providers } = get();
    if (!activeProviderId) return;

    const provider = providers.get(activeProviderId);
    if (!provider) return;

    if (isInteractiveProvider(provider)) {
      provider.sendSetEffort(effort);
    }
  },

  interrupt() {
    const { activeProviderId, providers } = get();
    set({ isStreaming: false }); // Always reset, even if no provider
    if (!activeProviderId) return;

    const provider = providers.get(activeProviderId);
    provider?.interrupt();
  },

  clearHistory() {
    set({ messages: [], error: null, warning: null, statusMessage: null });
  },
}));

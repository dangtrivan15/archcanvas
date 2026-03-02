/**
 * AI store - conversations, messages, and persistence.
 * Manages AI chat conversations that are persisted in .archc files.
 */

import { create } from 'zustand';
import { ulid } from 'ulid';
import type { AIConversation, AIMessage } from '@/types/ai';

export interface AIStoreState {
  /** All conversations (may be scoped to specific nodes or global) */
  conversations: AIConversation[];

  /** Add a message to the current global conversation (creates one if none exists) */
  addMessage: (role: 'user' | 'assistant', content: string) => AIMessage;

  /** Get or create the global (unscoped) conversation */
  getGlobalConversation: () => AIConversation;

  /** Get all messages from the global conversation */
  getMessages: () => AIMessage[];

  /** Set conversations from loaded file data */
  setConversations: (conversations: AIConversation[]) => void;

  /** Clear all conversations (e.g., on new file) */
  clearConversations: () => void;
}

export const useAIStore = create<AIStoreState>((set, get) => ({
  conversations: [],

  addMessage: (role, content) => {
    const msg: AIMessage = {
      id: ulid(),
      role,
      content,
      timestampMs: Date.now(),
      suggestions: [],
    };

    set((s) => {
      // Find or create global conversation (no scopedToNodeId)
      let globalConv = s.conversations.find((c) => !c.scopedToNodeId);
      if (!globalConv) {
        globalConv = {
          id: ulid(),
          messages: [],
          createdAtMs: Date.now(),
        };
        return {
          conversations: [
            ...s.conversations,
            { ...globalConv, messages: [msg] },
          ],
        };
      }

      return {
        conversations: s.conversations.map((c) =>
          c.id === globalConv!.id
            ? { ...c, messages: [...c.messages, msg] }
            : c,
        ),
      };
    });

    return msg;
  },

  getGlobalConversation: () => {
    const state = get();
    let conv = state.conversations.find((c) => !c.scopedToNodeId);
    if (!conv) {
      conv = {
        id: ulid(),
        messages: [],
        createdAtMs: Date.now(),
      };
    }
    return conv;
  },

  getMessages: () => {
    const state = get();
    const globalConv = state.conversations.find((c) => !c.scopedToNodeId);
    return globalConv?.messages ?? [];
  },

  setConversations: (conversations) => {
    set({ conversations });
  },

  clearConversations: () => {
    set({ conversations: [] });
  },
}));

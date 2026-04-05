import { create } from 'zustand';
import type { ClipboardPayload } from '@/core/graph/clipboard';

interface ClipboardStoreState {
  /** The current clipboard contents, or null if empty. */
  payload: ClipboardPayload | null;

  /** Replace the clipboard contents. */
  setPayload(payload: ClipboardPayload): void;

  /** Clear the clipboard. */
  clear(): void;
}

export const useClipboardStore = create<ClipboardStoreState>((set) => ({
  payload: null,

  setPayload(payload) {
    set({ payload });
  },

  clear() {
    set({ payload: null });
  },
}));

import { create } from 'zustand';
import type { RefObject } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';

interface UiState {
  rightPanelMode: 'details' | 'chat' | 'entities';
  setLeftPanelRef: (ref: RefObject<PanelImperativeHandle | null> | null) => void;
  setRightPanelRef: (ref: RefObject<PanelImperativeHandle | null> | null) => void;
  setRightPanelMode: (mode: 'details' | 'chat' | 'entities') => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  openRightPanel: () => void;
  toggleChat: () => void;
}

// Ref objects stored outside Zustand state — we store the RefObject (not
// .current) so that .current is read at call time, after the panel library
// has initialized the imperative handle.
let leftPanelRef: RefObject<PanelImperativeHandle | null> | null = null;
let rightPanelRef: RefObject<PanelImperativeHandle | null> | null = null;

export const useUiStore = create<UiState>((set, get) => ({
  rightPanelMode: 'details',

  setLeftPanelRef: (ref) => { leftPanelRef = ref; },
  setRightPanelRef: (ref) => { rightPanelRef = ref; },
  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),

  toggleLeftPanel: () => {
    const handle = leftPanelRef?.current;
    if (!handle) return;
    handle.isCollapsed() ? handle.expand() : handle.collapse();
  },

  toggleRightPanel: () => {
    const handle = rightPanelRef?.current;
    if (!handle) return;
    handle.isCollapsed() ? handle.expand() : handle.collapse();
  },

  openRightPanel: () => {
    rightPanelRef?.current?.expand();
  },

  toggleChat: () => {
    if (get().rightPanelMode === 'chat') {
      set({ rightPanelMode: 'details' });
    } else {
      // Opening chat — also expand panel if collapsed
      get().openRightPanel();
      set({ rightPanelMode: 'chat' });
      // Notify ChatPanel to auto-focus (setTimeout so React re-renders first)
      setTimeout(() => window.dispatchEvent(new CustomEvent('archcanvas:focus-chat')), 0);
    }
  },
}));

// For testing: allow resetting module-level refs
export function _resetPanelRefs() {
  leftPanelRef = null;
  rightPanelRef = null;
}

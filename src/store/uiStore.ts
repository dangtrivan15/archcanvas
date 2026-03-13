import { create } from 'zustand';
import type { PanelImperativeHandle } from 'react-resizable-panels';

interface UiState {
  rightPanelMode: 'details' | 'chat';
  setLeftPanelRef: (ref: PanelImperativeHandle | null) => void;
  setRightPanelRef: (ref: PanelImperativeHandle | null) => void;
  setRightPanelMode: (mode: 'details' | 'chat') => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  openRightPanel: () => void;
  toggleChat: () => void;
}

// Refs stored outside Zustand state — they're mutable handles, not
// serializable state. Zustand only exposes the methods that act on them.
let leftPanelRef: PanelImperativeHandle | null = null;
let rightPanelRef: PanelImperativeHandle | null = null;

export const useUiStore = create<UiState>((set, get) => ({
  rightPanelMode: 'details',

  setLeftPanelRef: (ref) => { leftPanelRef = ref; },
  setRightPanelRef: (ref) => { rightPanelRef = ref; },
  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),

  toggleLeftPanel: () => {
    if (!leftPanelRef) return;
    leftPanelRef.isCollapsed() ? leftPanelRef.expand() : leftPanelRef.collapse();
  },

  toggleRightPanel: () => {
    if (!rightPanelRef) return;
    rightPanelRef.isCollapsed() ? rightPanelRef.expand() : rightPanelRef.collapse();
  },

  openRightPanel: () => {
    rightPanelRef?.expand();
  },

  toggleChat: () => {
    if (get().rightPanelMode === 'chat') {
      set({ rightPanelMode: 'details' });
    } else {
      // Opening chat — also expand panel if collapsed
      get().openRightPanel();
      set({ rightPanelMode: 'chat' });
    }
  },
}));

// For testing: allow resetting module-level refs
export function _resetPanelRefs() {
  leftPanelRef = null;
  rightPanelRef = null;
}

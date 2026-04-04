import { create } from 'zustand';
import type { RefObject } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';

interface UiState {
  rightPanelMode: 'details' | 'chat' | 'entities';
  setLeftPanelRef: (ref: RefObject<PanelImperativeHandle | null> | null) => void;
  setRightPanelRef: (ref: RefObject<PanelImperativeHandle | null> | null) => void;
  rightPanelCollapsed: boolean;
  setRightPanelMode: (mode: 'details' | 'chat' | 'entities') => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  openRightPanel: () => void;
  toggleChat: () => void;
  detailPanelTab: 'properties' | 'notes' | 'codeRefs' | null;
  setDetailPanelTab: (tab: 'properties' | 'notes' | 'codeRefs' | null) => void;
  showAppearanceDialog: boolean;
  openAppearanceDialog: () => void;
  closeAppearanceDialog: () => void;
  showAiSettingsDialog: boolean;
  openAiSettingsDialog: () => void;
  closeAiSettingsDialog: () => void;
  showTemplatePickerDialog: boolean;
  openTemplatePickerDialog: () => void;
  closeTemplatePickerDialog: () => void;
}

// Ref objects stored outside Zustand state — we store the RefObject (not
// .current) so that .current is read at call time, after the panel library
// has initialized the imperative handle.
let leftPanelRef: RefObject<PanelImperativeHandle | null> | null = null;
let rightPanelRef: RefObject<PanelImperativeHandle | null> | null = null;

export const useUiStore = create<UiState>((set, get) => ({
  rightPanelMode: 'details',
  rightPanelCollapsed: false,

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
    const wasCollapsed = handle.isCollapsed();
    wasCollapsed ? handle.expand() : handle.collapse();
    set({ rightPanelCollapsed: !wasCollapsed });
  },

  openRightPanel: () => {
    rightPanelRef?.current?.expand();
    set({ rightPanelCollapsed: false });
  },

  detailPanelTab: null,
  setDetailPanelTab: (tab) => set({ detailPanelTab: tab }),

  showAppearanceDialog: false,
  openAppearanceDialog: () => set({ showAppearanceDialog: true }),
  closeAppearanceDialog: () => set({ showAppearanceDialog: false }),

  showAiSettingsDialog: false,
  openAiSettingsDialog: () => set({ showAiSettingsDialog: true }),
  closeAiSettingsDialog: () => set({ showAiSettingsDialog: false }),

  showTemplatePickerDialog: false,
  openTemplatePickerDialog: () => set({ showTemplatePickerDialog: true }),
  closeTemplatePickerDialog: () => set({ showTemplatePickerDialog: false }),

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

// Expose for E2E tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__archcanvas_uiStore__ = useUiStore;

// For testing: allow resetting module-level refs
export function _resetPanelRefs() {
  leftPanelRef = null;
  rightPanelRef = null;
}

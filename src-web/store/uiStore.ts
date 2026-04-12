import { create } from 'zustand';
import type { RefObject } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';

export type SidebarWidthPreset = 'narrow' | 'standard' | 'wide';

export const SIDEBAR_WIDTH_PRESETS: Record<SidebarWidthPreset, { defaultSize: string; minSize: string }> = {
  narrow:   { defaultSize: '18%', minSize: '160px' },
  standard: { defaultSize: '26%', minSize: '220px' },
  wide:     { defaultSize: '35%', minSize: '300px' },
};

const SIDEBAR_WIDTH_STORAGE_KEY = 'archcanvas:sidebar-width';
const SIDEBAR_WIDTH_OPTIONS: SidebarWidthPreset[] = ['narrow', 'standard', 'wide'];

function loadSidebarWidthPreset(): SidebarWidthPreset {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw && SIDEBAR_WIDTH_OPTIONS.includes(raw as SidebarWidthPreset)) {
      return raw as SidebarWidthPreset;
    }
  } catch {
    // localStorage unavailable — ignore
  }
  return 'standard';
}

function persistSidebarWidthPreset(preset: SidebarWidthPreset): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, preset);
  } catch {
    // localStorage full or unavailable — ignore
  }
}

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
  sidebarWidthPreset: SidebarWidthPreset;
  setSidebarWidthPreset: (preset: SidebarWidthPreset) => void;
  cycleSidebarWidth: (direction?: 'forward' | 'backward') => void;
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
  showExportDialog: boolean;
  openExportDialog: () => void;
  closeExportDialog: () => void;
  showColorLegend: boolean;
  toggleColorLegend: () => void;
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
    if (handle.isCollapsed()) handle.expand(); else handle.collapse();
  },

  toggleRightPanel: () => {
    const handle = rightPanelRef?.current;
    if (!handle) return;
    const wasCollapsed = handle.isCollapsed();
    if (wasCollapsed) handle.expand(); else handle.collapse();
    set({ rightPanelCollapsed: !wasCollapsed });
  },

  openRightPanel: () => {
    rightPanelRef?.current?.expand();
    set({ rightPanelCollapsed: false });
  },

  sidebarWidthPreset: loadSidebarWidthPreset(),

  setSidebarWidthPreset: (preset) => {
    set({ sidebarWidthPreset: preset });
    persistSidebarWidthPreset(preset);
    // Imperatively resize the right panel to the new preset size
    const handle = rightPanelRef?.current;
    if (handle) {
      if (handle.isCollapsed()) {
        handle.expand();
        set({ rightPanelCollapsed: false });
      }
      handle.resize(SIDEBAR_WIDTH_PRESETS[preset].defaultSize);
    }
  },

  cycleSidebarWidth: (direction = 'forward') => {
    const current = get().sidebarWidthPreset;
    const idx = SIDEBAR_WIDTH_OPTIONS.indexOf(current);
    const next = direction === 'forward'
      ? SIDEBAR_WIDTH_OPTIONS[(idx + 1) % SIDEBAR_WIDTH_OPTIONS.length]
      : SIDEBAR_WIDTH_OPTIONS[(idx - 1 + SIDEBAR_WIDTH_OPTIONS.length) % SIDEBAR_WIDTH_OPTIONS.length];
    get().setSidebarWidthPreset(next);
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

  showExportDialog: false,
  openExportDialog: () => set({ showExportDialog: true }),
  closeExportDialog: () => set({ showExportDialog: false }),

  showColorLegend: false,
  toggleColorLegend: () => set((s) => ({ showColorLegend: !s.showColorLegend })),

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

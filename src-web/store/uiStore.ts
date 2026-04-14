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

// --- Panel layout persistence ---

const PANEL_LAYOUT_STORAGE_KEY = 'archcanvas:panel-layout';

interface PanelLayoutState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  showStatusBar: boolean;
}

const PANEL_LAYOUT_DEFAULTS: PanelLayoutState = {
  leftCollapsed: false,
  rightCollapsed: false,
  showStatusBar: true,
};

function loadPanelLayout(): PanelLayoutState {
  try {
    const raw = localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        leftCollapsed: typeof parsed.leftCollapsed === 'boolean' ? parsed.leftCollapsed : PANEL_LAYOUT_DEFAULTS.leftCollapsed,
        rightCollapsed: typeof parsed.rightCollapsed === 'boolean' ? parsed.rightCollapsed : PANEL_LAYOUT_DEFAULTS.rightCollapsed,
        showStatusBar: typeof parsed.showStatusBar === 'boolean' ? parsed.showStatusBar : PANEL_LAYOUT_DEFAULTS.showStatusBar,
      };
    }
  } catch {
    // localStorage unavailable or corrupt — ignore
  }
  return { ...PANEL_LAYOUT_DEFAULTS };
}

export function persistPanelLayout(state: Partial<PanelLayoutState>): void {
  try {
    const existing = loadPanelLayout();
    localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify({ ...existing, ...state }));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

interface UiState {
  rightPanelMode: 'details' | 'chat' | 'entities';
  setLeftPanelRef: (ref: RefObject<PanelImperativeHandle | null> | null) => void;
  setRightPanelRef: (ref: RefObject<PanelImperativeHandle | null> | null) => void;
  rightPanelCollapsed: boolean;
  leftPanelCollapsed: boolean;
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
  showStatusBar: boolean;
  toggleStatusBar: () => void;
  focusMode: boolean;
  preFocusPanelState: { leftWasCollapsed: boolean; rightWasCollapsed: boolean } | null;
  toggleFocusMode: () => void;
  resizeRightPanelByPercent: (delta: number) => void;
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
  showRegistryStatusDialog: boolean;
  openRegistryStatusDialog: () => void;
  closeRegistryStatusDialog: () => void;
  showColorLegend: boolean;
  toggleColorLegend: () => void;
}

// Ref objects stored outside Zustand state — we store the RefObject (not
// .current) so that .current is read at call time, after the panel library
// has initialized the imperative handle.
let leftPanelRef: RefObject<PanelImperativeHandle | null> | null = null;
let rightPanelRef: RefObject<PanelImperativeHandle | null> | null = null;

const initialPanelLayout = loadPanelLayout();

export const useUiStore = create<UiState>((set, get) => ({
  rightPanelMode: 'details',
  rightPanelCollapsed: initialPanelLayout.rightCollapsed,
  leftPanelCollapsed: initialPanelLayout.leftCollapsed,

  setLeftPanelRef: (ref) => { leftPanelRef = ref; },
  setRightPanelRef: (ref) => { rightPanelRef = ref; },
  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),

  toggleLeftPanel: () => {
    const handle = leftPanelRef?.current;
    if (!handle) return;
    const wasCollapsed = handle.isCollapsed();
    if (wasCollapsed) handle.expand(); else handle.collapse();
    set({ leftPanelCollapsed: !wasCollapsed });
    persistPanelLayout({ leftCollapsed: !wasCollapsed });
  },

  toggleRightPanel: () => {
    const handle = rightPanelRef?.current;
    if (!handle) return;
    const wasCollapsed = handle.isCollapsed();
    if (wasCollapsed) handle.expand(); else handle.collapse();
    set({ rightPanelCollapsed: !wasCollapsed });
    persistPanelLayout({ rightCollapsed: !wasCollapsed });
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

  // --- Status bar visibility ---
  showStatusBar: initialPanelLayout.showStatusBar,

  toggleStatusBar: () => {
    const next = !get().showStatusBar;
    set({ showStatusBar: next });
    persistPanelLayout({ showStatusBar: next });
  },

  // --- Focus mode ---
  focusMode: false,
  preFocusPanelState: null,

  toggleFocusMode: () => {
    const { focusMode } = get();
    if (focusMode) {
      // Exiting focus mode — restore previous state
      const snapshot = get().preFocusPanelState;
      if (snapshot) {
        const leftHandle = leftPanelRef?.current;
        const rightHandle = rightPanelRef?.current;
        if (leftHandle) {
          if (snapshot.leftWasCollapsed) leftHandle.collapse(); else leftHandle.expand();
        }
        if (rightHandle) {
          if (snapshot.rightWasCollapsed) rightHandle.collapse(); else rightHandle.expand();
        }
        set({
          focusMode: false,
          preFocusPanelState: null,
          leftPanelCollapsed: snapshot.leftWasCollapsed,
          rightPanelCollapsed: snapshot.rightWasCollapsed,
        });
      } else {
        set({ focusMode: false, preFocusPanelState: null });
      }
    } else {
      // Entering focus mode — snapshot and collapse all
      const leftHandle = leftPanelRef?.current;
      const rightHandle = rightPanelRef?.current;
      const leftWasCollapsed = leftHandle?.isCollapsed() ?? false;
      const rightWasCollapsed = rightHandle?.isCollapsed() ?? false;
      set({
        focusMode: true,
        preFocusPanelState: { leftWasCollapsed, rightWasCollapsed },
      });
      if (leftHandle && !leftWasCollapsed) leftHandle.collapse();
      if (rightHandle && !rightWasCollapsed) rightHandle.collapse();
      set({ leftPanelCollapsed: true, rightPanelCollapsed: true });
    }
  },

  // --- Fine-grained panel resize ---
  resizeRightPanelByPercent: (delta: number) => {
    const handle = rightPanelRef?.current;
    if (!handle) return;
    if (handle.isCollapsed()) {
      handle.expand();
      set({ rightPanelCollapsed: false });
    }
    const currentSize = handle.getSize();
    const currentPct = currentSize.asPercentage;
    const newPct = Math.max(5, Math.min(40, currentPct + delta));
    handle.resize(`${newPct}%`);
  },

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

  showRegistryStatusDialog: false,
  openRegistryStatusDialog: () => set({ showRegistryStatusDialog: true }),
  closeRegistryStatusDialog: () => set({ showRegistryStatusDialog: false }),

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

// For testing: allow clearing panel layout persistence
export function _resetPanelLayout() {
  try { localStorage.removeItem(PANEL_LAYOUT_STORAGE_KEY); } catch { /* ignore */ }
}

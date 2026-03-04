/**
 * UI store - panel visibility, modals, toasts.
 */

import { create } from 'zustand';
import type { RightPanelTab } from '@/utils/constants';
import { preferences } from '@/core/platform/preferencesAdapter';

/** localStorage / Capacitor Preferences keys for persisted heights */
export const TOOLBAR_HEIGHT_STORAGE_KEY = 'toolbar-height';
export const STATUS_BAR_HEIGHT_STORAGE_KEY = 'status-bar-height';

/**
 * Synchronously read a persisted height from localStorage.
 * Returns null if not found or not a valid number.
 * Used at store initialization time (synchronous context).
 */
function readPersistedHeight(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`archcanvas:${key}`);
    if (raw === null) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

/**
 * Persist a height value via the cross-platform preferences adapter.
 * Works on both web (localStorage) and native (Capacitor Preferences).
 */
function persistHeight(key: string, value: number): void {
  preferences.set(key, String(value)).catch(() => {
    // Silently ignore write failures (e.g. storage full)
  });
}

/**
 * Remove a persisted height value via the cross-platform preferences adapter.
 */
function clearPersistedHeight(key: string): void {
  preferences.remove(key).catch(() => {
    // Silently ignore removal failures
  });
}

/**
 * Load persisted heights from async storage (Capacitor Preferences) and
 * update the store. Call this on app startup for native platforms.
 * On web, values are already loaded synchronously at init time.
 */
export async function loadPersistedHeights(): Promise<void> {
  const [toolbarRaw, statusBarRaw] = await Promise.all([
    preferences.get(TOOLBAR_HEIGHT_STORAGE_KEY),
    preferences.get(STATUS_BAR_HEIGHT_STORAGE_KEY),
  ]);

  const store = useUIStore.getState();
  if (toolbarRaw !== null) {
    const num = Number(toolbarRaw);
    if (Number.isFinite(num)) {
      store.setToolbarHeight(num);
    }
  }
  if (statusBarRaw !== null) {
    const num = Number(statusBarRaw);
    if (Number.isFinite(num)) {
      store.setStatusBarHeight(num);
    }
  }
}

export interface DeleteDialogInfo {
  nodeId: string;
  nodeName: string;
  edgeCount: number;
  childCount: number;
}

export interface ConnectionDialogInfo {
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface PlacementModeInfo {
  nodeType: string;        // e.g. 'compute/service'
  displayName: string;     // e.g. 'Service'
}

export interface UnsavedChangesDialogInfo {
  /** The action to execute if the user confirms discarding changes */
  onConfirm: () => void;
}

export interface ErrorDialogInfo {
  /** Short title describing the error */
  title: string;
  /** Detailed error message for the user */
  message: string;
}

export interface IntegrityWarningDialogInfo {
  /** Warning message about the integrity issue */
  message: string;
  /** Callback when user chooses to open the file anyway */
  onProceed: () => void;
}

/** Default and min/max panel widths in pixels */
export const LEFT_PANEL_MIN_WIDTH = 180;
export const LEFT_PANEL_MAX_WIDTH = 400;

/** Viewport-relative left panel default: 15% of viewport width, floor 180px, ceiling 360px */
export const LEFT_PANEL_VIEWPORT_RATIO = 0.15;
export const LEFT_PANEL_DEFAULT_FLOOR = 180;
export const LEFT_PANEL_DEFAULT_CEILING = 360;

/**
 * Compute the default left panel width based on viewport width.
 * Returns 15% of viewportWidth, clamped between floor (180px) and ceiling (360px).
 */
export function computeDefaultLeftPanelWidth(viewportWidth?: number): number {
  const vw = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1440);
  const raw = Math.round(vw * LEFT_PANEL_VIEWPORT_RATIO);
  return Math.max(LEFT_PANEL_DEFAULT_FLOOR, Math.min(LEFT_PANEL_DEFAULT_CEILING, raw));
}

/** Legacy constant kept for backward compatibility */
export const LEFT_PANEL_DEFAULT_WIDTH = 240;
/** Drag below this threshold to snap-collapse the left panel */
export const LEFT_PANEL_COLLAPSE_THRESHOLD = 120;
/** Viewport-relative right panel default: 20% of viewport width, floor 260px, ceiling 480px */
export const RIGHT_PANEL_VIEWPORT_RATIO = 0.20;
export const RIGHT_PANEL_DEFAULT_FLOOR = 260;
export const RIGHT_PANEL_DEFAULT_CEILING = 480;

/**
 * Compute the default right panel width based on viewport width.
 * Returns 20% of viewportWidth, clamped between floor (260px) and ceiling (480px).
 */
export function computeDefaultRightPanelWidth(viewportWidth?: number): number {
  const vw = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1440);
  const raw = Math.round(vw * RIGHT_PANEL_VIEWPORT_RATIO);
  return Math.max(RIGHT_PANEL_DEFAULT_FLOOR, Math.min(RIGHT_PANEL_DEFAULT_CEILING, raw));
}

/** Legacy constant kept for backward compatibility */
export const RIGHT_PANEL_DEFAULT_WIDTH = 320;
export const RIGHT_PANEL_MIN_WIDTH = 220;
export const RIGHT_PANEL_MAX_WIDTH = 500;

/** Min/max toolbar height in pixels */
export const TOOLBAR_MIN_HEIGHT = 36;
export const TOOLBAR_MAX_HEIGHT = 80;

/** Viewport-relative toolbar default: 3.5% of viewport height, floor 40px, ceiling 64px */
export const TOOLBAR_VIEWPORT_RATIO = 0.035;
export const TOOLBAR_DEFAULT_FLOOR = 40;
export const TOOLBAR_DEFAULT_CEILING = 64;

/**
 * Compute the default toolbar height based on viewport height.
 * Returns 3.5% of viewportHeight, clamped between floor (40px) and ceiling (64px).
 */
export function computeDefaultToolbarHeight(viewportHeight?: number): number {
  const vh = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 900);
  const raw = Math.round(vh * TOOLBAR_VIEWPORT_RATIO);
  return Math.max(TOOLBAR_DEFAULT_FLOOR, Math.min(TOOLBAR_DEFAULT_CEILING, raw));
}

/** Legacy constant kept for backward compatibility */
export const TOOLBAR_DEFAULT_HEIGHT = 48;

/** Default and min/max status bar height in pixels */
export const STATUS_BAR_DEFAULT_HEIGHT = 24;
export const STATUS_BAR_MIN_HEIGHT = 20;
export const STATUS_BAR_MAX_HEIGHT = 48;

/** Viewport-relative status bar default: 2% of viewport height, floor 20px, ceiling 40px */
export const STATUS_BAR_VIEWPORT_RATIO = 0.02;
export const STATUS_BAR_DEFAULT_FLOOR = 20;
export const STATUS_BAR_DEFAULT_CEILING = 40;

/**
 * Compute the default status bar height based on viewport height.
 * Returns 2% of viewportHeight, clamped between floor (20px) and ceiling (40px).
 */
export function computeDefaultStatusBarHeight(viewportHeight?: number): number {
  const vh = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 900);
  const raw = Math.round(vh * STATUS_BAR_VIEWPORT_RATIO);
  return Math.max(STATUS_BAR_DEFAULT_FLOOR, Math.min(STATUS_BAR_DEFAULT_CEILING, raw));
}

export interface UIStoreState {
  // Panel visibility
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;

  // Panel widths (in pixels, for drag-resize)
  leftPanelWidth: number;
  /** Whether the user has explicitly set a custom left panel width */
  leftPanelWidthCustomized: boolean;
  rightPanelWidth: number;
  /** Whether the user has explicitly set a custom right panel width */
  rightPanelWidthCustomized: boolean;

  // Toolbar and status bar heights (in pixels, clamped to min/max)
  toolbarHeight: number;
  /** Whether the user has explicitly set a custom toolbar height */
  toolbarHeightCustomized: boolean;
  statusBarHeight: number;
  /** Whether the user has explicitly set a custom status bar height */
  statusBarHeightCustomized: boolean;

  // Delete confirmation dialog
  deleteDialogOpen: boolean;
  deleteDialogInfo: DeleteDialogInfo | null;

  // Connection type dialog
  connectionDialogOpen: boolean;
  connectionDialogInfo: ConnectionDialogInfo | null;

  // Unsaved changes dialog
  unsavedChangesDialogOpen: boolean;
  unsavedChangesDialogInfo: UnsavedChangesDialogInfo | null;

  // Error dialog
  errorDialogOpen: boolean;
  errorDialogInfo: ErrorDialogInfo | null;

  // Integrity warning dialog (checksum mismatch - user can proceed or cancel)
  integrityWarningDialogOpen: boolean;
  integrityWarningDialogInfo: IntegrityWarningDialogInfo | null;

  // Placement mode (click-to-place node on canvas)
  placementMode: boolean;
  placementInfo: PlacementModeInfo | null;

  // Keyboard shortcuts help dialog
  shortcutsHelpOpen: boolean;

  // Command palette
  commandPaletteOpen: boolean;

  // Quick search overlay
  quickSearchOpen: boolean;

  // Shortcut settings dialog
  shortcutSettingsOpen: boolean;

  // Settings dialog (API key, preferences)
  settingsDialogOpen: boolean;

  // File operation loading indicator
  fileOperationLoading: boolean;
  fileOperationMessage: string | null;

  // Pending rename (auto-focus display name input for newly created node)
  pendingRenameNodeId: string | null;

  // Inline editing on canvas node (F2 quick-edit without opening right panel)
  inlineEditNodeId: string | null;

  // Autosave on focus change
  autosaveOnBlur: boolean;
  autosaveStatusMessage: string | null;

  // Toast notifications
  toastMessage: string | null;
  toastTimerId: ReturnType<typeof setTimeout> | null;

  // Actions
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  openRightPanel: (tab?: RightPanelTab) => void;
  closeRightPanel: () => void;

  // Delete dialog actions
  openDeleteDialog: (info: DeleteDialogInfo) => void;
  closeDeleteDialog: () => void;

  // Connection dialog actions
  openConnectionDialog: (info: ConnectionDialogInfo) => void;
  closeConnectionDialog: () => void;

  // Unsaved changes dialog actions
  openUnsavedChangesDialog: (info: UnsavedChangesDialogInfo) => void;
  closeUnsavedChangesDialog: () => void;

  // Error dialog actions
  openErrorDialog: (info: ErrorDialogInfo) => void;
  closeErrorDialog: () => void;

  // Integrity warning dialog actions
  openIntegrityWarningDialog: (info: IntegrityWarningDialogInfo) => void;
  closeIntegrityWarningDialog: () => void;

  // Placement mode actions
  enterPlacementMode: (info: PlacementModeInfo) => void;
  exitPlacementMode: () => void;

  // Panel width actions (for drag-resize)
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  /** Update left panel width from viewport resize (only if not customized) */
  updateLeftPanelWidthFromViewport: (viewportWidth: number) => void;
  /** Update right panel width from viewport resize (only if not customized) */
  updateRightPanelWidthFromViewport: (viewportWidth: number) => void;
  /** Reset all bar/panel sizes to viewport-relative defaults (clears custom values) */
  resetBarSizes: () => void;

  // Toolbar and status bar height actions
  setToolbarHeight: (height: number) => void;
  /** Update toolbar height from viewport resize (only if not customized) */
  updateToolbarHeightFromViewport: (viewportHeight: number) => void;
  setStatusBarHeight: (height: number) => void;
  /** Update status bar height from viewport resize (only if not customized) */
  updateStatusBarHeightFromViewport: (viewportHeight: number) => void;

  // Keyboard shortcuts help dialog actions
  openShortcutsHelp: () => void;
  closeShortcutsHelp: () => void;
  toggleShortcutsHelp: () => void;

  // Command palette actions
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

  // Quick search actions
  openQuickSearch: () => void;
  closeQuickSearch: () => void;
  toggleQuickSearch: () => void;

  // Shortcut settings actions
  openShortcutSettings: () => void;
  closeShortcutSettings: () => void;

  // Settings dialog actions
  openSettingsDialog: () => void;
  closeSettingsDialog: () => void;

  // File operation loading actions
  setFileOperationLoading: (message: string) => void;
  clearFileOperationLoading: () => void;

  // Rename mode actions
  setPendingRenameNodeId: (nodeId: string | null) => void;
  clearPendingRename: () => void;

  // Inline edit actions
  setInlineEditNodeId: (nodeId: string | null) => void;
  clearInlineEdit: () => void;

  // Autosave actions
  setAutosaveOnBlur: (enabled: boolean) => void;
  setAutosaveStatusMessage: (message: string | null) => void;

  // Toast actions
  showToast: (message: string, durationMs?: number) => void;
  clearToast: () => void;

}

export const useUIStore = create<UIStoreState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: false,
  rightPanelTab: 'properties',
  leftPanelWidth: computeDefaultLeftPanelWidth(),
  leftPanelWidthCustomized: false,
  rightPanelWidth: computeDefaultRightPanelWidth(),
  rightPanelWidthCustomized: false,
  toolbarHeight: readPersistedHeight(TOOLBAR_HEIGHT_STORAGE_KEY) ?? computeDefaultToolbarHeight(),
  toolbarHeightCustomized: readPersistedHeight(TOOLBAR_HEIGHT_STORAGE_KEY) !== null,
  statusBarHeight: readPersistedHeight(STATUS_BAR_HEIGHT_STORAGE_KEY) ?? computeDefaultStatusBarHeight(),
  statusBarHeightCustomized: readPersistedHeight(STATUS_BAR_HEIGHT_STORAGE_KEY) !== null,

  deleteDialogOpen: false,
  deleteDialogInfo: null,

  connectionDialogOpen: false,
  connectionDialogInfo: null,

  unsavedChangesDialogOpen: false,
  unsavedChangesDialogInfo: null,

  errorDialogOpen: false,
  errorDialogInfo: null,

  integrityWarningDialogOpen: false,
  integrityWarningDialogInfo: null,

  placementMode: false,
  placementInfo: null,

  shortcutsHelpOpen: false,

  commandPaletteOpen: false,

  quickSearchOpen: false,

  shortcutSettingsOpen: false,

  settingsDialogOpen: false,

  fileOperationLoading: false,
  fileOperationMessage: null,

  pendingRenameNodeId: null,

  inlineEditNodeId: null,

  autosaveOnBlur: true,
  autosaveStatusMessage: null,

  toastMessage: null,
  toastTimerId: null,

  toggleLeftPanel: () =>
    set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),

  toggleRightPanel: () =>
    set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),

  setRightPanelTab: (tab) =>
    set({ rightPanelTab: tab }),

  openRightPanel: (tab) =>
    set({ rightPanelOpen: true, ...(tab ? { rightPanelTab: tab } : {}) }),

  closeRightPanel: () =>
    set({ rightPanelOpen: false }),

  openDeleteDialog: (info) =>
    set({ deleteDialogOpen: true, deleteDialogInfo: info }),

  closeDeleteDialog: () =>
    set({ deleteDialogOpen: false, deleteDialogInfo: null }),

  openConnectionDialog: (info) =>
    set({ connectionDialogOpen: true, connectionDialogInfo: info }),

  closeConnectionDialog: () =>
    set({ connectionDialogOpen: false, connectionDialogInfo: null }),

  openUnsavedChangesDialog: (info) =>
    set({ unsavedChangesDialogOpen: true, unsavedChangesDialogInfo: info }),

  closeUnsavedChangesDialog: () =>
    set({ unsavedChangesDialogOpen: false, unsavedChangesDialogInfo: null }),

  openErrorDialog: (info) =>
    set({ errorDialogOpen: true, errorDialogInfo: info }),

  closeErrorDialog: () =>
    set({ errorDialogOpen: false, errorDialogInfo: null }),

  openIntegrityWarningDialog: (info) =>
    set({ integrityWarningDialogOpen: true, integrityWarningDialogInfo: info }),

  closeIntegrityWarningDialog: () =>
    set({ integrityWarningDialogOpen: false, integrityWarningDialogInfo: null }),

  enterPlacementMode: (info) =>
    set({ placementMode: true, placementInfo: info }),

  exitPlacementMode: () =>
    set({ placementMode: false, placementInfo: null }),

  setLeftPanelWidth: (width) =>
    set({ leftPanelWidth: Math.max(LEFT_PANEL_MIN_WIDTH, Math.min(LEFT_PANEL_MAX_WIDTH, width)), leftPanelWidthCustomized: true }),

  setRightPanelWidth: (width) =>
    set({ rightPanelWidth: Math.max(RIGHT_PANEL_MIN_WIDTH, Math.min(RIGHT_PANEL_MAX_WIDTH, width)), rightPanelWidthCustomized: true }),

  updateLeftPanelWidthFromViewport: (viewportWidth) =>
    set((s) => {
      if (s.leftPanelWidthCustomized) return s;
      return { leftPanelWidth: computeDefaultLeftPanelWidth(viewportWidth) };
    }),

  updateRightPanelWidthFromViewport: (viewportWidth) =>
    set((s) => {
      if (s.rightPanelWidthCustomized) return s;
      return { rightPanelWidth: computeDefaultRightPanelWidth(viewportWidth) };
    }),

  resetBarSizes: () => {
    clearPersistedHeight(TOOLBAR_HEIGHT_STORAGE_KEY);
    clearPersistedHeight(STATUS_BAR_HEIGHT_STORAGE_KEY);
    set({
      leftPanelWidth: computeDefaultLeftPanelWidth(),
      leftPanelWidthCustomized: false,
      rightPanelWidth: computeDefaultRightPanelWidth(),
      rightPanelWidthCustomized: false,
      toolbarHeight: computeDefaultToolbarHeight(),
      toolbarHeightCustomized: false,
      statusBarHeight: computeDefaultStatusBarHeight(),
      statusBarHeightCustomized: false,
    });
  },

  setToolbarHeight: (height) => {
    const clamped = Math.max(TOOLBAR_MIN_HEIGHT, Math.min(TOOLBAR_MAX_HEIGHT, height));
    persistHeight(TOOLBAR_HEIGHT_STORAGE_KEY, clamped);
    set({ toolbarHeight: clamped, toolbarHeightCustomized: true });
  },

  updateToolbarHeightFromViewport: (viewportHeight) =>
    set((s) => {
      if (s.toolbarHeightCustomized) return s;
      return { toolbarHeight: computeDefaultToolbarHeight(viewportHeight) };
    }),

  setStatusBarHeight: (height) => {
    const clamped = Math.max(STATUS_BAR_MIN_HEIGHT, Math.min(STATUS_BAR_MAX_HEIGHT, height));
    persistHeight(STATUS_BAR_HEIGHT_STORAGE_KEY, clamped);
    set({ statusBarHeight: clamped, statusBarHeightCustomized: true });
  },

  updateStatusBarHeightFromViewport: (viewportHeight) =>
    set((s) => {
      if (s.statusBarHeightCustomized) return s;
      return { statusBarHeight: computeDefaultStatusBarHeight(viewportHeight) };
    }),

  openShortcutsHelp: () =>
    set({ shortcutsHelpOpen: true }),

  closeShortcutsHelp: () =>
    set({ shortcutsHelpOpen: false }),

  toggleShortcutsHelp: () =>
    set((s) => ({ shortcutsHelpOpen: !s.shortcutsHelpOpen })),

  openCommandPalette: () =>
    set({ commandPaletteOpen: true }),

  closeCommandPalette: () =>
    set({ commandPaletteOpen: false }),

  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

  openQuickSearch: () =>
    set({ quickSearchOpen: true }),

  closeQuickSearch: () =>
    set({ quickSearchOpen: false }),

  toggleQuickSearch: () =>
    set((s) => ({ quickSearchOpen: !s.quickSearchOpen })),

  openShortcutSettings: () =>
    set({ shortcutSettingsOpen: true }),

  closeShortcutSettings: () =>
    set({ shortcutSettingsOpen: false }),

  openSettingsDialog: () =>
    set({ settingsDialogOpen: true }),

  closeSettingsDialog: () =>
    set({ settingsDialogOpen: false }),

  setFileOperationLoading: (message) =>
    set({ fileOperationLoading: true, fileOperationMessage: message }),

  clearFileOperationLoading: () =>
    set({ fileOperationLoading: false, fileOperationMessage: null }),

  setPendingRenameNodeId: (nodeId) =>
    set({ pendingRenameNodeId: nodeId }),

  clearPendingRename: () =>
    set({ pendingRenameNodeId: null }),

  setInlineEditNodeId: (nodeId) =>
    set({ inlineEditNodeId: nodeId }),

  clearInlineEdit: () =>
    set({ inlineEditNodeId: null }),

  setAutosaveOnBlur: (enabled) =>
    set({ autosaveOnBlur: enabled }),

  setAutosaveStatusMessage: (message) =>
    set({ autosaveStatusMessage: message }),

  showToast: (message, durationMs = 4000) =>
    set((s) => {
      // Clear any existing timer
      if (s.toastTimerId) {
        clearTimeout(s.toastTimerId);
      }
      // Set auto-dismiss timer
      const timerId = setTimeout(() => {
        useUIStore.getState().clearToast();
      }, durationMs);
      return { toastMessage: message, toastTimerId: timerId };
    }),

  clearToast: () =>
    set((s) => {
      if (s.toastTimerId) {
        clearTimeout(s.toastTimerId);
      }
      return { toastMessage: null, toastTimerId: null };
    }),
}));

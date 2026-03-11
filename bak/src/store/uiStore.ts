/**
 * UI store - panel visibility, modals, toasts, toolbar/status bar sizing.
 */

import { create } from 'zustand';
import type { RightPanelTab } from '@/utils/constants';
import { preferences } from '@/core/platform/preferencesAdapter';

/** localStorage / Capacitor Preferences keys for persisted values */
export const THEME_STORAGE_KEY = 'theme';
export const HAPTIC_FEEDBACK_STORAGE_KEY = 'haptic-feedback';
export const TOOLBAR_HEIGHT_STORAGE_KEY = 'toolbar-height';
export const STATUS_BAR_HEIGHT_STORAGE_KEY = 'status-bar-height';

/* ── Toolbar height constants ────────────────────────────────── */
export const TOOLBAR_DEFAULT_HEIGHT = 48;
export const TOOLBAR_MIN_HEIGHT = 36;
export const TOOLBAR_MAX_HEIGHT = 80;
export const TOOLBAR_VIEWPORT_RATIO = 0.035;
export const TOOLBAR_DEFAULT_FLOOR = 40;
export const TOOLBAR_DEFAULT_CEILING = 64;

/* ── Status bar height constants ─────────────────────────────── */
export const STATUS_BAR_DEFAULT_HEIGHT = 24;
export const STATUS_BAR_MIN_HEIGHT = 20;
export const STATUS_BAR_MAX_HEIGHT = 48;
export const STATUS_BAR_VIEWPORT_RATIO = 0.02;
export const STATUS_BAR_DEFAULT_FLOOR = 20;
export const STATUS_BAR_DEFAULT_CEILING = 40;

/**
 * Compute the default toolbar height based on viewport height.
 * Returns TOOLBAR_VIEWPORT_RATIO * viewportHeight, clamped between floor and ceiling.
 */
export function computeDefaultToolbarHeight(viewportHeight?: number): number {
  const vh = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 900);
  const raw = Math.round(vh * TOOLBAR_VIEWPORT_RATIO);
  return Math.max(TOOLBAR_DEFAULT_FLOOR, Math.min(TOOLBAR_DEFAULT_CEILING, raw));
}

/**
 * Compute the default status bar height based on viewport height.
 */
export function computeDefaultStatusBarHeight(viewportHeight?: number): number {
  const vh = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 900);
  const raw = Math.round(vh * STATUS_BAR_VIEWPORT_RATIO);
  return Math.max(STATUS_BAR_DEFAULT_FLOOR, Math.min(STATUS_BAR_DEFAULT_CEILING, raw));
}

/**
 * Read persisted toolbar & status bar heights from platform preferences.
 * Returns partial state with only the fields that were persisted.
 * Uses synchronous read for store initialization.
 */
function readPersistedHeights(): {
  toolbarHeight?: number;
  toolbarHeightCustomized?: boolean;
  statusBarHeight?: number;
  statusBarHeightCustomized?: boolean;
} {
  const result: ReturnType<typeof readPersistedHeights> = {};
  if (typeof window === 'undefined') return result;
  try {
    const tb = preferences.getSync(TOOLBAR_HEIGHT_STORAGE_KEY);
    if (tb !== null) {
      const v = Number(tb);
      if (!isNaN(v) && v >= TOOLBAR_MIN_HEIGHT && v <= TOOLBAR_MAX_HEIGHT) {
        result.toolbarHeight = v;
        result.toolbarHeightCustomized = true;
      }
    }
    const sb = preferences.getSync(STATUS_BAR_HEIGHT_STORAGE_KEY);
    if (sb !== null) {
      const v = Number(sb);
      if (!isNaN(v) && v >= STATUS_BAR_MIN_HEIGHT && v <= STATUS_BAR_MAX_HEIGHT) {
        result.statusBarHeight = v;
        result.statusBarHeightCustomized = true;
      }
    }
  } catch {
    // ignore
  }
  return result;
}

/**
 * Load persisted toolbar & status bar heights from localStorage and apply to store.
 * Used for async loading (e.g., Capacitor Preferences on native platforms).
 */
export async function loadPersistedHeights(): Promise<void> {
  const persisted = readPersistedHeights();
  if (persisted.toolbarHeight !== undefined) {
    useUIStore.getState().setToolbarHeight(persisted.toolbarHeight);
  }
  if (persisted.statusBarHeight !== undefined) {
    useUIStore.getState().setStatusBarHeight(persisted.statusBarHeight);
  }
}

/**
 * Synchronously read the persisted haptic feedback preference.
 * Returns null if not found. Defaults to true (enabled).
 */
function readPersistedHapticFeedback(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = preferences.getSync(HAPTIC_FEEDBACK_STORAGE_KEY);
    if (raw === null) return true; // default enabled
    return raw !== 'false';
  } catch {
    return true;
  }
}

/**
 * Persist haptic feedback preference via the cross-platform preferences adapter.
 */
function persistHapticFeedback(enabled: boolean): void {
  preferences.set(HAPTIC_FEEDBACK_STORAGE_KEY, String(enabled)).catch(() => {
    // Silently ignore write failures
  });
}

function readPersistedTheme(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return preferences.getSync(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist theme ID via the cross-platform preferences adapter.
 */
function persistTheme(themeId: string): void {
  preferences.set(THEME_STORAGE_KEY, themeId).catch(() => {
    // Silently ignore write failures
  });
}

export interface DeleteDialogInfo {
  nodeId: string;
  nodeName: string;
  edgeCount: number;
  childCount: number;
  /** For multi-node deletion */
  nodeIds?: string[];
  nodeCount?: number;
}

export interface ConnectionDialogInfo {
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface PlacementModeInfo {
  nodeType: string; // e.g. 'compute/service'
  displayName: string; // e.g. 'Service'
}

/** Connect mode step: select-target -> pick-type -> done */
export type ConnectModeStep = 'select-target' | 'pick-type';

export interface ConnectModeState {
  /** Source node ID (must be selected before entering connect mode) */
  connectSource: string | null;
  /** Target node ID currently navigated to */
  connectTarget: string | null;
  /** Current step in connect flow */
  connectStep: ConnectModeStep | null;
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

export interface ConflictDialogInfo {
  /** Name of the externally modified file */
  fileName: string;
  /** Callback when user chooses "Reload from disk" (discard local changes) */
  onReload: () => void;
  /** Callback when user chooses "Save as copy" (save local to new file then reload) */
  onSaveAsCopy: () => void;
}

export interface EmptyProjectDialogInfo {
  /** Name of the project folder */
  folderName: string;
  /** Whether the folder contains recognizable source files */
  hasSourceFiles: boolean;
  /** Callback when user chooses "Use Claude Code" (opens terminal panel) */
  onUseAI: () => void;
  /** Callback when user chooses "Quick scan" */
  onQuickScan: () => void;
}

export interface ExternalAgentDialogInfo {
  /** The copyable prompt for the external agent */
  prompt: string;
  /** Called when the user clicks "Done" */
  onDone: () => void;
  /** Called when the user clicks "Cancel" */
  onCancel: () => void;
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

/**
 * Static default width (used by tests that need a fixed reference value).
 * At runtime, use computeDefaultLeftPanelWidth() for viewport-responsive defaults.
 */
export const LEFT_PANEL_DEFAULT_WIDTH = 240;
/** Drag below this threshold to snap-collapse the left panel */
export const LEFT_PANEL_COLLAPSE_THRESHOLD = 120;
/** Viewport-relative right panel default: 20% of viewport width, floor 260px, ceiling 480px */
export const RIGHT_PANEL_VIEWPORT_RATIO = 0.2;
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

/**
 * Static default width (used by tests that need a fixed reference value).
 * At runtime, use computeDefaultRightPanelWidth() for viewport-responsive defaults.
 */
export const RIGHT_PANEL_DEFAULT_WIDTH = 320;
export const RIGHT_PANEL_MIN_WIDTH = 220;
export const RIGHT_PANEL_MAX_WIDTH = 500;

export interface UIStoreState {
  // Theme
  themeId: string;

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

  // Toolbar and status bar heights
  toolbarHeight: number;
  toolbarHeightCustomized: boolean;
  statusBarHeight: number;
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

  // Conflict dialog (file modified externally while local unsaved changes exist)
  conflictDialogOpen: boolean;
  conflictDialogInfo: ConflictDialogInfo | null;

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

  // Empty project onboarding dialog
  emptyProjectDialogOpen: boolean;
  emptyProjectDialogInfo: EmptyProjectDialogInfo | null;

  // External agent dialog (waiting for MCP agent)
  externalAgentDialogOpen: boolean;
  externalAgentDialogInfo: ExternalAgentDialogInfo | null;

  // Template picker dialog
  templatePickerOpen: boolean;

  // Template gallery panel
  templateGalleryOpen: boolean;

  // File operation loading indicator
  fileOperationLoading: boolean;
  fileOperationMessage: string | null;

  // Pending rename (auto-focus display name input for newly created node)
  pendingRenameNodeId: string | null;

  // Inline editing on canvas node (F2 quick-edit without opening right panel)
  inlineEditNodeId: string | null;

  // Haptic feedback (iPad)
  hapticFeedbackEnabled: boolean;

  // Nesting frame inset effect
  nestingFrameEnabled: boolean;
  nestingFrameThickness: number; // px per level (default 4)

  // Autosave on focus change
  autosaveOnBlur: boolean;
  autosaveStatusMessage: string | null;

  // Connect mode (Vim-style C key to create edges)
  connectSource: string | null;
  connectTarget: string | null;
  connectStep: ConnectModeStep | null;

  // Toast notifications
  toastMessage: string | null;
  toastTimerId: ReturnType<typeof setTimeout> | null;

  // Generic dialog registry state
  /** Set of currently open dialog IDs (used by DialogHost) */
  openDialogs: Set<string>;
  /** Props for each open dialog, keyed by dialog ID */
  dialogProps: Map<string, unknown>;

  // Theme actions
  setTheme: (themeId: string) => void;

  // Actions
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  openRightPanel: (tab?: RightPanelTab) => void;
  closeRightPanel: () => void;

  // Generic dialog actions (used by dialog registry system)
  /** Open a dialog by ID, optionally passing props */
  openDialog: (id: string, props?: unknown) => void;
  /** Close a dialog by ID */
  closeDialog: (id: string) => void;
  /** Get props for a specific dialog */
  getDialogProps: (id: string) => unknown;

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

  // Conflict dialog actions (file modified externally while local changes exist)
  openConflictDialog: (info: ConflictDialogInfo) => void;
  closeConflictDialog: () => void;

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
  /** Reset all panel sizes to viewport-relative defaults (clears custom values) */
  resetBarSizes: () => void;

  // Toolbar / status bar height actions
  setToolbarHeight: (height: number) => void;
  setStatusBarHeight: (height: number) => void;
  /** Update toolbar height from viewport resize (only if not customized) */
  updateToolbarHeightFromViewport: (viewportHeight: number) => void;
  /** Update status bar height from viewport resize (only if not customized) */
  updateStatusBarHeightFromViewport: (viewportHeight: number) => void;
  /** Reset toolbar and status bar to fixed defaults (48px / 24px) and clear localStorage */
  resetBarSizesToFixedDefaults: () => void;

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

  // Empty project dialog actions
  openEmptyProjectDialog: (info: EmptyProjectDialogInfo) => void;
  closeEmptyProjectDialog: () => void;

  // External agent dialog actions
  openExternalAgentDialog: (info: ExternalAgentDialogInfo) => void;
  closeExternalAgentDialog: () => void;

  // Template picker actions
  openTemplatePicker: () => void;
  closeTemplatePicker: () => void;

  // Template gallery actions
  openTemplateGallery: () => void;
  closeTemplateGallery: () => void;

  // File operation loading actions
  setFileOperationLoading: (message: string) => void;
  clearFileOperationLoading: () => void;

  // Rename mode actions
  setPendingRenameNodeId: (nodeId: string | null) => void;
  clearPendingRename: () => void;

  // Inline edit actions
  setInlineEditNodeId: (nodeId: string | null) => void;
  clearInlineEdit: () => void;

  // Haptic feedback actions
  setHapticFeedbackEnabled: (enabled: boolean) => void;

  // Nesting frame actions
  setNestingFrameEnabled: (enabled: boolean) => void;
  setNestingFrameThickness: (px: number) => void;

  // Autosave actions
  setAutosaveOnBlur: (enabled: boolean) => void;
  setAutosaveStatusMessage: (message: string | null) => void;

  // Connect mode actions
  enterConnectMode: (sourceNodeId: string) => void;
  setConnectTarget: (targetNodeId: string | null) => void;
  advanceToPickType: () => void;
  exitConnectMode: () => void;

  // Toast actions
  showToast: (message: string, durationMs?: number) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  themeId: readPersistedTheme() ?? 'dark',

  leftPanelOpen: true,
  rightPanelOpen: false,
  rightPanelTab: 'properties',
  leftPanelWidth: computeDefaultLeftPanelWidth(),
  leftPanelWidthCustomized: false,
  rightPanelWidth: computeDefaultRightPanelWidth(),
  rightPanelWidthCustomized: false,

  toolbarHeight: readPersistedHeights().toolbarHeight ?? TOOLBAR_DEFAULT_HEIGHT,
  toolbarHeightCustomized: readPersistedHeights().toolbarHeightCustomized ?? false,
  statusBarHeight: readPersistedHeights().statusBarHeight ?? STATUS_BAR_DEFAULT_HEIGHT,
  statusBarHeightCustomized: readPersistedHeights().statusBarHeightCustomized ?? false,

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

  conflictDialogOpen: false,
  conflictDialogInfo: null,

  placementMode: false,
  placementInfo: null,

  shortcutsHelpOpen: false,

  commandPaletteOpen: false,

  quickSearchOpen: false,

  shortcutSettingsOpen: false,

  settingsDialogOpen: false,

  emptyProjectDialogOpen: false,
  emptyProjectDialogInfo: null,

  externalAgentDialogOpen: false,
  externalAgentDialogInfo: null,

  templatePickerOpen: false,
  templateGalleryOpen: false,

  fileOperationLoading: false,
  fileOperationMessage: null,

  pendingRenameNodeId: null,

  inlineEditNodeId: null,

  hapticFeedbackEnabled: readPersistedHapticFeedback(),

  nestingFrameEnabled: true,
  nestingFrameThickness: 4,

  autosaveOnBlur: true,
  autosaveStatusMessage: null,

  connectSource: null,
  connectTarget: null,
  connectStep: null,

  toastMessage: null,
  toastTimerId: null,

  openDialogs: new Set<string>(),
  dialogProps: new Map<string, unknown>(),

  setTheme: (themeId) => {
    persistTheme(themeId);
    set({ themeId });
  },

  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),

  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),

  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  openRightPanel: (tab) => set({ rightPanelOpen: true, ...(tab ? { rightPanelTab: tab } : {}) }),

  closeRightPanel: () => set({ rightPanelOpen: false }),

  // Generic dialog open/close (used by dialog registry system)
  openDialog: (id, props) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add(id);
      const nextProps = new Map(s.dialogProps);
      if (props !== undefined) {
        nextProps.set(id, props);
      }
      return { openDialogs: nextOpen, dialogProps: nextProps };
    }),

  closeDialog: (id) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete(id);
      const nextProps = new Map(s.dialogProps);
      nextProps.delete(id);
      return { openDialogs: nextOpen, dialogProps: nextProps };
    }),

  getDialogProps: (id): unknown => useUIStore.getState().dialogProps.get(id),

  // Legacy dialog actions — delegate to generic openDialogs Set for consistency
  openDeleteDialog: (info) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('delete');
      const nextProps = new Map(s.dialogProps);
      nextProps.set('delete', info);
      return {
        deleteDialogOpen: true,
        deleteDialogInfo: info,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  closeDeleteDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('delete');
      const nextProps = new Map(s.dialogProps);
      nextProps.delete('delete');
      return {
        deleteDialogOpen: false,
        deleteDialogInfo: null,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  openConnectionDialog: (info) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('connection');
      const nextProps = new Map(s.dialogProps);
      nextProps.set('connection', info);
      return {
        connectionDialogOpen: true,
        connectionDialogInfo: info,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  closeConnectionDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('connection');
      const nextProps = new Map(s.dialogProps);
      nextProps.delete('connection');
      return {
        connectionDialogOpen: false,
        connectionDialogInfo: null,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  openUnsavedChangesDialog: (info) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('unsavedChanges');
      const nextProps = new Map(s.dialogProps);
      nextProps.set('unsavedChanges', info);
      return {
        unsavedChangesDialogOpen: true,
        unsavedChangesDialogInfo: info,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  closeUnsavedChangesDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('unsavedChanges');
      const nextProps = new Map(s.dialogProps);
      nextProps.delete('unsavedChanges');
      return {
        unsavedChangesDialogOpen: false,
        unsavedChangesDialogInfo: null,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  openErrorDialog: (info) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('error');
      const nextProps = new Map(s.dialogProps);
      nextProps.set('error', info);
      return {
        errorDialogOpen: true,
        errorDialogInfo: info,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  closeErrorDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('error');
      const nextProps = new Map(s.dialogProps);
      nextProps.delete('error');
      return {
        errorDialogOpen: false,
        errorDialogInfo: null,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  openIntegrityWarningDialog: (info) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('integrityWarning');
      const nextProps = new Map(s.dialogProps);
      nextProps.set('integrityWarning', info);
      return {
        integrityWarningDialogOpen: true,
        integrityWarningDialogInfo: info,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  closeIntegrityWarningDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('integrityWarning');
      const nextProps = new Map(s.dialogProps);
      nextProps.delete('integrityWarning');
      return {
        integrityWarningDialogOpen: false,
        integrityWarningDialogInfo: null,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  openConflictDialog: (info) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('conflict');
      const nextProps = new Map(s.dialogProps);
      nextProps.set('conflict', info);
      return {
        conflictDialogOpen: true,
        conflictDialogInfo: info,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  closeConflictDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('conflict');
      const nextProps = new Map(s.dialogProps);
      nextProps.delete('conflict');
      return {
        conflictDialogOpen: false,
        conflictDialogInfo: null,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  enterPlacementMode: (info) => set({ placementMode: true, placementInfo: info }),

  exitPlacementMode: () => set({ placementMode: false, placementInfo: null }),

  setLeftPanelWidth: (width) =>
    set({
      leftPanelWidth: Math.max(LEFT_PANEL_MIN_WIDTH, Math.min(LEFT_PANEL_MAX_WIDTH, width)),
      leftPanelWidthCustomized: true,
    }),

  setRightPanelWidth: (width) =>
    set({
      rightPanelWidth: Math.max(RIGHT_PANEL_MIN_WIDTH, Math.min(RIGHT_PANEL_MAX_WIDTH, width)),
      rightPanelWidthCustomized: true,
    }),

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
    preferences.remove(TOOLBAR_HEIGHT_STORAGE_KEY).catch(() => {});
    preferences.remove(STATUS_BAR_HEIGHT_STORAGE_KEY).catch(() => {});
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
    preferences.set(TOOLBAR_HEIGHT_STORAGE_KEY, String(clamped)).catch(() => {});
    set({ toolbarHeight: clamped, toolbarHeightCustomized: true });
  },

  setStatusBarHeight: (height) => {
    const clamped = Math.max(STATUS_BAR_MIN_HEIGHT, Math.min(STATUS_BAR_MAX_HEIGHT, height));
    preferences.set(STATUS_BAR_HEIGHT_STORAGE_KEY, String(clamped)).catch(() => {});
    set({ statusBarHeight: clamped, statusBarHeightCustomized: true });
  },

  updateToolbarHeightFromViewport: (viewportHeight) =>
    set((s) => {
      if (s.toolbarHeightCustomized) return s;
      return { toolbarHeight: computeDefaultToolbarHeight(viewportHeight) };
    }),

  updateStatusBarHeightFromViewport: (viewportHeight) =>
    set((s) => {
      if (s.statusBarHeightCustomized) return s;
      return { statusBarHeight: computeDefaultStatusBarHeight(viewportHeight) };
    }),

  resetBarSizesToFixedDefaults: () => {
    preferences.remove(TOOLBAR_HEIGHT_STORAGE_KEY).catch(() => {});
    preferences.remove(STATUS_BAR_HEIGHT_STORAGE_KEY).catch(() => {});
    set({
      toolbarHeight: TOOLBAR_DEFAULT_HEIGHT,
      toolbarHeightCustomized: false,
      statusBarHeight: STATUS_BAR_DEFAULT_HEIGHT,
      statusBarHeightCustomized: false,
    });
  },

  openShortcutsHelp: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('shortcutsHelp');
      return { shortcutsHelpOpen: true, openDialogs: nextOpen };
    }),

  closeShortcutsHelp: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('shortcutsHelp');
      return { shortcutsHelpOpen: false, openDialogs: nextOpen };
    }),

  toggleShortcutsHelp: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      const nextState = !s.shortcutsHelpOpen;
      if (nextState) nextOpen.add('shortcutsHelp');
      else nextOpen.delete('shortcutsHelp');
      return { shortcutsHelpOpen: nextState, openDialogs: nextOpen };
    }),

  openCommandPalette: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('commandPalette');
      return { commandPaletteOpen: true, openDialogs: nextOpen };
    }),

  closeCommandPalette: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('commandPalette');
      return { commandPaletteOpen: false, openDialogs: nextOpen };
    }),

  toggleCommandPalette: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      const nextState = !s.commandPaletteOpen;
      if (nextState) nextOpen.add('commandPalette');
      else nextOpen.delete('commandPalette');
      return { commandPaletteOpen: nextState, openDialogs: nextOpen };
    }),

  openQuickSearch: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('quickSearch');
      return { quickSearchOpen: true, openDialogs: nextOpen };
    }),

  closeQuickSearch: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('quickSearch');
      return { quickSearchOpen: false, openDialogs: nextOpen };
    }),

  toggleQuickSearch: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      const nextState = !s.quickSearchOpen;
      if (nextState) nextOpen.add('quickSearch');
      else nextOpen.delete('quickSearch');
      return { quickSearchOpen: nextState, openDialogs: nextOpen };
    }),

  openShortcutSettings: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('shortcutSettings');
      return { shortcutSettingsOpen: true, openDialogs: nextOpen };
    }),

  closeShortcutSettings: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('shortcutSettings');
      return { shortcutSettingsOpen: false, openDialogs: nextOpen };
    }),

  openSettingsDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('settings');
      return { settingsDialogOpen: true, openDialogs: nextOpen };
    }),

  closeSettingsDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('settings');
      return { settingsDialogOpen: false, openDialogs: nextOpen };
    }),

  openEmptyProjectDialog: (info) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('emptyProject');
      const nextProps = new Map(s.dialogProps);
      nextProps.set('emptyProject', info);
      return {
        emptyProjectDialogOpen: true,
        emptyProjectDialogInfo: info,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  closeEmptyProjectDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('emptyProject');
      const nextProps = new Map(s.dialogProps);
      nextProps.delete('emptyProject');
      return {
        emptyProjectDialogOpen: false,
        emptyProjectDialogInfo: null,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  openExternalAgentDialog: (info) =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('externalAgent');
      const nextProps = new Map(s.dialogProps);
      nextProps.set('externalAgent', info);
      return {
        externalAgentDialogOpen: true,
        externalAgentDialogInfo: info,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  closeExternalAgentDialog: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('externalAgent');
      const nextProps = new Map(s.dialogProps);
      nextProps.delete('externalAgent');
      return {
        externalAgentDialogOpen: false,
        externalAgentDialogInfo: null,
        openDialogs: nextOpen,
        dialogProps: nextProps,
      };
    }),

  openTemplatePicker: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('templatePicker');
      return { templatePickerOpen: true, openDialogs: nextOpen };
    }),

  closeTemplatePicker: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('templatePicker');
      return { templatePickerOpen: false, openDialogs: nextOpen };
    }),

  openTemplateGallery: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.add('templateGallery');
      return { templateGalleryOpen: true, openDialogs: nextOpen };
    }),

  closeTemplateGallery: () =>
    set((s) => {
      const nextOpen = new Set(s.openDialogs);
      nextOpen.delete('templateGallery');
      return { templateGalleryOpen: false, openDialogs: nextOpen };
    }),

  setFileOperationLoading: (message) =>
    set({ fileOperationLoading: true, fileOperationMessage: message }),

  clearFileOperationLoading: () => set({ fileOperationLoading: false, fileOperationMessage: null }),

  setPendingRenameNodeId: (nodeId) => set({ pendingRenameNodeId: nodeId }),

  clearPendingRename: () => set({ pendingRenameNodeId: null }),

  setInlineEditNodeId: (nodeId) => set({ inlineEditNodeId: nodeId }),

  clearInlineEdit: () => set({ inlineEditNodeId: null }),

  setHapticFeedbackEnabled: (enabled) => {
    persistHapticFeedback(enabled);
    set({ hapticFeedbackEnabled: enabled });
  },

  setAutosaveOnBlur: (enabled) => set({ autosaveOnBlur: enabled }),

  setNestingFrameEnabled: (enabled: boolean) => set({ nestingFrameEnabled: enabled }),
  setNestingFrameThickness: (px: number) => set({ nestingFrameThickness: Math.max(1, Math.min(12, px)) }),

  setAutosaveStatusMessage: (message) => set({ autosaveStatusMessage: message }),

  enterConnectMode: (sourceNodeId) =>
    set({ connectSource: sourceNodeId, connectTarget: null, connectStep: 'select-target' }),

  setConnectTarget: (targetNodeId) => set({ connectTarget: targetNodeId }),

  advanceToPickType: () => set({ connectStep: 'pick-type' }),

  exitConnectMode: () => set({ connectSource: null, connectTarget: null, connectStep: null }),

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

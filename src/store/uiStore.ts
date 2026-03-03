/**
 * UI store - panel visibility, modals, toasts.
 */

import { create } from 'zustand';
import type { RightPanelTab } from '@/utils/constants';

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
export const LEFT_PANEL_DEFAULT_WIDTH = 240;
export const LEFT_PANEL_MIN_WIDTH = 180;
export const LEFT_PANEL_MAX_WIDTH = 400;
/** Drag below this threshold to snap-collapse the left panel */
export const LEFT_PANEL_COLLAPSE_THRESHOLD = 120;
export const RIGHT_PANEL_DEFAULT_WIDTH = 320;
export const RIGHT_PANEL_MIN_WIDTH = 220;
export const RIGHT_PANEL_MAX_WIDTH = 500;

export interface UIStoreState {
  // Panel visibility
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;

  // Panel widths (in pixels, for drag-resize)
  leftPanelWidth: number;
  rightPanelWidth: number;

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

  // File operation loading indicator
  fileOperationLoading: boolean;
  fileOperationMessage: string | null;

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

  // File operation loading actions
  setFileOperationLoading: (message: string) => void;
  clearFileOperationLoading: () => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: false,
  rightPanelTab: 'properties',
  leftPanelWidth: LEFT_PANEL_DEFAULT_WIDTH,
  rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,

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

  fileOperationLoading: false,
  fileOperationMessage: null,

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
    set({ leftPanelWidth: Math.max(LEFT_PANEL_MIN_WIDTH, Math.min(LEFT_PANEL_MAX_WIDTH, width)) }),

  setRightPanelWidth: (width) =>
    set({ rightPanelWidth: Math.max(RIGHT_PANEL_MIN_WIDTH, Math.min(RIGHT_PANEL_MAX_WIDTH, width)) }),

  setFileOperationLoading: (message) =>
    set({ fileOperationLoading: true, fileOperationMessage: message }),

  clearFileOperationLoading: () =>
    set({ fileOperationLoading: false, fileOperationMessage: null }),
}));

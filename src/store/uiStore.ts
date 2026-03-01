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

export interface UIStoreState {
  // Panel visibility
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;

  // Delete confirmation dialog
  deleteDialogOpen: boolean;
  deleteDialogInfo: DeleteDialogInfo | null;

  // Connection type dialog
  connectionDialogOpen: boolean;
  connectionDialogInfo: ConnectionDialogInfo | null;

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
}

export const useUIStore = create<UIStoreState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: false,
  rightPanelTab: 'properties',

  deleteDialogOpen: false,
  deleteDialogInfo: null,

  connectionDialogOpen: false,
  connectionDialogInfo: null,

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
}));

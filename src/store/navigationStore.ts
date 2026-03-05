/**
 * Navigation store - manages the fractal zoom navigation path.
 *
 * The path is an array of node IDs representing the current drill-down level:
 * - `[]` = root level (top-level nodes visible)
 * - `['nodeA']` = viewing children of nodeA
 * - `['nodeA', 'nodeB']` = viewing children of nodeB (which is a child of nodeA)
 *
 * Used by the RenderApi to determine which nodes/edges to display,
 * and by the breadcrumb navigation component.
 */

import { create } from 'zustand';

export interface NavigationStoreState {
  // Navigation path for fractal zoom (empty = root level)
  path: string[];

  // Actions
  zoomIn: (nodeId: string) => void;
  zoomOut: () => void;
  zoomToRoot: () => void;
  zoomToLevel: (path: string[]) => void;
}

export const useNavigationStore = create<NavigationStoreState>((set) => ({
  path: [],

  zoomIn: (nodeId) => set((s) => ({ path: [...s.path, nodeId] })),

  zoomOut: () => set((s) => ({ path: s.path.slice(0, -1) })),

  zoomToRoot: () => set({ path: [] }),

  zoomToLevel: (path) => set({ path }),
}));

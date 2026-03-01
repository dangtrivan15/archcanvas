/**
 * Navigation store - fractal zoom path, zoomIn, zoomOut, zoomToRoot.
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

  zoomIn: (nodeId) =>
    set((s) => ({ path: [...s.path, nodeId] })),

  zoomOut: () =>
    set((s) => ({ path: s.path.slice(0, -1) })),

  zoomToRoot: () =>
    set({ path: [] }),

  zoomToLevel: (path) =>
    set({ path }),
}));

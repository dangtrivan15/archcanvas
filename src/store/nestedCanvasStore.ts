/**
 * Nested canvas store FACADE - thin re-export layer over the unified navigationStore.
 *
 * All cross-file navigation logic now lives in `navigationStore.ts`.
 * This file exists only for backwards compatibility — consumers that import from
 * `nestedCanvasStore` will continue to work without changes.
 *
 * TODO(P05-T3): Delete this facade once all consumers are migrated.
 */

import { useNavigationStore } from './navigationStore';

// Re-export types from the unified store
export type {
  ParentEdgeIndicator,
  FileStackEntry,
} from './navigationStore';

// Re-export the NestedCanvasStoreState type for backwards compatibility
export type { NavigationStoreState as NestedCanvasStoreState } from './navigationStore';

/**
 * Facade hook — returns the unified navigation store.
 * All nestedCanvasStore properties (fileStack, activeFilePath, pushFile, popFile,
 * popToRoot, getDepth, getStackEntry, parentEdgeIndicators, reset) are available
 * directly on the unified store.
 */
export const useNestedCanvasStore = useNavigationStore;

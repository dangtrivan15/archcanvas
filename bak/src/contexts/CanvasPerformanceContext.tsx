/**
 * CanvasPerformanceContext - Provides performance state to all canvas children.
 *
 * This context makes LOD state, reduced-motion preference, and other
 * performance flags available to node and edge components without prop drilling.
 */

import { createContext, useContext } from 'react';

export interface CanvasPerformanceContextValue {
  /** Whether to render simplified (LOD) nodes */
  isLowDetailMode: boolean;
  /** Whether to simplify edge rendering */
  isLowDetailEdges: boolean;
  /** Whether the user prefers reduced motion */
  prefersReducedMotion: boolean;
}

const defaultValue: CanvasPerformanceContextValue = {
  isLowDetailMode: false,
  isLowDetailEdges: false,
  prefersReducedMotion: false,
};

export const CanvasPerformanceContext = createContext<CanvasPerformanceContextValue>(defaultValue);

export function useCanvasPerformanceContext(): CanvasPerformanceContextValue {
  return useContext(CanvasPerformanceContext);
}

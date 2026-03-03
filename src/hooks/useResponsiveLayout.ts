/**
 * Responsive layout hook.
 * Monitors window size and auto-closes panels when the window is too narrow
 * to ensure the canvas remains usable.
 *
 * Breakpoints:
 * - NARROW (< 768px): Auto-close left panel
 * - VERY_NARROW (< 640px): Auto-close both panels
 * - On grow above breakpoint: panels are NOT auto-reopened (user controls them)
 */

import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';

/** Below this width, left panel auto-closes */
export const NARROW_BREAKPOINT = 768;

/** Below this width, both panels auto-close */
export const VERY_NARROW_BREAKPOINT = 640;

export function useResponsiveLayout() {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  // Track the previous width to detect shrink transitions
  const prevWidthRef = useRef(typeof window !== 'undefined' ? window.innerWidth : 1024);

  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    const prevWidth = prevWidthRef.current;
    prevWidthRef.current = width;

    // Only auto-close on shrink transitions (crossing below a breakpoint)
    // Don't auto-reopen on grow (user controls panel visibility)
    const crossedBelowNarrow = prevWidth >= NARROW_BREAKPOINT && width < NARROW_BREAKPOINT;
    const crossedBelowVeryNarrow = prevWidth >= VERY_NARROW_BREAKPOINT && width < VERY_NARROW_BREAKPOINT;

    if (crossedBelowNarrow || width < NARROW_BREAKPOINT) {
      // Below narrow breakpoint: close left panel if open
      if (leftPanelOpen) {
        useUIStore.getState().toggleLeftPanel();
      }
    }

    if (crossedBelowVeryNarrow || width < VERY_NARROW_BREAKPOINT) {
      // Below very narrow breakpoint: close right panel if open
      if (rightPanelOpen) {
        closeRightPanel();
      }
    }
  }, [leftPanelOpen, rightPanelOpen, closeRightPanel]);

  useEffect(() => {
    // Check on mount (initial layout)
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);
}

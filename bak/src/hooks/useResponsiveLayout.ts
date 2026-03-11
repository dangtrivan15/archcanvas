/**
 * Responsive layout hook.
 * Monitors window size and auto-closes panels when the window is too narrow
 * to ensure the canvas remains usable.
 *
 * Breakpoints (aligned with useViewportSize):
 * - COMPACT (< 600px): Auto-close left panel on transition.
 *   Right panel is NOT auto-closed because it renders as a bottom sheet overlay
 *   in compact mode (iPad Slide Over / narrow Split View).
 * - NARROW (< 768px): Auto-close left panel on transition
 * - On grow above breakpoint: panels are NOT auto-reopened (user controls them)
 */

import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { COMPACT_BREAKPOINT, RESIZE_DEBOUNCE_MS } from '@/hooks/useViewportSize';

/** Below this width, left panel auto-closes */
export const NARROW_BREAKPOINT = 768;

/** Below this width, compact layout activates */
export const VERY_NARROW_BREAKPOINT = COMPACT_BREAKPOINT; // 600px

export function useResponsiveLayout() {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);

  // Track the previous width to detect shrink transitions
  const prevWidthRef = useRef(typeof window !== 'undefined' ? window.innerWidth : 1024);
  // Track if initial mount check has been done
  const mountedRef = useRef(false);

  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    const prevWidth = prevWidthRef.current;
    prevWidthRef.current = width;

    // On first call (mount), only auto-close left panel if below narrow breakpoint
    // On subsequent calls, detect crossing transitions
    const isMount = !mountedRef.current;
    if (isMount) {
      mountedRef.current = true;
    }

    const crossedBelowNarrow =
      !isMount && prevWidth >= NARROW_BREAKPOINT && width < NARROW_BREAKPOINT;

    if (crossedBelowNarrow || (isMount && width < NARROW_BREAKPOINT)) {
      // Below narrow breakpoint: close left panel if open
      if (leftPanelOpen) {
        useUIStore.getState().toggleLeftPanel();
      }
    }

    // NOTE: Right panel is NOT auto-closed in compact mode.
    // In compact mode (<600px), the right panel renders as a bottom sheet overlay
    // in App.tsx, so it remains usable without competing for horizontal space.
    // Users can close it via the X button on the sheet.
  }, [leftPanelOpen]);

  // Debounced resize handler to prevent layout thrashing during
  // Stage Manager window dragging (iPadOS 16+)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedHandleResize = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      handleResize();
    }, RESIZE_DEBOUNCE_MS);
  }, [handleResize]);

  useEffect(() => {
    // Check on mount (initial layout) - no debounce needed
    handleResize();

    window.addEventListener('resize', debouncedHandleResize);
    return () => {
      window.removeEventListener('resize', debouncedHandleResize);
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleResize, debouncedHandleResize]);
}

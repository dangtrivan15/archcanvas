/**
 * useViewportSize hook - tracks window.innerWidth/innerHeight
 * and provides responsive breakpoint information.
 *
 * Breakpoints:
 * - compact: <600px  (iPad Slide Over, Split View narrow)
 * - regular: 600-1024px (iPad Split View 50/50)
 * - wide: >1024px (full desktop, iPad full-screen)
 *
 * Used for iPad Split View / Slide Over multitasking adaptation.
 */

import { useState, useEffect, useCallback } from 'react';

export const COMPACT_BREAKPOINT = 600;
export const REGULAR_BREAKPOINT = 1024;

export type ViewportBreakpoint = 'compact' | 'regular' | 'wide';

export interface ViewportSize {
  width: number;
  height: number;
  breakpoint: ViewportBreakpoint;
  isCompact: boolean;
  isRegular: boolean;
  isWide: boolean;
}

function getBreakpoint(width: number): ViewportBreakpoint {
  if (width < COMPACT_BREAKPOINT) return 'compact';
  if (width <= REGULAR_BREAKPOINT) return 'regular';
  return 'wide';
}

function getViewportSize(): ViewportSize {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const height = typeof window !== 'undefined' ? window.innerHeight : 768;
  const breakpoint = getBreakpoint(width);

  return {
    width,
    height,
    breakpoint,
    isCompact: breakpoint === 'compact',
    isRegular: breakpoint === 'regular',
    isWide: breakpoint === 'wide',
  };
}

export function useViewportSize(): ViewportSize {
  const [viewport, setViewport] = useState<ViewportSize>(getViewportSize);

  const handleResize = useCallback(() => {
    setViewport(getViewportSize());
  }, []);

  useEffect(() => {
    // Also listen for visual viewport resize events (for iPad multitasking)
    window.addEventListener('resize', handleResize);

    // Use visualViewport resize for more accurate iPad multitasking detection
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [handleResize]);

  return viewport;
}

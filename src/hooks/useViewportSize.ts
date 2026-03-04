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

/**
 * iPad Split View specific breakpoints:
 * - ICON_RAIL_BREAKPOINT: <768px - left sidebar becomes icon-only rail
 *   (applies when left panel is visible, i.e., viewport >= 600px)
 *   This covers the narrow-regular range (600-768px) where a full sidebar
 *   would consume too much horizontal space.
 * - Slide Over (1/3): ~320px width (compact mode, left panel hidden)
 * - Split View 1/2: ~507px width (compact mode, left panel hidden)
 * - Split View 2/3: ~678px width (icon rail if left panel open)
 */
export const ICON_RAIL_BREAKPOINT = 768;

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
    // Listen for window resize events (covers most cases)
    window.addEventListener('resize', handleResize);

    // Use visualViewport resize for more accurate iPad multitasking detection
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    // Listen for orientation changes (portrait ↔ landscape) on iOS/iPad
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize]);

  return viewport;
}

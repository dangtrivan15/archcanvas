/**
 * useCanvasPerformance - Performance optimization hook for the canvas.
 *
 * Provides:
 * - Level-of-detail (LOD) state based on current zoom level
 * - prefers-reduced-motion detection
 * - FPS monitoring (dev mode only)
 * - Node count warnings (> 100 visible nodes)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/** Zoom thresholds for LOD rendering */
export const LOD_ZOOM_THRESHOLD = 0.4; // Below this, render simplified nodes
export const LOD_EDGE_THRESHOLD = 0.35; // Below this, simplify edges to straight lines

/** Node count warning threshold */
export const NODE_COUNT_WARNING = 100;

/** Canvas bounds for translateExtent (prevent infinite panning) */
export const CANVAS_BOUNDS: [[number, number], [number, number]] = [
  [-10000, -10000],
  [10000, 10000],
];

export interface CanvasPerformanceState {
  /** Whether to render simplified (LOD) nodes */
  isLowDetailMode: boolean;
  /** Whether to simplify edge rendering */
  isLowDetailEdges: boolean;
  /** Whether the user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Current FPS (only tracked in dev mode) */
  fps: number;
  /** Whether FPS counter is enabled */
  fpsEnabled: boolean;
  /** Toggle FPS counter */
  toggleFps: () => void;
  /** Current node count */
  nodeCount: number;
  /** Whether node count exceeds warning threshold */
  nodeCountWarning: boolean;
  /** Update node count for monitoring */
  setNodeCount: (count: number) => void;
  /** Update zoom level for LOD calculation */
  updateZoom: (zoom: number) => void;
}

/**
 * Hook providing canvas performance optimizations.
 * Tracks zoom level for LOD, monitors FPS, and detects reduced-motion preference.
 */
export function useCanvasPerformance(): CanvasPerformanceState {
  const [zoom, setZoom] = useState(1);
  const [nodeCount, setNodeCount] = useState(0);
  const [fpsEnabled, setFpsEnabled] = useState(false);
  const [fps, setFps] = useState(60);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef<number>(0);

  // Detect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // LOD state derived from zoom
  const isLowDetailMode = zoom < LOD_ZOOM_THRESHOLD;
  const isLowDetailEdges = zoom < LOD_EDGE_THRESHOLD;

  // Node count warning
  const nodeCountWarning = nodeCount > NODE_COUNT_WARNING;

  // FPS tracking (dev mode only)
  useEffect(() => {
    if (!fpsEnabled) return;

    const tick = (now: number) => {
      frameCountRef.current++;
      const elapsed = now - lastTimeRef.current;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    frameCountRef.current = 0;
    rafIdRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafIdRef.current);
  }, [fpsEnabled]);

  const toggleFps = useCallback(() => {
    setFpsEnabled((prev) => !prev);
  }, []);

  const updateZoom = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  return useMemo(
    () => ({
      isLowDetailMode,
      isLowDetailEdges,
      prefersReducedMotion,
      fps,
      fpsEnabled,
      toggleFps,
      nodeCount,
      nodeCountWarning,
      setNodeCount,
      updateZoom,
    }),
    [isLowDetailMode, isLowDetailEdges, prefersReducedMotion, fps, fpsEnabled, toggleFps, nodeCount, nodeCountWarning],
  );
}

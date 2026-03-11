/**
 * useStageManagerResize - maintains React Flow canvas viewport center
 * during Stage Manager (iPadOS 16+) window resizing.
 *
 * Stage Manager allows freely resizable windows (not just fixed split ratios).
 * This hook detects resize events and adjusts the React Flow viewport to
 * maintain the center point, preventing the canvas from jumping or
 * showing a blank area when the window is resized.
 *
 * Also handles external display detection via Stage Manager.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { RESIZE_DEBOUNCE_MS } from '@/hooks/useViewportSize';

export function useStageManagerResize() {
  const { getViewport, setViewport } = useReactFlow();
  const prevSizeRef = useRef({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResize = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;

      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      const prevWidth = prevSizeRef.current.width;
      const prevHeight = prevSizeRef.current.height;

      // Only adjust if size actually changed
      if (newWidth === prevWidth && newHeight === prevHeight) return;

      const vp = getViewport();

      // Calculate the center point in flow coordinates before resize
      // center_flow = (center_screen - pan) / zoom
      const prevCenterX = (prevWidth / 2 - vp.x) / vp.zoom;
      const prevCenterY = (prevHeight / 2 - vp.y) / vp.zoom;

      // Compute new pan values so the same flow-coordinate center stays
      // at the new screen center
      const newX = newWidth / 2 - prevCenterX * vp.zoom;
      const newY = newHeight / 2 - prevCenterY * vp.zoom;

      setViewport({ x: newX, y: newY, zoom: vp.zoom }, { duration: 0 });

      prevSizeRef.current = { width: newWidth, height: newHeight };
    }, RESIZE_DEBOUNCE_MS);
  }, [getViewport, setViewport]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);

    // Stage Manager external display support
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleResize);
      }
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleResize]);
}

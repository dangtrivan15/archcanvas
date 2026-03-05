/**
 * usePencilInput — Detect Apple Pencil / stylus input via PointerEvents.
 *
 * Filters pointer events for pointerType === 'pen' and extracts:
 * - pressure (0-1, normalized)
 * - tiltX, tiltY (degrees)
 * - azimuthAngle (radians, when available)
 *
 * Updates the pencil Zustand store slice so other components can react
 * to pencil state (e.g., show pencil indicator, switch interaction mode).
 *
 * Also differentiates pencil from finger: when a pencil is active, finger
 * events are treated as pan/zoom (not draw/annotate).
 *
 * Attaches global pointer event listeners on mount and cleans up on unmount.
 */

import { useEffect, useCallback, useRef } from 'react';
import { usePencilStore } from '@/store/pencilStore';

export interface PencilInputState {
  /** Whether a pen/stylus is currently active */
  isPencilActive: boolean;
  /** Normalized pressure 0-1 */
  pressure: number;
  /** Tilt angles */
  tiltX: number;
  tiltY: number;
  /** Azimuth angle in radians */
  azimuthAngle: number;
  /** Whether a pencil was ever detected this session */
  pencilDetected: boolean;
  /** Input type of the current/last pointer: 'pen', 'touch', or 'mouse' */
  lastPointerType: 'pen' | 'touch' | 'mouse' | null;
}

/**
 * Hook that tracks Apple Pencil / stylus pointer events globally.
 *
 * @param containerRef - Optional ref to a container element (defaults to document)
 * @returns Current pencil input state from the store
 */
export function usePencilInput(
  containerRef?: React.RefObject<HTMLElement | null>,
): PencilInputState {
  const updatePencilState = usePencilStore((s) => s.updatePencilState);
  const setPencilActive = usePencilStore((s) => s.setPencilActive);
  const resetPencilState = usePencilStore((s) => s.resetPencilState);
  const isPencilActive = usePencilStore((s) => s.isPencilActive);
  const pressure = usePencilStore((s) => s.pressure);
  const tilt = usePencilStore((s) => s.tilt);
  const azimuthAngle = usePencilStore((s) => s.azimuthAngle);
  const pencilDetected = usePencilStore((s) => s.pencilDetected);

  const lastPointerTypeRef = useRef<'pen' | 'touch' | 'mouse' | null>(null);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      lastPointerTypeRef.current = e.pointerType as 'pen' | 'touch' | 'mouse';

      if (e.pointerType === 'pen') {
        setPencilActive(true);
        updatePencilState({
          pressure: e.pressure,
          tiltX: e.tiltX,
          tiltY: e.tiltY,
          azimuthAngle: (e as PointerEventWithAzimuth).azimuthAngle ?? 0,
        });
      }
    },
    [setPencilActive, updatePencilState],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      lastPointerTypeRef.current = e.pointerType as 'pen' | 'touch' | 'mouse';

      if (e.pointerType === 'pen') {
        updatePencilState({
          pressure: e.pressure,
          tiltX: e.tiltX,
          tiltY: e.tiltY,
          azimuthAngle: (e as PointerEventWithAzimuth).azimuthAngle ?? 0,
        });
      }
    },
    [updatePencilState],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        resetPencilState();
      }
    },
    [resetPencilState],
  );

  const handlePointerCancel = useCallback(
    (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        resetPencilState();
      }
    },
    [resetPencilState],
  );

  useEffect(() => {
    const target = containerRef?.current ?? document;

    target.addEventListener('pointerdown', handlePointerDown as EventListener);
    target.addEventListener('pointermove', handlePointerMove as EventListener);
    target.addEventListener('pointerup', handlePointerUp as EventListener);
    target.addEventListener('pointercancel', handlePointerCancel as EventListener);

    return () => {
      target.removeEventListener('pointerdown', handlePointerDown as EventListener);
      target.removeEventListener('pointermove', handlePointerMove as EventListener);
      target.removeEventListener('pointerup', handlePointerUp as EventListener);
      target.removeEventListener('pointercancel', handlePointerCancel as EventListener);
    };
  }, [containerRef, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel]);

  return {
    isPencilActive,
    pressure,
    tiltX: tilt.tiltX,
    tiltY: tilt.tiltY,
    azimuthAngle,
    pencilDetected,
    lastPointerType: lastPointerTypeRef.current,
  };
}

/**
 * Utility: determine if a pointer event is a "draw" event (pencil)
 * vs a "navigate" event (finger/mouse).
 *
 * When Apple Pencil is detected, fingers are for panning/zooming,
 * and the pencil is for drawing/annotating.
 */
export function isPencilDrawEvent(e: PointerEvent, pencilDetected: boolean): boolean {
  // If pencil has been detected, only pen events are "draw" events
  if (pencilDetected) {
    return e.pointerType === 'pen';
  }
  // If no pencil detected, all pointer types can draw
  return true;
}

/**
 * Utility: determine if a pointer event should pan/zoom.
 *
 * When Apple Pencil is detected, touch events are for navigation.
 * When no pencil is detected, multi-touch still pans/zooms.
 */
export function isNavigationEvent(e: PointerEvent, pencilDetected: boolean): boolean {
  if (pencilDetected) {
    return e.pointerType === 'touch' || e.pointerType === 'mouse';
  }
  return e.pointerType === 'mouse';
}

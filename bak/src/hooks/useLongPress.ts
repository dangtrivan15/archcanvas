/**
 * useLongPress — Detect 500ms touch-hold to trigger context menus on touch devices.
 *
 * On touch devices (iPad), right-click context menus don't exist. This hook
 * detects a 500ms touch-hold and fires a callback with the pointer coordinates.
 *
 * Key behaviors:
 * - Only triggers for touch/pen pointers (pointerType !== 'mouse')
 * - Cancels if pointer moves more than 10px (distinguishes from drag)
 * - Cancels if pointer is released before 500ms
 * - Does NOT interfere with desktop right-click (mouse pointers are ignored)
 *
 * Returns onPointerDown, onPointerUp, onPointerMove, onPointerCancel handlers
 * to be spread onto the target element.
 */

import { useRef, useCallback } from 'react';
import { haptics } from '@/hooks/useHaptics';

/** Threshold in ms for long press detection */
const LONG_PRESS_DURATION = 500;

/** Maximum pointer movement in px before cancelling (to distinguish from drag) */
const MOVE_THRESHOLD = 10;

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

/**
 * Hook that detects long-press (500ms touch-hold) on touch devices.
 *
 * @param onLongPress - Callback fired with {x, y} (client coordinates) on long press
 * @returns Pointer event handlers to spread onto the target element
 */
export function useLongPress(onLongPress: (x: number, y: number) => void): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const activeRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    activeRef.current = false;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only handle touch/pen pointers — desktop mouse uses right-click
      if (e.pointerType === 'mouse') return;

      cancel();
      startPosRef.current = { x: e.clientX, y: e.clientY };
      activeRef.current = true;

      timerRef.current = setTimeout(() => {
        if (activeRef.current && startPosRef.current) {
          // Haptic feedback for context menu open
          haptics.impact('Medium');
          // Prevent the default context menu and other interactions
          onLongPress(startPosRef.current.x, startPosRef.current.y);
          cancel();
        }
      }, LONG_PRESS_DURATION);
    },
    [onLongPress, cancel],
  );

  const onPointerUp = useCallback(
    (_e: React.PointerEvent) => {
      cancel();
    },
    [cancel],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeRef.current || !startPosRef.current) return;

      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > MOVE_THRESHOLD) {
        cancel();
      }
    },
    [cancel],
  );

  const onPointerCancel = useCallback(
    (_e: React.PointerEvent) => {
      cancel();
    },
    [cancel],
  );

  return { onPointerDown, onPointerUp, onPointerMove, onPointerCancel };
}

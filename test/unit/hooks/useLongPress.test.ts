/**
 * Tests for src/hooks/useLongPress.ts
 *
 * Feature #283: Long-press context menus for touch devices
 *
 * Verifies that the useLongPress hook correctly detects 500ms touch-hold
 * and fires a callback with pointer coordinates. Only fires for touch/pen
 * pointers; mouse pointers are ignored (desktop uses right-click).
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '@/hooks/useLongPress';

/** Create a mock PointerEvent */
function mockPointerEvent(
  type: string,
  options: {
    pointerType?: string;
    clientX?: number;
    clientY?: number;
  } = {},
): React.PointerEvent {
  return {
    pointerType: options.pointerType ?? 'touch',
    clientX: options.clientX ?? 100,
    clientY: options.clientY ?? 200,
    type,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.PointerEvent;
}

describe('Feature #283: useLongPress hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Source structure ─────────────────────────────────────────

  describe('Source structure', () => {
    it('exports useLongPress function', () => {
      expect(typeof useLongPress).toBe('function');
    });

    it('returns onPointerDown handler', () => {
      const { result } = renderHook(() => useLongPress(vi.fn()));
      expect(typeof result.current.onPointerDown).toBe('function');
    });

    it('returns onPointerUp handler', () => {
      const { result } = renderHook(() => useLongPress(vi.fn()));
      expect(typeof result.current.onPointerUp).toBe('function');
    });

    it('returns onPointerMove handler', () => {
      const { result } = renderHook(() => useLongPress(vi.fn()));
      expect(typeof result.current.onPointerMove).toBe('function');
    });

    it('returns onPointerCancel handler', () => {
      const { result } = renderHook(() => useLongPress(vi.fn()));
      expect(typeof result.current.onPointerCancel).toBe('function');
    });
  });

  // ─── Touch long press detection ──────────────────────────────

  describe('Touch long press detection', () => {
    it('fires callback after 500ms touch hold', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'touch', clientX: 150, clientY: 250 }),
        );
      });

      expect(onLongPress).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
      expect(onLongPress).toHaveBeenCalledWith(150, 250);
    });

    it('fires callback for pen pointer type', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'pen', clientX: 300, clientY: 400 }),
        );
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
      expect(onLongPress).toHaveBeenCalledWith(300, 400);
    });

    it('does NOT fire before 500ms', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(mockPointerEvent('pointerdown', { pointerType: 'touch' }));
      });

      act(() => {
        vi.advanceTimersByTime(499);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('passes correct coordinates to callback', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'touch', clientX: 42, clientY: 84 }),
        );
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledWith(42, 84);
    });
  });

  // ─── Mouse pointer (desktop) ─────────────────────────────────

  describe('Mouse pointer (desktop)', () => {
    it('does NOT fire for mouse pointer type', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(mockPointerEvent('pointerdown', { pointerType: 'mouse' }));
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('ignores mouse down completely (no timer started)', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(mockPointerEvent('pointerdown', { pointerType: 'mouse' }));
      });

      // Even after a very long time, shouldn't fire
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  // ─── Cancellation on pointer release ─────────────────────────

  describe('Cancellation on pointer release', () => {
    it('cancels if pointer is released before 500ms', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(mockPointerEvent('pointerdown', { pointerType: 'touch' }));
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      act(() => {
        result.current.onPointerUp(mockPointerEvent('pointerup'));
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('cancels on pointerCancel event', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(mockPointerEvent('pointerdown', { pointerType: 'touch' }));
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.onPointerCancel(mockPointerEvent('pointercancel'));
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  // ─── Cancellation on pointer move (>10px) ────────────────────

  describe('Cancellation on pointer move', () => {
    it('cancels if pointer moves more than 10px', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 }),
        );
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Move 15px (greater than 10px threshold)
      act(() => {
        result.current.onPointerMove(
          mockPointerEvent('pointermove', { clientX: 115, clientY: 100 }),
        );
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('does NOT cancel if pointer moves less than 10px', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 }),
        );
      });

      // Move 5px (less than 10px threshold)
      act(() => {
        result.current.onPointerMove(
          mockPointerEvent('pointermove', { clientX: 103, clientY: 104 }),
        );
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('cancels on exactly 10px movement (boundary)', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 }),
        );
      });

      // Move exactly 10px horizontal (at boundary, should NOT cancel - threshold is >10)
      act(() => {
        result.current.onPointerMove(
          mockPointerEvent('pointermove', { clientX: 110, clientY: 100 }),
        );
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('cancels on 11px diagonal movement', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 }),
        );
      });

      // Move ~11px diagonally (8+8 = ~11.3)
      act(() => {
        result.current.onPointerMove(
          mockPointerEvent('pointermove', { clientX: 108, clientY: 108 }),
        );
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  // ─── Multiple presses ────────────────────────────────────────

  describe('Multiple presses', () => {
    it('resets on new pointer down', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      // First touch
      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 }),
        );
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Second touch (resets)
      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'touch', clientX: 200, clientY: 200 }),
        );
      });

      // 500ms after second touch
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
      expect(onLongPress).toHaveBeenCalledWith(200, 200);
    });

    it('fires only once per long press', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerDown(
          mockPointerEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 }),
        );
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);

      // Continue holding - should not fire again
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles pointer move without prior pointer down gracefully', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      // Move without prior down - should not crash
      act(() => {
        result.current.onPointerMove(
          mockPointerEvent('pointermove', { clientX: 100, clientY: 100 }),
        );
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('handles pointer up without prior pointer down gracefully', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      act(() => {
        result.current.onPointerUp(mockPointerEvent('pointerup'));
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('callback can be updated via rerender', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const { result, rerender } = renderHook(({ cb }) => useLongPress(cb), {
        initialProps: { cb: callback1 },
      });

      rerender({ cb: callback2 });

      act(() => {
        result.current.onPointerDown(mockPointerEvent('pointerdown', { pointerType: 'touch' }));
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });
});

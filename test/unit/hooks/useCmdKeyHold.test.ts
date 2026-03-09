// @vitest-environment happy-dom
/**
 * Tests for useCmdKeyHold hook.
 *
 * Feature #545: Keyboard shortcuts overlay does not appear during Cmd+key combos
 *
 * Tests cover:
 * 1. Hold Cmd+S to save — verify shortcuts overlay does NOT appear
 * 2. Hold Cmd+Z to undo — verify shortcuts overlay does NOT appear
 * 3. Hold Cmd alone for 1 second — verify shortcuts overlay DOES appear
 * 4. Release Cmd — verify overlay dismisses
 * 5. Hold Cmd+Shift+L for auto-layout — verify overlay does NOT appear
 *
 * The key fix (commit f42e9c1): Meta key-repeat events were restarting
 * the 1s timer after another key cancelled it because cmdDownRef was
 * reset to false. Now cmdDownRef stays true so Meta repeats are ignored.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCmdKeyHold } from '@/hooks/useCmdKeyHold';
import {
  _setPlatformForTesting,
  _resetPlatformDetection,
} from '@/core/input/platformDetector';

// ── Test Helpers ──────────────────────────────────────────────────

function fireKeyDown(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
}

function fireKeyUp(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keyup', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
}

// ── Tests ─────────────────────────────────────────────────────────

describe('useCmdKeyHold - shortcuts overlay visibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _setPlatformForTesting('mac');
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetPlatformDetection();
  });

  // ── Step 3: Hold Cmd alone for 1 second — overlay DOES appear ──

  it('shows overlay when Cmd is held alone for 1 second', () => {
    const { result } = renderHook(() => useCmdKeyHold());

    expect(result.current).toBe(false);

    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });

    // Before 1s, still hidden
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBe(false);

    // At 1s, overlay appears
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  // ── Step 4: Release Cmd — overlay dismisses ──

  it('dismisses overlay when Cmd is released', () => {
    const { result } = renderHook(() => useCmdKeyHold());

    // Hold Cmd for 1s to show overlay
    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(true);

    // Release Cmd
    act(() => {
      fireKeyUp('Meta');
    });
    expect(result.current).toBe(false);
  });

  // ── Step 1: Hold Cmd+S — overlay does NOT appear ──

  it('does NOT show overlay when Cmd+S is pressed (save shortcut)', () => {
    const { result } = renderHook(() => useCmdKeyHold());

    // Press Cmd
    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });

    // Press S while Cmd is held
    act(() => {
      fireKeyDown('s', { metaKey: true });
    });

    // Wait well past the 1s threshold
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBe(false);
  });

  // ── Step 2: Hold Cmd+Z — overlay does NOT appear ──

  it('does NOT show overlay when Cmd+Z is pressed (undo shortcut)', () => {
    const { result } = renderHook(() => useCmdKeyHold());

    // Press Cmd
    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });

    // Press Z while Cmd is held
    act(() => {
      fireKeyDown('z', { metaKey: true });
    });

    // Wait past threshold
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBe(false);
  });

  // ── Step 5: Hold Cmd+Shift+L — overlay does NOT appear ──

  it('does NOT show overlay when Cmd+Shift+L is pressed (auto-layout shortcut)', () => {
    const { result } = renderHook(() => useCmdKeyHold());

    // Press Cmd
    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });

    // Press Shift while Cmd is held
    act(() => {
      fireKeyDown('Shift', { metaKey: true, shiftKey: true });
    });

    // Press L while Cmd+Shift is held
    act(() => {
      fireKeyDown('l', { metaKey: true, shiftKey: true });
    });

    // Wait past threshold
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBe(false);
  });

  // ── Key fix verification: Meta key-repeat after Cmd+key ──

  it('does NOT restart timer when Meta repeats after another key cancels it', () => {
    const { result } = renderHook(() => useCmdKeyHold());

    // Press Cmd (starts timer)
    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });

    // Press S while Cmd held (cancels timer)
    act(() => {
      fireKeyDown('s', { metaKey: true });
    });

    // Simulate Meta key-repeat events (OS sends these while Cmd is held)
    act(() => {
      fireKeyDown('Meta', { metaKey: true, repeat: true });
    });
    act(() => {
      fireKeyDown('Meta', { metaKey: true, repeat: true });
    });

    // Wait well past 1s — overlay should NOT appear because Meta repeats
    // are ignored when cmdDownRef is still true
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBe(false);
  });

  it('does NOT show overlay on non-Cmd platforms (linux)', () => {
    _setPlatformForTesting('linux');
    const { result } = renderHook(() => useCmdKeyHold());

    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBe(false);
  });

  it('does NOT show overlay on Windows platform', () => {
    _setPlatformForTesting('windows');
    const { result } = renderHook(() => useCmdKeyHold());

    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBe(false);
  });

  it('works on iPad platform', () => {
    _setPlatformForTesting('ipad');
    const { result } = renderHook(() => useCmdKeyHold());

    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(true);
  });

  it('dismisses on window blur (e.g., Cmd+Tab)', () => {
    const { result } = renderHook(() => useCmdKeyHold());

    // Hold Cmd for 1s
    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(true);

    // Window loses focus
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current).toBe(false);
  });

  it('can show overlay again after Cmd+key combo if Cmd is fully released and re-pressed', () => {
    const { result } = renderHook(() => useCmdKeyHold());

    // Cmd+S combo
    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });
    act(() => {
      fireKeyDown('s', { metaKey: true });
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(false);

    // Release Cmd fully
    act(() => {
      fireKeyUp('Meta');
    });

    // Press Cmd alone again
    act(() => {
      fireKeyDown('Meta', { metaKey: true });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Now overlay should appear
    expect(result.current).toBe(true);
  });
});

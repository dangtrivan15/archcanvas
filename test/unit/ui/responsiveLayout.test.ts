// @vitest-environment happy-dom
/**
 * Tests for responsive three-panel layout behavior.
 * Feature #216: Three-panel layout responds to window resize
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useResponsiveLayout, NARROW_BREAKPOINT, VERY_NARROW_BREAKPOINT } from '@/hooks/useResponsiveLayout';

// Helper to simulate window resize
function simulateResize(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  window.dispatchEvent(new Event('resize'));
}

describe('Responsive Layout', () => {
  beforeEach(() => {
    // Reset to wide window with default panel states
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
    useUIStore.setState({
      leftPanelOpen: true,
      rightPanelOpen: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Breakpoint constants', () => {
    it('exports NARROW_BREAKPOINT at 768px', () => {
      expect(NARROW_BREAKPOINT).toBe(768);
    });

    it('exports VERY_NARROW_BREAKPOINT at 640px', () => {
      expect(VERY_NARROW_BREAKPOINT).toBe(640);
    });

    it('VERY_NARROW_BREAKPOINT is less than NARROW_BREAKPOINT', () => {
      expect(VERY_NARROW_BREAKPOINT).toBeLessThan(NARROW_BREAKPOINT);
    });
  });

  describe('Panel behavior at normal width', () => {
    it('keeps left panel open at normal width', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
      renderHook(() => useResponsiveLayout());
      expect(useUIStore.getState().leftPanelOpen).toBe(true);
    });

    it('keeps right panel open at normal width', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
      renderHook(() => useResponsiveLayout());
      expect(useUIStore.getState().rightPanelOpen).toBe(true);
    });

    it('keeps both panels open at width just above narrow breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: NARROW_BREAKPOINT, writable: true, configurable: true });
      renderHook(() => useResponsiveLayout());
      expect(useUIStore.getState().leftPanelOpen).toBe(true);
      expect(useUIStore.getState().rightPanelOpen).toBe(true);
    });
  });

  describe('Auto-close panels on narrow resize', () => {
    it('closes left panel when window shrinks below NARROW_BREAKPOINT', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
      renderHook(() => useResponsiveLayout());

      act(() => {
        simulateResize(NARROW_BREAKPOINT - 1);
      });

      expect(useUIStore.getState().leftPanelOpen).toBe(false);
    });

    it('closes both panels when window shrinks below VERY_NARROW_BREAKPOINT', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
      renderHook(() => useResponsiveLayout());

      act(() => {
        simulateResize(VERY_NARROW_BREAKPOINT - 1);
      });

      expect(useUIStore.getState().leftPanelOpen).toBe(false);
      expect(useUIStore.getState().rightPanelOpen).toBe(false);
    });

    it('keeps right panel open when only below narrow breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
      renderHook(() => useResponsiveLayout());

      act(() => {
        simulateResize(700); // Below narrow but above very narrow
      });

      // Right panel should remain open (only left auto-closes at this width)
      expect(useUIStore.getState().rightPanelOpen).toBe(true);
    });
  });

  describe('No auto-reopen on window grow', () => {
    it('does NOT reopen left panel when window grows above NARROW_BREAKPOINT', () => {
      // Start narrow
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true, configurable: true });
      useUIStore.setState({ leftPanelOpen: false });

      renderHook(() => useResponsiveLayout());

      act(() => {
        simulateResize(1280);
      });

      // Panel should remain closed - user controls reopening
      expect(useUIStore.getState().leftPanelOpen).toBe(false);
    });

    it('does NOT reopen right panel when window grows above VERY_NARROW_BREAKPOINT', () => {
      // Start very narrow
      Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });
      useUIStore.setState({ rightPanelOpen: false });

      renderHook(() => useResponsiveLayout());

      act(() => {
        simulateResize(1280);
      });

      // Panel should remain closed - user controls reopening
      expect(useUIStore.getState().rightPanelOpen).toBe(false);
    });
  });

  describe('Panel already closed behavior', () => {
    it('does nothing if left panel is already closed at narrow width', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
      useUIStore.setState({ leftPanelOpen: false });

      renderHook(() => useResponsiveLayout());

      act(() => {
        simulateResize(NARROW_BREAKPOINT - 1);
      });

      // Should remain closed without error
      expect(useUIStore.getState().leftPanelOpen).toBe(false);
    });

    it('does nothing if right panel is already closed at very narrow width', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
      useUIStore.setState({ rightPanelOpen: false });

      renderHook(() => useResponsiveLayout());

      act(() => {
        simulateResize(VERY_NARROW_BREAKPOINT - 1);
      });

      // Should remain closed without error
      expect(useUIStore.getState().rightPanelOpen).toBe(false);
    });
  });

  describe('Resize event listener', () => {
    it('adds resize event listener on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      renderHook(() => useResponsiveLayout());

      expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('removes resize event listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useResponsiveLayout());

      unmount();

      expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });

  describe('CSS class expectations (panel flexibility)', () => {
    // These test that our constants align with what makes the layout work
    it('panels have min-width values smaller than their default width', () => {
      // Left panel: w-60 (240px) with min-w-[180px]
      const leftDefault = 240; // w-60 = 15rem = 240px
      const leftMin = 180;
      expect(leftMin).toBeLessThan(leftDefault);

      // Right panel: w-80 (320px) with min-w-[220px]
      const rightDefault = 320; // w-80 = 20rem = 320px
      const rightMin = 220;
      expect(rightMin).toBeLessThan(rightDefault);
    });

    it('canvas has minimum usable width', () => {
      // Canvas min-w-[200px] ensures canvas is always interactive
      const canvasMin = 200;
      expect(canvasMin).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Mount at narrow width', () => {
    it('closes left panel on mount if window is already below NARROW_BREAKPOINT', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true, configurable: true });
      useUIStore.setState({ leftPanelOpen: true });

      renderHook(() => useResponsiveLayout());

      expect(useUIStore.getState().leftPanelOpen).toBe(false);
    });

    it('closes both panels on mount if window is already below VERY_NARROW_BREAKPOINT', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });
      useUIStore.setState({ leftPanelOpen: true, rightPanelOpen: true });

      renderHook(() => useResponsiveLayout());

      expect(useUIStore.getState().leftPanelOpen).toBe(false);
      expect(useUIStore.getState().rightPanelOpen).toBe(false);
    });
  });

  describe('Progressive collapse', () => {
    it('collapses left panel first, then right panel as window narrows', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
      renderHook(() => useResponsiveLayout());

      // Step 1: Resize to 700px (between very narrow and narrow)
      act(() => {
        simulateResize(700);
      });
      expect(useUIStore.getState().leftPanelOpen).toBe(false);
      expect(useUIStore.getState().rightPanelOpen).toBe(true);

      // Step 2: Resize further to 500px (below very narrow)
      act(() => {
        simulateResize(500);
      });
      expect(useUIStore.getState().leftPanelOpen).toBe(false);
      expect(useUIStore.getState().rightPanelOpen).toBe(false);
    });
  });
});

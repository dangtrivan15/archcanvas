// @vitest-environment happy-dom
/**
 * Tests for useVirtualKeyboard hook - Feature #287
 *
 * Validates on-screen keyboard detection via VisualViewport API
 * and automatic scroll-into-view behavior for right panel inputs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualKeyboard } from '@/hooks/useVirtualKeyboard';

// Mock visualViewport
let viewportListeners: Map<string, ((...args: unknown[]) => void)[]>;
let mockVisualViewport: {
  height: number;
  width: number;
  offsetTop: number;
  offsetLeft: number;
  pageTop: number;
  pageLeft: number;
  scale: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

function createMockVisualViewport(height: number) {
  viewportListeners = new Map();
  return {
    height,
    width: 375,
    offsetTop: 0,
    offsetLeft: 0,
    pageTop: 0,
    pageLeft: 0,
    scale: 1,
    addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const handlers = viewportListeners.get(event) || [];
      handlers.push(handler);
      viewportListeners.set(event, handlers);
    }),
    removeEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const handlers = viewportListeners.get(event) || [];
      viewportListeners.set(
        event,
        handlers.filter((h) => h !== handler),
      );
    }),
  };
}

function fireViewportResize() {
  const handlers = viewportListeners.get('resize') || [];
  for (const handler of handlers) {
    handler();
  }
}

describe('useVirtualKeyboard', () => {
  let originalInnerHeight: number;
  let originalVisualViewport: VisualViewport | null;

  beforeEach(() => {
    originalInnerHeight = window.innerHeight;
    originalVisualViewport = window.visualViewport;
    // Set up default: full-height viewport (no keyboard)
    Object.defineProperty(window, 'innerHeight', {
      value: 812,
      writable: true,
      configurable: true,
    });
    mockVisualViewport = createMockVisualViewport(812);
    Object.defineProperty(window, 'visualViewport', {
      value: mockVisualViewport,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'visualViewport', {
      value: originalVisualViewport,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('starts with keyboard not visible and height 0', () => {
      const { result } = renderHook(() => useVirtualKeyboard());
      expect(result.current.isKeyboardVisible).toBe(false);
      expect(result.current.keyboardHeight).toBe(0);
    });

    it('registers resize listener on visualViewport', () => {
      renderHook(() => useVirtualKeyboard());
      expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function),
      );
    });
  });

  describe('Keyboard detection', () => {
    it('detects keyboard when visualViewport.height shrinks significantly', () => {
      const { result } = renderHook(() => useVirtualKeyboard());

      // Simulate keyboard opening (300px keyboard)
      mockVisualViewport.height = 512;
      act(() => {
        fireViewportResize();
      });

      expect(result.current.isKeyboardVisible).toBe(true);
      expect(result.current.keyboardHeight).toBe(300);
    });

    it('ignores small height differences below threshold', () => {
      const { result } = renderHook(() => useVirtualKeyboard());

      // Simulate small viewport change (e.g., browser chrome hiding)
      mockVisualViewport.height = 780; // only 32px difference
      act(() => {
        fireViewportResize();
      });

      expect(result.current.isKeyboardVisible).toBe(false);
      expect(result.current.keyboardHeight).toBe(32);
    });

    it('reports keyboard hidden when viewport restores to full height', () => {
      const { result } = renderHook(() => useVirtualKeyboard());

      // Open keyboard
      mockVisualViewport.height = 500;
      act(() => {
        fireViewportResize();
      });
      expect(result.current.isKeyboardVisible).toBe(true);

      // Close keyboard
      mockVisualViewport.height = 812;
      act(() => {
        fireViewportResize();
      });
      expect(result.current.isKeyboardVisible).toBe(false);
      expect(result.current.keyboardHeight).toBe(0);
    });

    it('handles exact threshold boundary (100px)', () => {
      const { result } = renderHook(() => useVirtualKeyboard());

      // Exactly at threshold - should NOT be visible (> threshold required)
      mockVisualViewport.height = 712; // exactly 100px difference
      act(() => {
        fireViewportResize();
      });
      expect(result.current.isKeyboardVisible).toBe(false);

      // Just above threshold
      mockVisualViewport.height = 711; // 101px difference
      act(() => {
        fireViewportResize();
      });
      expect(result.current.isKeyboardVisible).toBe(true);
      expect(result.current.keyboardHeight).toBe(101);
    });
  });

  describe('External keyboard', () => {
    it('reports no keyboard when visualViewport matches innerHeight', () => {
      const { result } = renderHook(() => useVirtualKeyboard());

      // External keyboard connected: viewport stays same size
      mockVisualViewport.height = 812;
      act(() => {
        fireViewportResize();
      });

      expect(result.current.isKeyboardVisible).toBe(false);
      expect(result.current.keyboardHeight).toBe(0);
    });
  });

  describe('Scroll into view', () => {
    it('scrolls active input into view when keyboard appears and input is in right panel', () => {
      // Create a mock right panel with an input
      const panel = document.createElement('div');
      panel.setAttribute('data-testid', 'right-panel');
      const input = document.createElement('input');
      panel.appendChild(input);
      document.body.appendChild(panel);

      // Focus the input
      input.focus();

      const scrollIntoViewMock = vi.fn();
      input.scrollIntoView = scrollIntoViewMock;

      renderHook(() => useVirtualKeyboard());

      // Simulate keyboard opening
      mockVisualViewport.height = 500;
      act(() => {
        fireViewportResize();
      });

      // scrollIntoView is called via requestAnimationFrame
      // We need to flush the RAF
      vi.useFakeTimers();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      vi.useRealTimers();

      // Clean up
      document.body.removeChild(panel);
    });

    it('does NOT scroll when active element is outside right panel', () => {
      // Create an input outside any panel
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const scrollIntoViewMock = vi.fn();
      input.scrollIntoView = scrollIntoViewMock;

      renderHook(() => useVirtualKeyboard());

      // Simulate keyboard opening
      mockVisualViewport.height = 500;
      act(() => {
        fireViewportResize();
      });

      // scrollIntoView should NOT be called since input is not in right panel
      expect(scrollIntoViewMock).not.toHaveBeenCalled();

      // Clean up
      document.body.removeChild(input);
    });

    it('handles right panel bottom sheet variant', () => {
      // Create a mock bottom sheet panel with an input
      const sheet = document.createElement('div');
      sheet.setAttribute('data-testid', 'right-panel-sheet');
      const input = document.createElement('input');
      sheet.appendChild(input);
      document.body.appendChild(sheet);

      input.focus();
      const scrollIntoViewMock = vi.fn();
      input.scrollIntoView = scrollIntoViewMock;

      renderHook(() => useVirtualKeyboard());

      // Simulate keyboard opening
      mockVisualViewport.height = 500;
      act(() => {
        fireViewportResize();
      });

      // Clean up
      document.body.removeChild(sheet);
    });
  });

  describe('No VisualViewport support', () => {
    it('gracefully handles missing visualViewport', () => {
      // Remove visualViewport
      Object.defineProperty(window, 'visualViewport', {
        value: null,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useVirtualKeyboard());

      expect(result.current.isKeyboardVisible).toBe(false);
      expect(result.current.keyboardHeight).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('removes event listeners on unmount', () => {
      const { unmount } = renderHook(() => useVirtualKeyboard());

      unmount();

      expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function),
      );
    });
  });

  describe('State stability', () => {
    it('does not re-render when viewport fires resize with same values', () => {
      const { result } = renderHook(() => useVirtualKeyboard());

      // Fire resize with no change
      act(() => {
        fireViewportResize();
      });

      // State should be identical - React will bail out of re-render
      expect(result.current.isKeyboardVisible).toBe(false);
      expect(result.current.keyboardHeight).toBe(0);
    });

    it('correctly tracks multiple keyboard open/close cycles', () => {
      const { result } = renderHook(() => useVirtualKeyboard());

      // Cycle 1: open
      mockVisualViewport.height = 450;
      act(() => {
        fireViewportResize();
      });
      expect(result.current.isKeyboardVisible).toBe(true);
      expect(result.current.keyboardHeight).toBe(362);

      // Cycle 1: close
      mockVisualViewport.height = 812;
      act(() => {
        fireViewportResize();
      });
      expect(result.current.isKeyboardVisible).toBe(false);
      expect(result.current.keyboardHeight).toBe(0);

      // Cycle 2: open with different height
      mockVisualViewport.height = 550;
      act(() => {
        fireViewportResize();
      });
      expect(result.current.isKeyboardVisible).toBe(true);
      expect(result.current.keyboardHeight).toBe(262);

      // Cycle 2: close
      mockVisualViewport.height = 812;
      act(() => {
        fireViewportResize();
      });
      expect(result.current.isKeyboardVisible).toBe(false);
    });
  });

  describe('Negative height protection', () => {
    it('clamps keyboard height to 0 when visualViewport is taller than innerHeight', () => {
      const { result } = renderHook(() => useVirtualKeyboard());

      // Edge case: visualViewport reports larger than innerHeight
      mockVisualViewport.height = 900; // > 812
      act(() => {
        fireViewportResize();
      });

      expect(result.current.keyboardHeight).toBe(0);
      expect(result.current.isKeyboardVisible).toBe(false);
    });
  });
});

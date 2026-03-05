/**
 * useVirtualKeyboard hook - detects on-screen keyboard appearance
 * and adjusts layout to prevent the keyboard from obscuring inputs.
 *
 * Uses the VisualViewport API to track keyboard height:
 *   keyboardHeight = window.innerHeight - visualViewport.height
 *
 * When the keyboard is visible and the focused element is inside
 * the right panel, it scrolls the input into view and reports
 * the keyboard height so the panel can reduce its max-height.
 *
 * When an external keyboard is connected, visualViewport.height
 * matches window.innerHeight, so keyboardHeight stays 0 and
 * no layout adjustment occurs.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/** Minimum pixel threshold to consider the keyboard "visible" */
const KEYBOARD_HEIGHT_THRESHOLD = 100;

/** Selector for right panel containers */
const RIGHT_PANEL_SELECTORS = ['[data-testid="right-panel"]', '[data-testid="right-panel-sheet"]'];

export interface VirtualKeyboardState {
  /** Whether the on-screen keyboard is currently visible */
  isKeyboardVisible: boolean;
  /** Height of the keyboard in pixels (0 when hidden or external keyboard) */
  keyboardHeight: number;
}

/**
 * Checks if the given element is inside the right panel.
 */
function isElementInRightPanel(element: Element | null): boolean {
  if (!element) return false;
  for (const selector of RIGHT_PANEL_SELECTORS) {
    const panel = document.querySelector(selector);
    if (panel && panel.contains(element)) {
      return true;
    }
  }
  return false;
}

/**
 * Scrolls the active input element into view within its scrollable container.
 * Uses a small delay to ensure the viewport has settled after keyboard animation.
 */
function scrollActiveInputIntoView(): void {
  const activeElement = document.activeElement;
  if (!activeElement) return;

  // Only scroll for input-like elements
  const tagName = activeElement.tagName.toLowerCase();
  const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  const isContentEditable = (activeElement as HTMLElement).isContentEditable;

  if (!isInput && !isContentEditable) return;

  // Use scrollIntoView with a smooth behavior and block: 'nearest'
  // to avoid jarring full-page scrolls
  requestAnimationFrame(() => {
    activeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  });
}

export function useVirtualKeyboard(): VirtualKeyboardState {
  const [state, setState] = useState<VirtualKeyboardState>({
    isKeyboardVisible: false,
    keyboardHeight: 0,
  });

  // Track the initial window.innerHeight to distinguish keyboard from resize
  const initialInnerHeightRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );

  const handleViewportResize = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // On iOS/iPadOS, when the virtual keyboard opens:
    //   - window.innerHeight stays the same (full viewport)
    //   - visualViewport.height shrinks by the keyboard height
    // With external keyboard: both values are equal
    const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
    const isKeyboardVisible = keyboardHeight > KEYBOARD_HEIGHT_THRESHOLD;

    setState((prev) => {
      // Only update state if values actually changed
      if (prev.isKeyboardVisible === isKeyboardVisible && prev.keyboardHeight === keyboardHeight) {
        return prev;
      }
      return { isKeyboardVisible, keyboardHeight };
    });

    // If keyboard just appeared and active element is in right panel, scroll it into view
    if (isKeyboardVisible && isElementInRightPanel(document.activeElement)) {
      scrollActiveInputIntoView();
    }
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) {
      // VisualViewport API not available - no keyboard detection possible
      return;
    }

    // Update initial height reference
    initialInnerHeightRef.current = window.innerHeight;

    // Listen for visual viewport resize events (keyboard open/close)
    vv.addEventListener('resize', handleViewportResize);

    // Also listen for focus events to handle the case where an input
    // in the right panel receives focus while keyboard is already visible
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (state.isKeyboardVisible && isElementInRightPanel(target)) {
        // Slight delay to let keyboard animation settle
        setTimeout(scrollActiveInputIntoView, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);

    return () => {
      vv.removeEventListener('resize', handleViewportResize);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [handleViewportResize, state.isKeyboardVisible]);

  return state;
}

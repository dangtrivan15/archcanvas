/**
 * usePropertyKeyboardNav - keyboard navigation for the Properties panel in Edit mode.
 *
 * When Edit mode is active:
 * - Focus first editable field automatically
 * - Tab/Shift+Tab cycles through editable fields (wrapping around)
 * - Enter confirms current value and moves to next field (last field → exit Edit mode)
 * - Escape exits Edit mode and returns focus to canvas
 *
 * Fields are discovered via `[data-edit-field]` attribute in DOM order.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import { CanvasMode } from '@/core/input/canvasMode';

/**
 * Selector for all editable fields in the properties panel.
 * Matches inputs, selects, textareas, and toggle buttons marked with data-edit-field.
 */
const EDITABLE_FIELD_SELECTOR = '[data-edit-field]';

export function usePropertyKeyboardNav(containerRef: React.RefObject<HTMLElement | null>) {
  const canvasMode = useUIStore((s) => s.canvasMode);
  const exitToNormal = useUIStore((s) => s.exitToNormal);
  const previousMode = useRef<CanvasMode>(CanvasMode.Normal);

  /**
   * Get all editable fields in DOM order within the container.
   */
  const getEditableFields = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(EDITABLE_FIELD_SELECTOR),
    );
  }, [containerRef]);

  /**
   * Focus the first editable field when entering Edit mode.
   */
  useEffect(() => {
    if (canvasMode === CanvasMode.Edit && previousMode.current !== CanvasMode.Edit) {
      // Just entered Edit mode - focus first editable field after a frame
      requestAnimationFrame(() => {
        const fields = getEditableFields();
        if (fields.length > 0) {
          fields[0].focus();
          // Select all text if it's an input or textarea
          if (fields[0] instanceof HTMLInputElement || fields[0] instanceof HTMLTextAreaElement) {
            fields[0].select();
          }
        }
      });
    }
    previousMode.current = canvasMode;
  }, [canvasMode, getEditableFields]);

  /**
   * Handle keyboard events for field navigation within Edit mode.
   */
  useEffect(() => {
    if (canvasMode !== CanvasMode.Edit) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Only handle events within our container
      if (!container.contains(e.target as Node)) return;

      const fields = getEditableFields();
      if (fields.length === 0) return;

      const activeEl = document.activeElement as HTMLElement;
      const currentIndex = fields.indexOf(activeEl);

      // Tab / Shift+Tab: cycle through fields with wrapping
      if (e.key === 'Tab') {
        e.preventDefault();
        if (fields.length <= 1) return;

        let nextIndex: number;
        if (e.shiftKey) {
          // Shift+Tab: go backwards (wrap to end)
          nextIndex = currentIndex <= 0 ? fields.length - 1 : currentIndex - 1;
        } else {
          // Tab: go forward (wrap to start)
          nextIndex = currentIndex >= fields.length - 1 ? 0 : currentIndex + 1;
        }

        fields[nextIndex].focus();
        if (fields[nextIndex] instanceof HTMLInputElement || fields[nextIndex] instanceof HTMLTextAreaElement) {
          (fields[nextIndex] as HTMLInputElement).select();
        }
        return;
      }

      // Enter: confirm value and move to next field (or exit if last)
      if (e.key === 'Enter') {
        // Don't intercept Enter on select elements (they use Enter for their own UI)
        if (activeEl instanceof HTMLTextAreaElement) return;

        e.preventDefault();

        if (currentIndex === -1) return;

        // Blur current to trigger any onBlur handlers (confirm value)
        activeEl.blur();

        if (currentIndex >= fields.length - 1) {
          // Last field → exit Edit mode
          exitToNormal();
        } else {
          // Move to next field
          const nextField = fields[currentIndex + 1];
          requestAnimationFrame(() => {
            nextField.focus();
            if (nextField instanceof HTMLInputElement || nextField instanceof HTMLTextAreaElement) {
              nextField.select();
            }
          });
        }
        return;
      }

      // Escape within an input: blur and exit Edit mode
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        activeEl.blur();
        exitToNormal();
        return;
      }

      // Space on boolean toggle buttons
      if (e.key === ' ' && activeEl.getAttribute('role') === 'switch') {
        // Default behavior for button role="switch" already handles Space → click
        // So we just let it through (don't prevent default)
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [canvasMode, containerRef, getEditableFields, exitToNormal]);
}

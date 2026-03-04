/**
 * usePropertyKeyboardNav - keyboard navigation for the Properties panel.
 *
 * When the right panel is open:
 * - Tab/Shift+Tab cycles through editable fields (wrapping around)
 * - Enter confirms current value and moves to next field
 *
 * Fields are discovered via `[data-edit-field]` attribute in DOM order.
 */

import { useEffect, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';

/**
 * Selector for all editable fields in the properties panel.
 * Matches inputs, selects, textareas, and toggle buttons marked with data-edit-field.
 */
const EDITABLE_FIELD_SELECTOR = '[data-edit-field]';

export function usePropertyKeyboardNav(containerRef: React.RefObject<HTMLElement | null>) {
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);

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
   * Handle keyboard events for field navigation within the properties panel.
   */
  useEffect(() => {
    if (!rightPanelOpen) return;

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

        fields[nextIndex]!.focus();
        if (fields[nextIndex] instanceof HTMLInputElement || fields[nextIndex] instanceof HTMLTextAreaElement) {
          (fields[nextIndex] as HTMLInputElement).select();
        }
        return;
      }

      // Enter: confirm value and move to next field
      if (e.key === 'Enter') {
        // Don't intercept Enter on select elements (they use Enter for their own UI)
        if (activeEl instanceof HTMLTextAreaElement) return;

        e.preventDefault();

        if (currentIndex === -1) return;

        // Blur current to trigger any onBlur handlers (confirm value)
        activeEl.blur();

        if (currentIndex < fields.length - 1) {
          // Move to next field
          const nextField = fields[currentIndex + 1]!;
          requestAnimationFrame(() => {
            nextField.focus();
            if (nextField instanceof HTMLInputElement || nextField instanceof HTMLTextAreaElement) {
              nextField.select();
            }
          });
        }
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
  }, [rightPanelOpen, containerRef, getEditableFields]);
}

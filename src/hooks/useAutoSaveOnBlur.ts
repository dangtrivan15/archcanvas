/**
 * Auto-save hook that triggers save when the browser window/tab loses focus.
 * Only saves when:
 * - autosaveOnBlur preference is enabled
 * - There are unsaved changes (isDirty)
 * - No save is already in progress (isSaving)
 * - A file handle exists (can't show file picker when tab is hidden)
 *
 * Shows a brief "Autosaved" status message in the status bar after save.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';

/** How long to show the "Autosaved" status message (ms) */
const AUTOSAVE_STATUS_DURATION = 3000;

/** Minimum interval between autosaves to prevent rapid-fire (ms) */
const AUTOSAVE_DEBOUNCE_MS = 1000;

export function useAutoSaveOnBlur() {
  const autosaveOnBlur = useUIStore((s) => s.autosaveOnBlur);
  const setAutosaveStatusMessage = useUIStore((s) => s.setAutosaveStatusMessage);
  const lastAutosaveRef = useRef<number>(0);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState !== 'hidden') return;
    if (!autosaveOnBlur) return;

    const { isDirty, isSaving, fileHandle } = useCoreStore.getState();

    // Only autosave if: dirty, not already saving, and we have a file handle
    // (can't show file picker dialog when tab is hidden)
    if (!isDirty || isSaving || !fileHandle) return;

    // Debounce: don't autosave if we just saved recently
    const now = Date.now();
    if (now - lastAutosaveRef.current < AUTOSAVE_DEBOUNCE_MS) return;
    lastAutosaveRef.current = now;

    console.log('[AutoSave] Tab hidden with unsaved changes, triggering autosave...');

    useCoreStore.getState().saveFile().then((success) => {
      if (success) {
        console.log('[AutoSave] Autosave completed successfully');
        // Show brief status message
        setAutosaveStatusMessage('Autosaved');
        // Clear the status after a timeout
        if (statusTimeoutRef.current) {
          clearTimeout(statusTimeoutRef.current);
        }
        statusTimeoutRef.current = setTimeout(() => {
          setAutosaveStatusMessage(null);
          statusTimeoutRef.current = null;
        }, AUTOSAVE_STATUS_DURATION);
      }
    });
  }, [autosaveOnBlur, setAutosaveStatusMessage]);

  const handleWindowBlur = useCallback(() => {
    if (!autosaveOnBlur) return;

    const { isDirty, isSaving, fileHandle } = useCoreStore.getState();
    if (!isDirty || isSaving || !fileHandle) return;

    const now = Date.now();
    if (now - lastAutosaveRef.current < AUTOSAVE_DEBOUNCE_MS) return;
    lastAutosaveRef.current = now;

    console.log('[AutoSave] Window blur with unsaved changes, triggering autosave...');

    useCoreStore.getState().saveFile().then((success) => {
      if (success) {
        console.log('[AutoSave] Autosave completed successfully');
        setAutosaveStatusMessage('Autosaved');
        if (statusTimeoutRef.current) {
          clearTimeout(statusTimeoutRef.current);
        }
        statusTimeoutRef.current = setTimeout(() => {
          setAutosaveStatusMessage(null);
          statusTimeoutRef.current = null;
        }, AUTOSAVE_STATUS_DURATION);
      }
    });
  }, [autosaveOnBlur, setAutosaveStatusMessage]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      // Clean up any pending status timeout
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, [handleVisibilityChange, handleWindowBlur]);
}

import { useFileStore } from '../store/fileStore';

/**
 * Check for unsaved changes and prompt the user before discarding.
 * Returns true if safe to proceed (no dirty canvases or user confirmed).
 */
export async function confirmDiscardChanges(): Promise<boolean> {
  if (!useFileStore.getState().isDirty()) return true;

  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      return await ask(
        'You have unsaved changes that will be lost. Open a different project anyway?',
        { title: 'Unsaved Changes', kind: 'warning' },
      );
    } catch {
      // Dialog failed — fall through to web confirm
    }
  }

  return window.confirm(
    'You have unsaved changes that will be lost. Open a different project anyway?',
  );
}

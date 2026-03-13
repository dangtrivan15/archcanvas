import { useEffect } from 'react';
import { useFileStore } from '@/store/fileStore';

/**
 * App-level keyboard shortcuts for persistence operations.
 * These fire regardless of which component has focus, except when
 * the active element is an <input>, <textarea>, or contentEditable.
 *
 * Contracts: C10.1–C10.5
 */
export function useAppKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // C10.5: Don't fire in input/textarea/contentEditable
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.contentEditable === 'true')
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // C10.1: Cmd+S → save()
      if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        useFileStore.getState().save();
        return;
      }

      // C10.3: Cmd+Shift+S → saveAs()
      if (e.key === 's' && e.shiftKey) {
        e.preventDefault();
        useFileStore.getState().saveAs();
        return;
      }

      // C10.2: Cmd+O → open()
      if (e.key === 'o' && !e.shiftKey) {
        e.preventDefault();
        useFileStore.getState().open();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

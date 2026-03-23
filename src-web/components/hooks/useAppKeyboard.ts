import { useEffect } from 'react';
import { useFileStore } from '@/store/fileStore';
import { useUiStore } from '@/store/uiStore';

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
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+Shift+I → toggle AI chat (works even from input/textarea)
      if (mod && (e.key === 'i' || e.key === 'I') && e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().toggleChat();
        return;
      }

      // C10.5: Don't fire persistence shortcuts in input/textarea/contentEditable
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.contentEditable === 'true')
      ) {
        return;
      }

      if (!mod) return;

      // C10.1: Cmd+S → save()
      if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        useFileStore.getState().save();
        return;
      }

      // C10.2: Cmd+O → open()
      if ((e.key === 'o' || e.key === 'O') && !e.shiftKey) {
        e.preventDefault();
        useFileStore.getState().open();
        return;
      }
    };

    const handleToggleChat = () => {
      useUiStore.getState().toggleChat();
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('archcanvas:toggle-chat', handleToggleChat);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('archcanvas:toggle-chat', handleToggleChat);
    };
  }, []);
}

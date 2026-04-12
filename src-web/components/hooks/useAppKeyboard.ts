import { useEffect } from 'react';
import { useFileStore } from '@/store/fileStore';
import { useUiStore } from '@/store/uiStore';
import { toggleDiffOverlay } from '@/core/diff/orchestrator';

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

      // Cmd+Shift+] → cycle sidebar width forward (works even from input/textarea)
      if (mod && e.key === ']' && e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().cycleSidebarWidth('forward');
        return;
      }

      // Cmd+Shift+[ → cycle sidebar width backward (works even from input/textarea)
      if (mod && e.key === '[' && e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().cycleSidebarWidth('backward');
        return;
      }

      // Cmd+Shift+I → toggle AI chat (works even from input/textarea)
      if (mod && (e.key === 'i' || e.key === 'I') && e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().toggleChat();
        return;
      }

      // Cmd+Shift+E → export dialog
      if (mod && (e.key === 'e' || e.key === 'E') && e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().openExportDialog();
        return;
      }

      // Cmd+Shift+D → toggle diff overlay
      if (mod && (e.key === 'd' || e.key === 'D') && e.shiftKey) {
        e.preventDefault();
        toggleDiffOverlay();
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

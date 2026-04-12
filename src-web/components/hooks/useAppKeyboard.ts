import { useEffect } from 'react';
import { useFileStore } from '@/store/fileStore';
import { useUiStore } from '@/store/uiStore';
import { useThemeStore } from '@/store/themeStore';
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

      // UI Scale shortcuts — work globally (including in text fields).
      // In Tauri, we intercept Cmd+=/-/0 so the app controls scaling
      // instead of the webview. In a regular browser, we let native zoom
      // work normally to preserve expected accessibility behavior.
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      if (isTauri) {
        // Cmd+= or Cmd++ (Shift+=) → increase scale by 10%
        if (mod && (e.key === '=' || e.key === '+')) {
          e.preventDefault();
          const { uiScale, setUiScale } = useThemeStore.getState();
          setUiScale(uiScale + 10);
          return;
        }
        // Cmd+- → decrease scale by 10%
        if (mod && e.key === '-' && !e.shiftKey) {
          e.preventDefault();
          const { uiScale, setUiScale } = useThemeStore.getState();
          setUiScale(uiScale - 10);
          return;
        }
        // Cmd+0 → reset scale to 100%
        if (mod && e.key === '0' && !e.shiftKey) {
          e.preventDefault();
          useThemeStore.getState().setUiScale(100);
          return;
        }
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

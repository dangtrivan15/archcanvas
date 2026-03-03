/**
 * Global keyboard shortcuts hook.
 * Uses the configurable ShortcutManager to resolve key events to actions.
 * Handles file operations (Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O),
 * undo/redo (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y),
 * command palette (Ctrl+K), and help (? to toggle shortcuts panel).
 */

import { useEffect, useCallback } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { getShortcutManager } from '@/core/shortcuts/shortcutManager';

export function useKeyboardShortcuts() {
  const saveFile = useCoreStore((s) => s.saveFile);
  const saveFileAs = useCoreStore((s) => s.saveFileAs);
  const newFile = useCoreStore((s) => s.newFile);
  const openFile = useCoreStore((s) => s.openFile);
  const undo = useCoreStore((s) => s.undo);
  const redo = useCoreStore((s) => s.redo);
  const openUnsavedChangesDialog = useUIStore((s) => s.openUnsavedChangesDialog);
  const toggleShortcutsHelp = useUIStore((s) => s.toggleShortcutsHelp);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const manager = getShortcutManager();
      const actionId = manager.matchEvent(e);

      if (!actionId) return;

      // For shortcuts without mod key (like '?'), check input focus
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      switch (actionId) {
        case 'canvas:shortcuts-help':
          if (inInput) return;
          e.preventDefault();
          toggleShortcutsHelp();
          break;

        case 'canvas:command-palette':
          e.preventDefault();
          toggleCommandPalette();
          break;

        case 'file:save':
          e.preventDefault();
          saveFile();
          break;

        case 'file:save-as':
          e.preventDefault();
          saveFileAs();
          break;

        case 'file:new':
          e.preventDefault();
          {
            const isDirty = useCoreStore.getState().isDirty;
            const doNew = () => {
              newFile();
              zoomToRoot();
            };
            if (isDirty) {
              openUnsavedChangesDialog({ onConfirm: doNew });
            } else {
              doNew();
            }
          }
          break;

        case 'file:open':
          e.preventDefault();
          openFile();
          break;

        case 'edit:undo':
          e.preventDefault();
          undo();
          break;

        case 'edit:redo':
        case 'edit:redo-alt':
          e.preventDefault();
          redo();
          break;
      }
    },
    [saveFile, saveFileAs, newFile, openFile, undo, redo, openUnsavedChangesDialog, toggleShortcutsHelp, toggleCommandPalette, zoomToRoot],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

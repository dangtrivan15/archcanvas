/**
 * Global keyboard shortcuts hook.
 * Handles file operations (Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O),
 * undo/redo (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y),
 * and help (? to toggle shortcuts panel).
 */

import { useEffect, useCallback } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';

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
      // '?' key (Shift + /) toggles shortcuts help panel
      // Must check before the mod guard since '?' doesn't require Ctrl/Cmd
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't trigger when typing in an input/textarea
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        toggleShortcutsHelp();
        return;
      }

      // Use metaKey for Mac (Cmd), ctrlKey for Windows/Linux
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key.toLowerCase()) {
        case 'k':
          if (!e.shiftKey) {
            e.preventDefault();
            // Ctrl+K / Cmd+K → Toggle command palette
            toggleCommandPalette();
          }
          break;

        case 's':
          e.preventDefault();
          if (e.shiftKey) {
            // Ctrl+Shift+S → Save As
            saveFileAs();
          } else {
            // Ctrl+S → Save
            saveFile();
          }
          break;

        case 'n':
          if (!e.shiftKey) {
            e.preventDefault();
            // Ctrl+N → New file (check unsaved changes)
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

        case 'o':
          if (!e.shiftKey) {
            e.preventDefault();
            // Ctrl+O → Open file
            openFile();
          }
          break;

        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            // Ctrl+Shift+Z → Redo
            redo();
          } else {
            // Ctrl+Z → Undo
            undo();
          }
          break;

        case 'y':
          if (!e.shiftKey) {
            e.preventDefault();
            // Ctrl+Y → Redo (alternative)
            redo();
          }
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

/**
 * Global keyboard shortcuts hook.
 * Handles file operations (Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O)
 * and undo/redo (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y).
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
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Use metaKey for Mac (Cmd), ctrlKey for Windows/Linux
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key.toLowerCase()) {
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
    [saveFile, saveFileAs, newFile, openFile, undo, redo, openUnsavedChangesDialog, zoomToRoot],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

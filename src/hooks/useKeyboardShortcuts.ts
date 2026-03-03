/**
 * Global keyboard shortcuts hook.
 * Uses the configurable ShortcutManager to resolve key events to actions.
 * Uses the FocusZone system (isActiveElementTextInput) to suppress shortcuts
 * that conflict with text editing.
 * Handles file operations (Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O),
 * undo/redo (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y),
 * command palette (Ctrl+K), help (? to toggle shortcuts panel),
 * and Vim-style mode transitions (C → Connect, i/Enter → Edit, Escape → Normal).
 */

import { useEffect, useCallback } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { getShortcutManager } from '@/core/shortcuts/shortcutManager';
import { isActiveElementTextInput } from '@/core/input/focusZones';
import { isPrimaryModifier } from '@/core/input';
import { CanvasMode } from '@/core/input/canvasMode';

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
  const enterMode = useUIStore((s) => s.enterMode);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);
  const requestZoomIn = useCanvasStore((s) => s.requestZoomIn);
  const requestZoomOut = useCanvasStore((s) => s.requestZoomOut);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const requestZoom100 = useCanvasStore((s) => s.requestZoom100);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Intercept browser default zoom shortcuts (Cmd+= / Cmd+- / Cmd+0)
      // These must be caught even if ShortcutManager doesn't match them as actions,
      // because the ShortcutManager binds zoom-in to plain '=' not 'mod+='
      const key = e.key;
      if (isPrimaryModifier(e)) {
        if (key === '=' || key === '+') {
          e.preventDefault();
          requestZoomIn();
          return;
        }
        if (key === '-') {
          e.preventDefault();
          requestZoomOut();
          return;
        }
        if (key === '0') {
          e.preventDefault();
          requestFitView();
          return;
        }
        if (key === '1') {
          e.preventDefault();
          requestZoom100();
          return;
        }
      }

      // ── Vim-style mode entry shortcuts (only in Normal mode, not in text input) ──
      const inInput = isActiveElementTextInput();
      const currentMode = useUIStore.getState().canvasMode;

      if (!inInput && currentMode === CanvasMode.Normal) {
        const noModifiers = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;

        // 'C' → Enter Connect mode
        if (noModifiers && key.toLowerCase() === 'c') {
          e.preventDefault();
          enterMode(CanvasMode.Connect);
          return;
        }

        // 'i' → Enter Edit mode (requires selected node)
        if (noModifiers && key.toLowerCase() === 'i') {
          const selectedNodeId = useCanvasStore.getState().selectedNodeId;
          if (selectedNodeId) {
            e.preventDefault();
            enterMode(CanvasMode.Edit);
            useUIStore.getState().openRightPanel('properties');
            return;
          }
        }

        // Enter → Enter Edit mode (requires selected node)
        if (noModifiers && key === 'Enter') {
          const selectedNodeId = useCanvasStore.getState().selectedNodeId;
          if (selectedNodeId) {
            e.preventDefault();
            enterMode(CanvasMode.Edit);
            useUIStore.getState().openRightPanel('properties');
            return;
          }
        }
      }

      // ── Standard ShortcutManager matching ──
      const manager = getShortcutManager();
      const actionId = manager.matchEvent(e);

      if (!actionId) return;

      // Filter mode-prefixed actions by current mode
      // (normal:*, connect:*, edit:* actions are only active in their respective mode)
      if (actionId.startsWith('normal:') && currentMode !== CanvasMode.Normal) return;
      if (actionId.startsWith('connect:') && currentMode !== CanvasMode.Connect) return;
      if (actionId.startsWith('edit:') && currentMode !== CanvasMode.Edit) return;

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

        case 'node:rename':
          if (inInput) return;
          e.preventDefault();
          {
            const selectedNodeId = useCanvasStore.getState().selectedNodeId;
            if (selectedNodeId) {
              useUIStore.getState().setPendingRenameNodeId(selectedNodeId);
              useUIStore.getState().openRightPanel('properties');
            }
          }
          break;

        // View / Zoom shortcuts (plain keys, skip when typing)
        case 'view:zoom-in':
          if (inInput) return;
          e.preventDefault();
          requestZoomIn();
          break;

        case 'view:zoom-out':
          if (inInput) return;
          e.preventDefault();
          requestZoomOut();
          break;

        case 'view:fit-all':
          e.preventDefault();
          requestFitView();
          break;

        case 'view:zoom-100':
          e.preventDefault();
          requestZoom100();
          break;
      }
    },
    [saveFile, saveFileAs, newFile, openFile, undo, redo, openUnsavedChangesDialog, toggleShortcutsHelp, toggleCommandPalette, enterMode, zoomToRoot, requestZoomIn, requestZoomOut, requestFitView, requestZoom100],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

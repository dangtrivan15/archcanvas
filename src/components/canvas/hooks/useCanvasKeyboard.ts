import { useEffect } from 'react';
import { useHistoryStore } from '@/store/historyStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useFileStore } from '@/store/fileStore';
import { listNodes } from '@/core/graph/query';

interface KeyboardOptions {
  onOpenPalette?: () => void;
  onAutoLayout?: () => void;
}

export function useCanvasKeyboard(options?: KeyboardOptions) {
  const { onOpenPalette, onAutoLayout } = options ?? {};

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip all canvas shortcuts when focus is inside an input/textarea/contentEditable
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.contentEditable === 'true')
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      // Undo — Cmd+Z
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
        return;
      }

      // Redo — Cmd+Shift+Z
      if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      // Delete selection — Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useCanvasStore.getState().deleteSelection(useNavigationStore.getState().currentCanvasId);
        return;
      }

      // Command palette — Cmd+K
      if (mod && e.key === 'k') {
        e.preventDefault();
        onOpenPalette?.();
        return;
      }

      // Auto layout — Cmd+Shift+L
      if (mod && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        onAutoLayout?.();
        return;
      }

      // Select all — Cmd+A
      if (mod && e.key === 'a') {
        e.preventDefault();
        const canvasId = useNavigationStore.getState().currentCanvasId;
        const canvas = useFileStore.getState().getCanvas(canvasId);
        if (canvas) {
          const nodes = listNodes(canvas.data);
          useCanvasStore.getState().selectNodes(nodes.map((n) => n.id));
        }
        return;
      }

      // Escape — clear highlights, clear selection, or go up if nothing selected
      if (e.key === 'Escape') {
        useCanvasStore.getState().clearHighlight();
        const { selectedNodeIds, selectedEdgeKeys } = useCanvasStore.getState();
        if (selectedNodeIds.size > 0 || selectedEdgeKeys.size > 0) {
          useCanvasStore.getState().clearSelection();
        } else {
          // Dispatch navigate-up event so it goes through the transition hook
          window.dispatchEvent(new CustomEvent('archcanvas:navigate-up'));
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenPalette, onAutoLayout]);
}

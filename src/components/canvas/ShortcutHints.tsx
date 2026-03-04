/**
 * ShortcutHints - contextual floating hint panel at bottom-right of canvas.
 * Updates per context: selection (node/edge/none).
 * Toggleable with H key, persisted in localStorage.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { getShortcutManager } from '@/core/shortcuts/shortcutManager';
import { formatBindingDisplay } from '@/core/input';
import { isActiveElementTextInput } from '@/core/input/focusZones';

const STORAGE_KEY = 'archcanvas:hints-visible';

interface HintItem {
  key: string;       // display key (e.g., "⌘K")
  label: string;     // action label (e.g., "commands")
}

/**
 * Build hint items for a given context, using the user's actual shortcut bindings.
 */
function getHints(hasNode: boolean, hasEdge: boolean): HintItem[] {
  const sm = getShortcutManager();
  const fmt = (actionId: string): string => {
    const raw = sm.getBinding(actionId);
    return raw ? formatBindingDisplay(raw) : '';
  };

  if (hasEdge) {
    return [
      { key: 'T', label: 'change type' },
      { key: fmt('edit:delete') || 'Del', label: 'delete' },
      { key: fmt('canvas:deselect') || 'Esc', label: 'deselect' },
    ];
  }

  if (hasNode) {
    return [
      { key: fmt('edit:delete') || 'Del', label: 'delete' },
      { key: fmt('node:rename') || 'F2', label: 'rename' },
      { key: fmt('canvas:command-palette') || '⌘K', label: 'commands' },
    ];
  }

  // Nothing selected
  return [
    { key: fmt('canvas:command-palette') || '⌘K', label: 'commands' },
    { key: fmt('node:add-service') || 'S', label: 'service' },
    { key: fmt('node:add-database') || 'D', label: 'database' },
    { key: fmt('canvas:shortcuts-help') || '?', label: 'all shortcuts' },
    { key: 'H', label: 'hide hints' },
  ];
}

export function ShortcutHints() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);

  // Visibility state persisted in localStorage
  const [visible, setVisible] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== 'false'; // default visible
    } catch {
      return true;
    }
  });

  // Toggle visibility with H key (not in a text input)
  const toggleHints = useCallback(() => {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only toggle with H when not in a text input
      if (e.key.toLowerCase() !== 'h') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      if (isActiveElementTextInput()) return;

      e.preventDefault();
      toggleHints();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleHints]);

  const hints = useMemo(
    () => getHints(!!selectedNodeId, !!selectedEdgeId),
    [selectedNodeId, selectedEdgeId],
  );

  if (!visible) return null;

  return (
    <div
      className="z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
        bg-black/50 backdrop-blur-sm text-white/90 text-[10px] font-mono
        select-none pointer-events-none"
      data-testid="shortcut-hints"
      role="status"
      aria-label="Keyboard shortcut hints"
    >
      {hints.map((hint, i) => (
        <span key={hint.label} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-white/30 mx-0.5">|</span>}
          <kbd className="font-bold text-white">{hint.key}</kbd>
          <span className="text-white/60">{hint.label}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * ModeStatusBar - VS Code-style persistent status bar at the bottom of the canvas.
 *
 * Sections:
 * - Left: mode badge (Normal=gray, Connect=blue, Edit=green) + connect step
 * - Center: breadcrumb path (clickable to navigate)
 * - Right: contextual shortcut hints | selection count | zoom level
 *
 * Design: 28-32px height, semi-transparent, pointer-events only on interactive elements.
 * Animated mode transitions via CSS.
 * Shortcut hints are merged from the former ShortcutHints floating panel (toggleable with H key).
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useCoreStore } from '@/store/coreStore';
import { CanvasMode, MODE_DISPLAY } from '@/core/input/canvasMode';
import { getShortcutManager } from '@/core/shortcuts/shortcutManager';
import { formatBindingDisplay } from '@/core/input';
import { useViewportSize } from '@/hooks/useViewportSize';
import type { ArchNode } from '@/types/graph';

const HINTS_STORAGE_KEY = 'archcanvas:hints-visible';

// ─── Hint Item Interface ─────────────────────────────────────────

interface HintItem {
  key: string;       // display key (e.g., "C", "⌘K")
  label: string;     // action label (e.g., "connect", "commands")
}

// ─── Full Contextual Hints Logic ─────────────────────────────────

/**
 * Build hint items for a given context, using the user's actual shortcut bindings.
 * Replaces the single getContextHint with the full set from ShortcutHints.
 */
function getHints(mode: CanvasMode, hasNode: boolean, hasEdge: boolean): HintItem[] {
  const sm = getShortcutManager();
  const fmt = (actionId: string): string => {
    const raw = sm.getBinding(actionId);
    return raw ? formatBindingDisplay(raw) : '';
  };

  if (mode === CanvasMode.Connect) {
    return [
      { key: '↑↓←→', label: 'navigate' },
      { key: fmt('normal:enter-edit-alt') || 'Enter', label: 'confirm' },
      { key: '1/2/3', label: 'type' },
      { key: fmt('canvas:deselect') || 'Esc', label: 'cancel' },
    ];
  }

  if (mode === CanvasMode.Edit) {
    return [
      { key: 'Tab', label: 'next field' },
      { key: '⇧Tab', label: 'prev field' },
      { key: 'Enter', label: 'confirm' },
      { key: fmt('canvas:deselect') || 'Esc', label: 'exit' },
    ];
  }

  // Normal mode
  if (hasEdge) {
    return [
      { key: 'T', label: 'change type' },
      { key: fmt('edit:delete') || 'Del', label: 'delete' },
      { key: fmt('canvas:deselect') || 'Esc', label: 'deselect' },
    ];
  }

  if (hasNode) {
    return [
      { key: fmt('normal:enter-connect') || 'C', label: 'connect' },
      { key: fmt('normal:enter-edit') || 'i', label: 'edit' },
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

// ─── Breadcrumb Path Resolution ─────────────────────────────────

function resolvePathNames(
  nodes: ArchNode[],
  path: string[],
): { id: string; displayName: string }[] {
  const result: { id: string; displayName: string }[] = [];
  let currentNodes = nodes;

  for (const segmentId of path) {
    const node = currentNodes.find((n) => n.id === segmentId);
    if (!node) break;
    result.push({ id: node.id, displayName: node.displayName });
    currentNodes = node.children;
  }

  return result;
}

// ─── Mode Badge Colors ──────────────────────────────────────────

const MODE_BADGE_STYLES: Record<CanvasMode, { bg: string; text: string; border: string }> = {
  [CanvasMode.Normal]: {
    bg: 'bg-gray-600',
    text: 'text-white',
    border: 'border-gray-500',
  },
  [CanvasMode.Connect]: {
    bg: 'bg-blue-600',
    text: 'text-white',
    border: 'border-blue-500',
  },
  [CanvasMode.Edit]: {
    bg: 'bg-green-600',
    text: 'text-white',
    border: 'border-green-500',
  },
};

// ─── ModeStatusBar Component ────────────────────────────────────

export function ModeStatusBar() {
  // Store subscriptions
  const canvasMode = useUIStore((s) => s.canvasMode);
  const connectStep = useUIStore((s) => s.connectStep);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);
  const navigationPath = useNavigationStore((s) => s.path);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);
  const zoomToLevel = useNavigationStore((s) => s.zoomToLevel);
  const graph = useCoreStore((s) => s.graph);

  // Viewport size for responsive behavior (iPad Split View / Slide Over)
  const { isCompact } = useViewportSize();

  // Derived state
  const hasNodeSelected = !!selectedNodeId || selectedNodeIds.length > 0;
  const hasEdgeSelected = !!selectedEdgeId || selectedEdgeIds.length > 0;

  // Breadcrumb segments
  const segments = useMemo(
    () => resolvePathNames(graph.nodes, navigationPath),
    [graph.nodes, navigationPath],
  );

  // Full contextual hints (replaces the single contextHint)
  const hints = useMemo(
    () => getHints(canvasMode, hasNodeSelected, hasEdgeSelected),
    [canvasMode, hasNodeSelected, hasEdgeSelected],
  );

  // Hints visibility (toggleable with H key, persisted in localStorage)
  const [hintsVisible, setHintsVisible] = useState(() => {
    try {
      const stored = localStorage.getItem(HINTS_STORAGE_KEY);
      return stored !== 'false'; // default visible
    } catch {
      return true;
    }
  });

  const toggleHints = useCallback(() => {
    setHintsVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HINTS_STORAGE_KEY, String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'h') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const mode = useUIStore.getState().canvasMode;
      if (mode !== CanvasMode.Normal) return;

      e.preventDefault();
      toggleHints();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleHints]);

  // Mode badge style
  const badgeStyle = MODE_BADGE_STYLES[canvasMode];
  const modeDisplay = MODE_DISPLAY[canvasMode];

  // Selection summary text
  const selectionText = useMemo(() => {
    if (selectedNodeIds.length > 0 && selectedEdgeIds.length > 0) {
      return `${selectedNodeIds.length} nodes, ${selectedEdgeIds.length} edges`;
    }
    if (selectedNodeIds.length > 1) {
      return `${selectedNodeIds.length} nodes`;
    }
    if (selectedEdgeIds.length > 1) {
      return `${selectedEdgeIds.length} edges`;
    }
    if (selectedNodeIds.length === 1) {
      return '1 node';
    }
    if (selectedEdgeIds.length === 1) {
      return '1 edge';
    }
    return null;
  }, [selectedNodeIds.length, selectedEdgeIds.length]);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-40 h-[30px] flex items-center
        bg-gray-900/75 backdrop-blur-sm text-white/90 text-[11px] font-sans
        select-none pointer-events-none"
      data-testid="mode-status-bar"
      role="status"
      aria-label="Canvas status bar"
    >
      {/* ─── Left Section: Mode Badge + Connect Step ─── */}
      <div className="flex items-center gap-2 pl-2 shrink-0 min-w-0">
        {/* Mode Badge */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold
            uppercase tracking-wider border transition-all duration-300 ease-in-out
            ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
          data-testid="mode-badge"
          aria-label={`Mode: ${modeDisplay.shortLabel}`}
        >
          {modeDisplay.shortLabel}
        </span>

        {/* Connect step sub-label */}
        {canvasMode === CanvasMode.Connect && connectStep && (
          <span
            className="text-blue-300 text-[10px] font-mono transition-opacity duration-200"
            data-testid="connect-step-label"
          >
            {connectStep === 'select-source' && 'pick source'}
            {connectStep === 'select-target' && 'pick target'}
            {connectStep === 'pick-type' && '1/2/3 type'}
          </span>
        )}
      </div>

      {/* ─── Center Section: Breadcrumb Path ─── */}
      <div className="flex-1 flex items-center justify-center gap-1 min-w-0 overflow-hidden mx-2">
        {navigationPath.length > 0 && (
          <nav
            className="flex items-center gap-0.5 pointer-events-auto"
            data-testid="statusbar-breadcrumb"
            aria-label="Navigation path"
          >
            <button
              onClick={zoomToRoot}
              className="text-white/60 hover:text-white hover:underline cursor-pointer transition-colors"
              data-testid="statusbar-breadcrumb-root"
              type="button"
            >
              Root
            </button>
            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1;
              const pathToHere = navigationPath.slice(0, index + 1);

              return (
                <span key={segment.id} className="flex items-center gap-0.5">
                  <ChevronRight className="w-3 h-3 text-white/30" />
                  {isLast ? (
                    <span className="text-white font-medium truncate max-w-[120px]">
                      {segment.displayName}
                    </span>
                  ) : (
                    <button
                      onClick={() => zoomToLevel(pathToHere)}
                      className="text-white/60 hover:text-white hover:underline cursor-pointer truncate max-w-[120px] transition-colors"
                      type="button"
                    >
                      {segment.displayName}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        )}
      </div>

      {/* ─── Right Section: Shortcut Hints | Selection Count | Zoom ─── */}
      <div className="flex items-center gap-2 pr-2 min-w-0 text-white/60">
        {/* Contextual shortcut hints - hidden in compact mode (iPad Slide Over / narrow Split View) */}
        {hintsVisible && !isCompact && (
          <div
            className="flex items-center gap-1 text-[10px] font-mono overflow-hidden whitespace-nowrap min-w-0"
            data-testid="shortcut-hints"
            role="status"
            aria-label="Keyboard shortcut hints"
          >
            {hints.map((hint, i) => (
              <span key={hint.label} className="flex items-center gap-0.5 shrink-0">
                {i > 0 && <span className="text-white/30 mx-0.5">|</span>}
                <kbd className="font-bold text-white">{hint.key}</kbd>
                <span className="text-white/60">{hint.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Separator between hints and selection/zoom */}
        {hintsVisible && !isCompact && (
          <span className="text-white/20 shrink-0">|</span>
        )}

        {/* Selection count */}
        {selectionText && (
          <>
            <span
              className="text-blue-300 font-medium shrink-0 whitespace-nowrap"
              data-testid="statusbar-selection"
            >
              {selectionText}
            </span>
            <span className="text-white/20 shrink-0">|</span>
          </>
        )}

        {/* Zoom level - always visible */}
        <span className="shrink-0 whitespace-nowrap" data-testid="statusbar-zoom">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}

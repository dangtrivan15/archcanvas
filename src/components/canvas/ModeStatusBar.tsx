/**
 * ModeStatusBar - Persistent canvas status bar showing current mode,
 * zoom level, selection count, breadcrumb path, and context hint.
 * Minimal like VS Code status bar.
 */

import { useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useCoreStore } from '@/store/coreStore';
import { useNavigationStore } from '@/store/navigationStore';
import { findNode } from '@/core/graph/graphEngine';

/** Canvas interaction modes derived from UI state */
export type CanvasMode = 'NORMAL' | 'CONNECT' | 'EDIT';

/** Mode badge color config */
const MODE_CONFIG: Record<CanvasMode, { label: string; bg: string; text: string; hint: string }> = {
  NORMAL: {
    label: 'NORMAL',
    bg: 'bg-gray-500',
    text: 'text-white',
    hint: 'C to connect · F2 to edit · / to search',
  },
  CONNECT: {
    label: 'CONNECT',
    bg: 'bg-blue-500',
    text: 'text-white',
    hint: 'Click target node · Esc to cancel',
  },
  EDIT: {
    label: 'EDIT',
    bg: 'bg-green-500',
    text: 'text-white',
    hint: 'Enter to confirm · Esc to cancel',
  },
};

/**
 * Derive the current canvas mode from UI state.
 */
export function deriveCanvasMode(state: {
  connectStep: string | null;
  connectSource: string | null;
  inlineEditNodeId: string | null;
  placementMode: boolean;
}): CanvasMode {
  if (state.connectStep !== null || state.connectSource !== null) {
    return 'CONNECT';
  }
  if (state.inlineEditNodeId !== null || state.placementMode) {
    return 'EDIT';
  }
  return 'NORMAL';
}

export function ModeStatusBar() {
  // UI state for mode derivation
  const connectStep = useUIStore((s) => s.connectStep);
  const connectSource = useUIStore((s) => s.connectSource);
  const inlineEditNodeId = useUIStore((s) => s.inlineEditNodeId);
  const placementMode = useUIStore((s) => s.placementMode);

  // Canvas state
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);

  // Navigation path
  const navigationPath = useNavigationStore((s) => s.path);
  const zoomToLevel = useNavigationStore((s) => s.zoomToLevel);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);
  const graph = useCoreStore((s) => s.graph);

  // Derive mode
  const mode = deriveCanvasMode({ connectStep, connectSource, inlineEditNodeId, placementMode });
  const config = MODE_CONFIG[mode];

  // Selection count
  const selectionCount = selectedNodeIds.length + selectedEdgeIds.length;

  // Breadcrumb parts
  const breadcrumbParts = useMemo(() => {
    const parts: { label: string; path: string[] }[] = [
      { label: 'Root', path: [] },
    ];
    for (let i = 0; i < navigationPath.length; i++) {
      const nodeId = navigationPath[i] as string;
      const node = findNode(graph, nodeId);
      parts.push({
        label: node ? (node.displayName as string) : nodeId,
        path: navigationPath.slice(0, i + 1),
      });
    }
    return parts;
  }, [navigationPath, graph]);

  return (
    <div
      data-testid="mode-status-bar"
      className="flex items-center px-2 gap-2 text-xs select-none"
      style={{ height: '100%', pointerEvents: 'auto' }}
    >
      {/* Left: Mode badge */}
      <div
        data-testid="mode-badge"
        data-mode={mode}
        className={`${config.bg} ${config.text} px-2 py-0.5 rounded font-semibold text-[10px] leading-tight tracking-wider transition-all duration-200 ease-in-out`}
      >
        {config.label}
      </div>

      {/* Center: Breadcrumb path */}
      <div
        data-testid="mode-breadcrumb"
        className="flex-1 flex items-center gap-1 min-w-0 text-[hsl(var(--muted-foreground))] overflow-hidden"
      >
        {breadcrumbParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-gray-400">›</span>}
            <button
              type="button"
              className="hover:text-blue-500 hover:underline cursor-pointer transition-colors truncate max-w-[120px]"
              onClick={() => {
                if (part.path.length === 0) {
                  zoomToRoot();
                } else {
                  zoomToLevel(part.path);
                }
              }}
              title={part.label}
            >
              {part.label}
            </button>
          </span>
        ))}
      </div>

      {/* Right: Context hint */}
      <span
        data-testid="context-hint"
        className="text-[hsl(var(--muted-foreground))] text-[10px] opacity-70 shrink-0 hidden sm:inline"
      >
        {config.hint}
      </span>

      {/* Right: Zoom level */}
      <span
        data-testid="mode-zoom"
        className="text-[hsl(var(--muted-foreground))] shrink-0 tabular-nums"
      >
        {Math.round(zoom * 100)}%
      </span>

      {/* Right: Selection count */}
      {selectionCount > 0 && (
        <span
          data-testid="mode-selection-count"
          className="text-blue-500 font-medium shrink-0"
        >
          {selectionCount} {selectionCount === 1 ? 'node' : 'nodes'}
        </span>
      )}
    </div>
  );
}

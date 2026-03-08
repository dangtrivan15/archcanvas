/**
 * ModeStatusBar - Persistent canvas status bar showing current mode,
 * zoom level, selection count, breadcrumb path, and context hint.
 * Minimal like VS Code status bar.
 *
 * Also displays cross-file nesting depth when navigating into nested
 * .archc files via the nestedCanvasStore file stack.
 */

import { useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useCoreStore } from '@/store/coreStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
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

/**
 * Extract a display-friendly label from a file path.
 * "projects/backend/auth.archc" → "Auth"
 * "__root__" → "Root"
 */
export function filePathToLabel(filePath: string): string {
  if (filePath === '__root__') return 'Root';
  const basename = filePath.split('/').pop() ?? filePath;
  const name = basename.replace(/\.archc$/, '');
  // Title-case: "auth-service" → "Auth Service"
  return name
    .split(/[-_]/)
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : ''))
    .join(' ');
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

  // Navigation path (within-file fractal zoom)
  const navigationPath = useNavigationStore((s) => s.path);
  const zoomToLevel = useNavigationStore((s) => s.zoomToLevel);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);
  const graph = useCoreStore((s) => s.graph);

  // Cross-file navigation stack
  const fileStack = useNestedCanvasStore((s) => s.fileStack);
  const activeFilePath = useNestedCanvasStore((s) => s.activeFilePath);
  const popFile = useNestedCanvasStore((s) => s.popFile);
  const popToRoot = useNestedCanvasStore((s) => s.popToRoot);

  const fileDepth = fileStack.length;

  // Derive mode
  const mode = deriveCanvasMode({ connectStep, connectSource, inlineEditNodeId, placementMode });
  const config = MODE_CONFIG[mode];

  // Selection count
  const selectionCount = selectedNodeIds.length + selectedEdgeIds.length;

  // File-level breadcrumb segments (cross-file navigation)
  const fileBreadcrumbs = useMemo(() => {
    if (fileDepth === 0) return [];

    const parts: { label: string; depth: number }[] = [];

    // Each stack entry represents a saved file state
    for (let i = 0; i < fileStack.length; i++) {
      parts.push({
        label: filePathToLabel(fileStack[i]!.filePath),
        depth: i,
      });
    }

    // Add the currently active file
    if (activeFilePath) {
      parts.push({
        label: filePathToLabel(activeFilePath),
        depth: fileStack.length,
      });
    }

    return parts;
  }, [fileStack, fileDepth, activeFilePath]);

  // Within-file breadcrumb parts
  const breadcrumbParts = useMemo(() => {
    const parts: { label: string; path: string[] }[] = [{ label: 'Root', path: [] }];
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

  /**
   * Handle clicking a file-level breadcrumb segment.
   * Pops the file stack back to the clicked level.
   */
  const handleFileSegmentClick = (targetDepth: number) => {
    // If clicking the current file (last segment), do nothing
    if (targetDepth === fileDepth) return;

    if (targetDepth === 0) {
      // Pop all the way to root
      popToRoot();
    } else {
      // Pop files until we reach the target depth
      const popCount = fileDepth - targetDepth;
      for (let i = 0; i < popCount; i++) {
        popFile();
      }
    }
  };

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

      {/* Depth badge (only shown when depth > 0) */}
      {fileDepth > 0 && (
        <div
          data-testid="depth-badge"
          className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold leading-tight flex items-center gap-0.5"
          title={`Nested ${fileDepth} ${fileDepth === 1 ? 'level' : 'levels'} deep`}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
            <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
            <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
          </svg>
          D:{fileDepth}
        </div>
      )}

      {/* Center: Breadcrumb path (file-level + within-file) */}
      <div
        data-testid="mode-breadcrumb"
        className="flex-1 flex items-center gap-1 min-w-0 text-[hsl(var(--muted-foreground))] overflow-hidden"
      >
        {/* File-level breadcrumb segments */}
        {fileBreadcrumbs.map((segment, i) => {
          const isLast = i === fileBreadcrumbs.length - 1;
          return (
            <span key={`file-${i}`} className="flex items-center gap-1 shrink-0">
              {i > 0 && <span className="text-gray-400">▸</span>}
              <button
                type="button"
                data-testid={`file-breadcrumb-${i}`}
                className={`font-bold hover:text-purple-500 hover:underline cursor-pointer transition-colors truncate max-w-[120px] ${
                  isLast ? 'text-purple-400' : ''
                }`}
                onClick={() => handleFileSegmentClick(segment.depth)}
                title={segment.label}
              >
                {segment.label}
              </button>
            </span>
          );
        })}

        {/* Separator between file-level and within-file breadcrumbs */}
        {fileBreadcrumbs.length > 0 && (
          <span className="text-gray-400 mx-0.5">—</span>
        )}

        {/* Within-file breadcrumb segments */}
        {breadcrumbParts.map((part, i) => (
          <span key={`nav-${i}`} className="flex items-center gap-1 shrink-0">
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

        {/* When at root (no file nesting), show standard breadcrumbs only */}
        {fileBreadcrumbs.length === 0 &&
          breadcrumbParts.length === 0 && (
            <span className="opacity-50">Root</span>
          )}
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
        <span data-testid="mode-selection-count" className="text-blue-500 font-medium shrink-0">
          {selectionCount} {selectionCount === 1 ? 'node' : 'nodes'}
        </span>
      )}
    </div>
  );
}

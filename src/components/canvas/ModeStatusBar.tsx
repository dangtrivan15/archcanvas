/**
 * ModeStatusBar - Breadcrumb navigation section of the status bar.
 * Shows cross-file nesting depth and within-file fractal zoom path.
 * Only renders breadcrumbs when navigated into a node (hidden at root level).
 */

import { useMemo } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
import { findNode } from '@/core/graph/graphEngine';

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
        className="flex items-center gap-1 min-w-0 text-[hsl(var(--muted-foreground))] overflow-hidden"
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

        {/* Within-file breadcrumb segments (only shown when navigated into a node) */}
        {navigationPath.length > 0 && breadcrumbParts.map((part, i) => (
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
      </div>
    </div>
  );
}

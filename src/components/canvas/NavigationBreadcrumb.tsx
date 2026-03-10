/**
 * NavigationBreadcrumb - displays the current navigation path.
 * Shows file-level and within-file segments with clickable navigation:
 *   "Root File > Child File — Root > Parent > Child"
 * Positioned at the top of the canvas area.
 */

import { useMemo } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
import type { ArchNode } from '@/types/graph';

/**
 * Extract a display-friendly label from a file path.
 * "projects/backend/auth.archc" -> "Auth"
 * "__root__" -> "Root"
 */
function filePathToLabel(filePath: string): string {
  if (filePath === '__root__') return 'Root';
  const basename = filePath.split('/').pop() ?? filePath;
  const name = basename.replace(/\.archc$/, '');
  return name
    .split(/[-_]/)
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

/**
 * Resolve a navigation path (array of node IDs) into display names.
 * Traverses the graph hierarchy following the path.
 */
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

export function NavigationBreadcrumb() {
  const graph = useGraphStore((s) => s.graph);
  const path = useNavigationStore((s) => s.path);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);
  const zoomToLevel = useNavigationStore((s) => s.zoomToLevel);

  // Cross-file navigation
  const fileStack = useNestedCanvasStore((s) => s.fileStack);
  const activeFilePath = useNestedCanvasStore((s) => s.activeFilePath);
  const popFile = useNestedCanvasStore((s) => s.popFile);
  const popToRoot = useNestedCanvasStore((s) => s.popToRoot);

  const fileDepth = fileStack.length;

  // File-level breadcrumb segments
  const fileSegments = useMemo(() => {
    if (fileDepth === 0) return [];

    const parts: { label: string; depth: number }[] = [];
    for (let i = 0; i < fileStack.length; i++) {
      parts.push({
        label: filePathToLabel(fileStack[i]!.filePath),
        depth: i,
      });
    }
    if (activeFilePath) {
      parts.push({
        label: filePathToLabel(activeFilePath),
        depth: fileStack.length,
      });
    }
    return parts;
  }, [fileStack, fileDepth, activeFilePath]);

  // Within-file navigation segments
  const nodeSegments = useMemo(() => resolvePathNames(graph.nodes, path), [graph.nodes, path]);

  // Don't render if at root level with no file nesting and no navigation path
  if (path.length === 0 && fileDepth === 0) return null;

  /**
   * Handle clicking a file-level breadcrumb segment.
   */
  const handleFileSegmentClick = (targetDepth: number) => {
    if (targetDepth === fileDepth) return;
    if (targetDepth === 0) {
      popToRoot();
    } else {
      const popCount = fileDepth - targetDepth;
      for (let i = 0; i < popCount; i++) {
        popFile();
      }
    }
  };

  return (
    <div
      className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm text-sm"
      data-testid="navigation-breadcrumb"
      role="navigation"
      aria-label="Navigation breadcrumb"
    >
      {/* File-level segments (cross-file navigation) */}
      {fileSegments.map((segment, index) => {
        const isLastFile = index === fileSegments.length - 1;
        return (
          <span
            key={`file-${index}`}
            className="flex items-center gap-1"
            data-testid={`breadcrumb-file-${index}`}
          >
            {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
            {index === 0 && <Layers className="w-3.5 h-3.5 text-purple-500 shrink-0" />}
            {isLastFile && path.length === 0 ? (
              <span className="text-purple-700 font-medium">{segment.label}</span>
            ) : (
              <button
                onClick={() => handleFileSegmentClick(segment.depth)}
                className="text-purple-600 hover:text-purple-800 hover:underline font-medium cursor-pointer"
                type="button"
              >
                {segment.label}
              </button>
            )}
          </span>
        );
      })}

      {/* Separator between file-level and within-file segments */}
      {fileSegments.length > 0 && path.length > 0 && (
        <span className="text-gray-300 mx-0.5">&mdash;</span>
      )}

      {/* Root segment (within-file navigation) */}
      {path.length > 0 && (
        <button
          onClick={zoomToRoot}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
          data-testid="breadcrumb-root"
          type="button"
        >
          Root
        </button>
      )}

      {/* Within-file path segments */}
      {nodeSegments.map((segment, index) => {
        const isLast = index === nodeSegments.length - 1;
        const pathToHere = path.slice(0, index + 1);

        return (
          <span
            key={segment.id}
            className="flex items-center gap-1"
            data-testid={`breadcrumb-segment-${index}`}
          >
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            {isLast ? (
              <span className="text-gray-900 font-medium">{segment.displayName}</span>
            ) : (
              <button
                onClick={() => zoomToLevel(pathToHere)}
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                type="button"
              >
                {segment.displayName}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

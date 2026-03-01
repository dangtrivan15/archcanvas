/**
 * NavigationBreadcrumb - displays the current fractal zoom path.
 * Shows "Root > Parent > Child" with clickable segments for quick navigation.
 * Positioned at the top of the canvas area.
 */

import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useNavigationStore } from '@/store/navigationStore';
import type { ArchNode } from '@/types/graph';

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
  const graph = useCoreStore((s) => s.graph);
  const path = useNavigationStore((s) => s.path);
  const zoomToRoot = useNavigationStore((s) => s.zoomToRoot);
  const zoomToLevel = useNavigationStore((s) => s.zoomToLevel);

  // Resolve path node IDs to display names
  const segments = useMemo(
    () => resolvePathNames(graph.nodes, path),
    [graph.nodes, path],
  );

  // Don't render if at root level (no navigation path)
  if (path.length === 0) return null;

  return (
    <div
      className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm text-sm"
      data-testid="navigation-breadcrumb"
      role="navigation"
      aria-label="Navigation breadcrumb"
    >
      {/* Root segment */}
      <button
        onClick={zoomToRoot}
        className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
        data-testid="breadcrumb-root"
        type="button"
      >
        Root
      </button>

      {/* Path segments */}
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const pathToHere = path.slice(0, index + 1);

        return (
          <span key={segment.id} className="flex items-center gap-1" data-testid={`breadcrumb-segment-${index}`}>
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

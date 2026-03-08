/**
 * useChildGraph - Hook for lazily loading child .archc graph data.
 *
 * Used by ContainerNode to load the child graph referenced by its refSource.
 * Integrates with the projectStore to load files from the project directory,
 * with caching to avoid re-reads. Returns loading/error/data states for
 * rendering the MiniCanvasPreview.
 */

import { useState, useEffect, useRef } from 'react';
import type { ArchGraph } from '@/types/graph';
import { useProjectStore } from '@/store/projectStore';

export interface ChildGraphState {
  /** The loaded child graph, or null if not yet loaded */
  graph: ArchGraph | null;
  /** Whether the graph is currently being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
}

/**
 * Extract a relative file path from a refSource string.
 * Supports patterns like 'file://./child-system.archc' or plain paths.
 */
function extractFilePath(refSource?: string, filePathArg?: string): string | null {
  const raw = refSource || filePathArg;
  if (!raw) return null;

  // Strip 'file://' prefix and leading './'
  return raw.replace(/^file:\/\//, '').replace(/^\.\//, '');
}

/**
 * Hook that lazily loads a child .archc graph for preview rendering.
 *
 * @param refSource - The node's refSource field (e.g., 'file://./child.archc')
 * @param filePathArg - Fallback file path from node args
 * @returns ChildGraphState with graph data, loading, and error states
 *
 * @example
 * ```tsx
 * const { graph, loading, error } = useChildGraph(nodeData.refSource, nodeData.args?.filePath);
 * if (loading) return <Skeleton />;
 * if (graph) return <MiniCanvasPreview nodes={graph.nodes} edges={graph.edges} />;
 * ```
 */
export function useChildGraph(refSource?: string, filePathArg?: string): ChildGraphState {
  const [state, setState] = useState<ChildGraphState>({
    graph: null,
    loading: false,
    error: null,
  });

  const isProjectOpen = useProjectStore((s) => s.isProjectOpen);
  const loadFile = useProjectStore((s) => s.loadFile);
  const getLoadedFile = useProjectStore((s) => s.getLoadedFile);

  // Track the current request to avoid stale updates
  const requestIdRef = useRef(0);

  const filePath = extractFilePath(refSource, filePathArg as string | undefined);

  useEffect(() => {
    if (!filePath || !isProjectOpen) {
      setState({ graph: null, loading: false, error: null });
      return;
    }

    // Check if already cached
    const cached = getLoadedFile(filePath);
    if (cached) {
      setState({ graph: cached.graph, loading: false, error: null });
      return;
    }

    // Start loading
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    loadFile(filePath)
      .then((entry) => {
        // Only update if this is still the latest request
        if (requestIdRef.current === requestId) {
          setState({ graph: entry.graph, loading: false, error: null });
        }
      })
      .catch((err) => {
        if (requestIdRef.current === requestId) {
          setState({
            graph: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load child graph',
          });
        }
      });
  }, [filePath, isProjectOpen, loadFile, getLoadedFile]);

  return state;
}

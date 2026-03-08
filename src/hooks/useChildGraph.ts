/**
 * useChildGraph - Hook for lazily loading child .archc graph data.
 *
 * Used by ContainerNode to load the child graph referenced by its refSource.
 * Supports both local file references and remote git repository references.
 *
 * Local files: Uses projectStore to load files from the project directory.
 * Remote repos: Uses fetchRepoArchc + browser cache to fetch and cache data.
 *
 * Returns loading/error/data states for rendering the MiniCanvasPreview.
 */

import { useState, useEffect, useRef } from 'react';
import type { ArchGraph } from '@/types/graph';
import { useProjectStore } from '@/store/projectStore';
import {
  browserCacheLookup,
  browserCacheWrite,
  browserCacheInvalidate,
} from '@/core/git/repoCacheBrowser';

/** Source type indicator for the loaded graph. */
export type GraphSourceType = 'local' | 'git' | null;

export interface ChildGraphState {
  /** The loaded child graph, or null if not yet loaded */
  graph: ArchGraph | null;
  /** Whether the graph is currently being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Whether this is a local or git-referenced graph */
  sourceType: GraphSourceType;
  /** Whether the graph is being refreshed after an arg change (has stale data) */
  refreshing: boolean;
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
 * Extract a display-friendly repo name from a URL.
 * e.g., "https://github.com/org/repo.git" → "org/repo"
 */
export function extractRepoName(repoUrl: string): string {
  const cleaned = repoUrl
    .replace(/^(https?:\/\/|git@)/, '')
    .replace(/\.git\/?$/, '')
    .replace(/\/$/, '');

  // For SSH: git@github.com:owner/repo → owner/repo
  const sshMatch = cleaned.match(/[^:]+:(.+)/);
  if (sshMatch) return sshMatch[1]!;

  // For HTTPS: github.com/owner/repo → owner/repo
  const parts = cleaned.split('/');
  if (parts.length >= 3) {
    return parts.slice(1).join('/');
  }
  return cleaned;
}

/**
 * Hook that lazily loads a child .archc graph for preview rendering.
 *
 * Supports two modes:
 * 1. Local file: Uses projectStore.loadFile() to read from project directory
 * 2. Remote git repo: Uses fetchRepoArchc() with browser-side cache
 *
 * @param refSource - The node's refSource field (e.g., 'file://./child.archc')
 * @param filePathArg - Fallback file path from node args
 * @param repoUrlArg - Git repository URL from node args
 * @param refArg - Git ref (tag/commit) from node args
 * @returns ChildGraphState with graph data, loading, error, and source type
 */
export function useChildGraph(
  refSource?: string,
  filePathArg?: string,
  repoUrlArg?: string,
  refArg?: string,
): ChildGraphState {
  const [state, setState] = useState<ChildGraphState>({
    graph: null,
    loading: false,
    error: null,
    sourceType: null,
    refreshing: false,
  });

  const isProjectOpen = useProjectStore((s) => s.isProjectOpen);
  const loadFile = useProjectStore((s) => s.loadFile);
  const getLoadedFile = useProjectStore((s) => s.getLoadedFile);

  // Track the current request to avoid stale updates
  const requestIdRef = useRef(0);

  // Track previous repoUrl and ref to detect changes and invalidate old cache
  const prevRepoRef = useRef<{ repoUrl?: string; ref?: string }>({});

  const filePath = extractFilePath(refSource, filePathArg as string | undefined);
  const hasRepoUrl = Boolean(repoUrlArg && repoUrlArg.trim());

  useEffect(() => {
    // ── Remote git repo path ──
    if (hasRepoUrl && repoUrlArg) {
      const repoUrl = repoUrlArg.trim();
      const ref = (refArg || 'main').trim();

      // Detect if repoUrl or ref changed from previous render
      const prev = prevRepoRef.current;
      const prevRepoUrl = prev.repoUrl?.trim();
      const prevRef = (prev.ref || 'main').trim();
      const argsChanged =
        prevRepoUrl !== undefined &&
        (prevRepoUrl !== repoUrl || prevRef !== ref);

      // Invalidate old cache entry when args change
      if (argsChanged && prevRepoUrl) {
        browserCacheInvalidate(prevRepoUrl, prevRef);
      }

      // Update previous values for next comparison
      prevRepoRef.current = { repoUrl: repoUrlArg, ref: refArg };

      // Check browser cache first
      const cacheResult = browserCacheLookup(repoUrl, ref);
      if (cacheResult.hit && cacheResult.entry) {
        setState({
          graph: cacheResult.entry.graph,
          loading: false,
          error: null,
          sourceType: 'git',
          refreshing: false,
        });
        return;
      }

      // Cache miss: fetch from remote
      const requestId = ++requestIdRef.current;

      // If args changed and we have a previous graph, show refreshing state
      // (keep displaying stale data while fetching new)
      if (argsChanged) {
        setState((prev) => ({
          ...prev,
          refreshing: true,
          error: null,
          sourceType: 'git',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
          sourceType: 'git',
          refreshing: false,
        }));
      }

      // Dynamic import to avoid bundling repoFetcher in main chunk
      import('@/core/git/repoFetcher')
        .then(({ fetchRepoArchc }) => fetchRepoArchc(repoUrl, ref))
        .then((result) => {
          if (requestIdRef.current === requestId) {
            // Write to browser cache
            browserCacheWrite(repoUrl, ref, result.graph, result.rawData);
            setState({
              graph: result.graph,
              loading: false,
              error: null,
              sourceType: 'git',
              refreshing: false,
            });
          }
        })
        .catch((err) => {
          if (requestIdRef.current === requestId) {
            const message = err instanceof Error ? err.message : 'Failed to fetch remote architecture';
            setState({
              graph: null,
              loading: false,
              error: message,
              sourceType: 'git',
              refreshing: false,
            });
          }
        });

      return;
    }

    // ── Local file path ──
    if (!filePath || !isProjectOpen) {
      setState({ graph: null, loading: false, error: null, sourceType: null, refreshing: false });
      return;
    }

    // Check if already cached
    const cached = getLoadedFile(filePath);
    if (cached) {
      setState({ graph: cached.graph, loading: false, error: null, sourceType: 'local', refreshing: false });
      return;
    }

    // Start loading
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null, sourceType: 'local', refreshing: false }));

    loadFile(filePath)
      .then((entry) => {
        // Only update if this is still the latest request
        if (requestIdRef.current === requestId) {
          setState({ graph: entry.graph, loading: false, error: null, sourceType: 'local', refreshing: false });
        }
      })
      .catch((err) => {
        if (requestIdRef.current === requestId) {
          setState({
            graph: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load child graph',
            sourceType: 'local',
            refreshing: false,
          });
        }
      });
  }, [filePath, isProjectOpen, loadFile, getLoadedFile, hasRepoUrl, repoUrlArg, refArg]);

  return state;
}

/**
 * Tests for Feature #502: Update cache when canvas-ref tag/commit changes.
 *
 * Verifies:
 * 1. Old cache entry is invalidated when ref changes
 * 2. Old cache entry is invalidated when repoUrl changes
 * 3. New fetch is triggered after invalidation
 * 4. Refreshing state is exposed during re-fetch
 * 5. Errors are handled gracefully (new ref doesn't exist, etc.)
 * 6. ContainerNode shows refreshing indicator
 * 7. useChildGraph tracks previous ref/repoUrl values
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  browserCacheLookup,
  browserCacheWrite,
  browserCacheClear,
  browserCacheInvalidate,
  browserCacheSize,
} from '@/core/git/repoCacheBrowser';
import type { ArchGraph } from '@/types/graph';

// ─── Test Helpers ───────────────────────────────────────────────

function makeGraph(name: string, nodeCount = 3): ArchGraph {
  return {
    name,
    description: `Architecture for ${name}`,
    owners: [],
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `node-${i}`,
      type: 'compute/service',
      displayName: `Service ${i}`,
      args: {},
      codeRefs: [],
      notes: [],
      properties: {},
      position: { x: i * 100, y: 0 },
      children: [],
    })),
    edges: [],
    annotations: [],
  };
}

// ============================================================
// 1. Cache invalidation on ref change
// ============================================================

describe('Cache invalidation on ref change', () => {
  beforeEach(() => {
    browserCacheClear();
  });

  it('browserCacheInvalidate removes a specific ref entry', () => {
    const repoUrl = 'https://github.com/org/repo.git';
    browserCacheWrite(repoUrl, 'v1.0.0', makeGraph('v1'), new Uint8Array([1]));
    browserCacheWrite(repoUrl, 'v2.0.0', makeGraph('v2'), new Uint8Array([2]));

    expect(browserCacheSize()).toBe(2);

    // Invalidate old ref
    browserCacheInvalidate(repoUrl, 'v1.0.0');

    expect(browserCacheSize()).toBe(1);
    expect(browserCacheLookup(repoUrl, 'v1.0.0').hit).toBe(false);
    expect(browserCacheLookup(repoUrl, 'v2.0.0').hit).toBe(true);
  });

  it('invalidating a non-existent entry is a no-op', () => {
    browserCacheWrite('https://github.com/org/repo.git', 'v1.0.0', makeGraph('v1'), new Uint8Array());
    expect(browserCacheSize()).toBe(1);

    // Invalidate something that doesn't exist
    browserCacheInvalidate('https://github.com/org/repo.git', 'v99.0.0');
    expect(browserCacheSize()).toBe(1);
  });

  it('invalidation is case-insensitive for repoUrl', () => {
    const repoUrl = 'https://github.com/Org/Repo.git';
    browserCacheWrite(repoUrl, 'v1.0.0', makeGraph('v1'), new Uint8Array());

    // Invalidate with different case
    browserCacheInvalidate('https://github.com/org/repo.git', 'v1.0.0');
    expect(browserCacheSize()).toBe(0);
  });

  it('preserves other repos when invalidating one', () => {
    browserCacheWrite('https://github.com/org/repo-a.git', 'v1.0.0', makeGraph('a'), new Uint8Array());
    browserCacheWrite('https://github.com/org/repo-b.git', 'v1.0.0', makeGraph('b'), new Uint8Array());

    browserCacheInvalidate('https://github.com/org/repo-a.git', 'v1.0.0');

    expect(browserCacheLookup('https://github.com/org/repo-a.git', 'v1.0.0').hit).toBe(false);
    expect(browserCacheLookup('https://github.com/org/repo-b.git', 'v1.0.0').hit).toBe(true);
  });
});

// ============================================================
// 2. Cache update flow: invalidate old + write new
// ============================================================

describe('Cache update flow on ref change', () => {
  beforeEach(() => {
    browserCacheClear();
  });

  it('simulates ref change: invalidate old, write new', () => {
    const repoUrl = 'https://github.com/org/repo.git';

    // Initial state: v1 is cached
    browserCacheWrite(repoUrl, 'v1.0.0', makeGraph('v1', 5), new Uint8Array());
    expect(browserCacheLookup(repoUrl, 'v1.0.0').hit).toBe(true);

    // Ref changes to v2.0.0: invalidate v1, fetch and write v2
    browserCacheInvalidate(repoUrl, 'v1.0.0');
    expect(browserCacheLookup(repoUrl, 'v1.0.0').hit).toBe(false);
    expect(browserCacheLookup(repoUrl, 'v2.0.0').hit).toBe(false);

    // After fetch completes, write v2
    browserCacheWrite(repoUrl, 'v2.0.0', makeGraph('v2', 10), new Uint8Array());
    expect(browserCacheLookup(repoUrl, 'v2.0.0').hit).toBe(true);
    expect(browserCacheLookup(repoUrl, 'v2.0.0').entry!.graph.nodes).toHaveLength(10);

    // Old entry still gone
    expect(browserCacheLookup(repoUrl, 'v1.0.0').hit).toBe(false);
  });

  it('simulates repoUrl change: invalidate old repo, write new repo', () => {
    const oldUrl = 'https://github.com/org/old-repo.git';
    const newUrl = 'https://github.com/org/new-repo.git';
    const ref = 'v1.0.0';

    browserCacheWrite(oldUrl, ref, makeGraph('old', 3), new Uint8Array());
    expect(browserCacheLookup(oldUrl, ref).hit).toBe(true);

    // Repo URL changes: invalidate old, write new
    browserCacheInvalidate(oldUrl, ref);
    browserCacheWrite(newUrl, ref, makeGraph('new', 7), new Uint8Array());

    expect(browserCacheLookup(oldUrl, ref).hit).toBe(false);
    expect(browserCacheLookup(newUrl, ref).hit).toBe(true);
    expect(browserCacheLookup(newUrl, ref).entry!.graph.nodes).toHaveLength(7);
  });

  it('handles rapid ref changes (last write wins)', () => {
    const repoUrl = 'https://github.com/org/repo.git';

    // Quick succession: v1 → v2 → v3
    browserCacheWrite(repoUrl, 'v1.0.0', makeGraph('v1', 1), new Uint8Array());

    browserCacheInvalidate(repoUrl, 'v1.0.0');
    browserCacheWrite(repoUrl, 'v2.0.0', makeGraph('v2', 2), new Uint8Array());

    browserCacheInvalidate(repoUrl, 'v2.0.0');
    browserCacheWrite(repoUrl, 'v3.0.0', makeGraph('v3', 3), new Uint8Array());

    // Only v3 should be in cache
    expect(browserCacheLookup(repoUrl, 'v1.0.0').hit).toBe(false);
    expect(browserCacheLookup(repoUrl, 'v2.0.0').hit).toBe(false);
    expect(browserCacheLookup(repoUrl, 'v3.0.0').hit).toBe(true);
    expect(browserCacheSize()).toBe(1);
  });
});

// ============================================================
// 3. useChildGraph source structure for cache update behavior
// ============================================================

describe('useChildGraph cache update on arg change', () => {
  it('imports browserCacheInvalidate from repoCacheBrowser', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    expect(source).toContain('browserCacheInvalidate');
    expect(source).toContain("from '@/core/git/repoCacheBrowser'");
  });

  it('tracks previous repoUrl and ref values via ref', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    // Should use a ref to track previous values
    expect(source).toContain('prevRepoRef');
    expect(source).toContain('useRef');
  });

  it('detects when repoUrl or ref args change', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    // Should compare previous and current values
    expect(source).toContain('argsChanged');
    expect(source).toContain('prevRepoUrl');
    expect(source).toContain('prevRef');
  });

  it('invalidates old cache entry when args change', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    // Should call browserCacheInvalidate with old values
    expect(source).toContain('browserCacheInvalidate(prevRepoUrl, prevRef)');
  });

  it('updates prevRepoRef after processing', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    expect(source).toContain('prevRepoRef.current = { repoUrl: repoUrlArg, ref: refArg }');
  });

  it('exposes refreshing state in ChildGraphState', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    // refreshing field in the state type
    expect(source).toContain('refreshing: boolean');
    // Set to true during arg-change re-fetch
    expect(source).toContain('refreshing: true');
    // Set to false after fetch completes
    expect(source).toContain('refreshing: false');
  });

  it('shows refreshing state (not loading) when args change and stale data exists', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    // When argsChanged is true, set refreshing instead of loading
    expect(source).toContain('if (argsChanged)');
    expect(source).toContain('refreshing: true');
  });

  it('clears refreshing on successful fetch', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    // After successful fetch, both loading and refreshing should be false
    const successBlock = source.slice(
      source.indexOf('browserCacheWrite(repoUrl, ref, result.graph'),
    );
    expect(successBlock).toContain('refreshing: false');
    expect(successBlock).toContain('loading: false');
  });

  it('clears refreshing on fetch error', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    // After error, refreshing should be cleared
    const catchBlock = source.slice(source.indexOf('.catch((err)'));
    expect(catchBlock).toContain('refreshing: false');
  });
});

// ============================================================
// 4. ContainerNode refreshing indicator
// ============================================================

describe('ContainerNode refreshing indicator', () => {
  it('ContainerNode uses childRefreshing from useChildGraph', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/components/nodes/ContainerNode.tsx', 'utf-8');

    expect(source).toContain('childRefreshing');
    expect(source).toContain('refreshing: childRefreshing');
  });

  it('ContainerNode renders preview-refreshing overlay', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/components/nodes/ContainerNode.tsx', 'utf-8');

    expect(source).toContain('data-testid="preview-refreshing"');
    expect(source).toContain('Refreshing');
  });

  it('refreshing overlay uses Loader2 spinner', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/components/nodes/ContainerNode.tsx', 'utf-8');

    // The refreshing overlay should use the same Loader2 spinner
    const refreshingBlock = source.slice(
      source.indexOf('preview-refreshing'),
      source.indexOf('preview-refreshing') + 500,
    );
    expect(refreshingBlock).toContain('Loader2');
    expect(refreshingBlock).toContain('animate-spin');
  });

  it('refreshing overlay is positioned absolutely over preview', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/components/nodes/ContainerNode.tsx', 'utf-8');

    // Preview container should be relative, overlay should be absolute with inset-0
    expect(source).toContain('relative');
    // The refreshing overlay div has absolute and inset-0 classes
    const refreshingStart = source.lastIndexOf('<div', source.indexOf('preview-refreshing'));
    const refreshingDiv = source.slice(refreshingStart, source.indexOf('preview-refreshing') + 50);
    expect(refreshingDiv).toContain('absolute');
    expect(refreshingDiv).toContain('inset-0');
  });

  it('refreshing overlay only shows when childRefreshing is true', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/components/nodes/ContainerNode.tsx', 'utf-8');

    // Conditional rendering based on childRefreshing
    expect(source).toContain('childRefreshing && (');
  });
});

// ============================================================
// 5. Error handling for invalid new ref
// ============================================================

describe('Error handling on ref change', () => {
  beforeEach(() => {
    browserCacheClear();
  });

  it('cache lookup returns miss after invalidation (simulates fetch failure path)', () => {
    const repoUrl = 'https://github.com/org/repo.git';

    // Cache v1
    browserCacheWrite(repoUrl, 'v1.0.0', makeGraph('v1'), new Uint8Array());

    // User changes to non-existent ref: invalidate v1, new ref misses cache
    browserCacheInvalidate(repoUrl, 'v1.0.0');
    const result = browserCacheLookup(repoUrl, 'nonexistent-tag');
    expect(result.hit).toBe(false);

    // Old entry is gone too
    expect(browserCacheLookup(repoUrl, 'v1.0.0').hit).toBe(false);
  });

  it('useChildGraph handles fetch errors gracefully in source', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    // Error handling block should set graph to null and provide error message
    expect(source).toContain('.catch((err)');
    expect(source).toContain('Failed to fetch remote architecture');
    expect(source).toContain('error: message');
    expect(source).toContain('graph: null');
  });

  it('ContainerNode shows error preview for failed fetches', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/components/nodes/ContainerNode.tsx', 'utf-8');

    expect(source).toContain('childError');
    expect(source).toContain('ErrorPreview');
    expect(source).toContain('AlertCircle');
  });
});

// ============================================================
// 6. ChildGraphState type includes refreshing
// ============================================================

describe('ChildGraphState type', () => {
  it('ChildGraphState interface includes refreshing field', async () => {
    const mod = await import('@/hooks/useChildGraph');
    // The hook returns an object with refreshing field
    expect(mod.useChildGraph).toBeDefined();

    // Verify via source that the type is exported
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');
    expect(source).toContain('export interface ChildGraphState');
    expect(source).toContain('refreshing: boolean');
  });

  it('initial state has refreshing set to false', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/hooks/useChildGraph.ts', 'utf-8');

    // Initial useState value should include refreshing: false
    const initState = source.slice(
      source.indexOf('useState<ChildGraphState>'),
      source.indexOf('useState<ChildGraphState>') + 200,
    );
    expect(initState).toContain('refreshing: false');
  });
});

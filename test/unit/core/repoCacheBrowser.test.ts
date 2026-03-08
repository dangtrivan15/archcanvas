/**
 * Tests for the browser-compatible in-memory cache for remote .archc files.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  browserCacheLookup,
  browserCacheWrite,
  browserCacheInvalidate,
  browserCacheClear,
  browserCacheSize,
} from '@/core/git/repoCacheBrowser';
import type { ArchGraph } from '@/types/graph';

// ─── Test Helpers ───────────────────────────────────────────────

function makeGraph(name: string, nodeCount = 2): ArchGraph {
  return {
    name,
    description: `Test graph: ${name}`,
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

const REPO_URL = 'https://github.com/org/repo.git';
const REF = 'v1.0.0';
const RAW_DATA = new Uint8Array([1, 2, 3, 4]);

// ─── Tests ──────────────────────────────────────────────────────

describe('repoCacheBrowser', () => {
  beforeEach(() => {
    browserCacheClear();
  });

  describe('browserCacheLookup', () => {
    it('returns miss for empty cache', () => {
      const result = browserCacheLookup(REPO_URL, REF);
      expect(result.hit).toBe(false);
      expect(result.entry).toBeUndefined();
    });

    it('returns hit after write', () => {
      const graph = makeGraph('test');
      browserCacheWrite(REPO_URL, REF, graph, RAW_DATA);

      const result = browserCacheLookup(REPO_URL, REF);
      expect(result.hit).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry!.graph.name).toBe('test');
      expect(result.entry!.rawData).toEqual(RAW_DATA);
      expect(result.entry!.repoUrl).toBe(REPO_URL);
      expect(result.entry!.ref).toBe(REF);
    });

    it('returns miss for different ref', () => {
      browserCacheWrite(REPO_URL, REF, makeGraph('test'), RAW_DATA);

      const result = browserCacheLookup(REPO_URL, 'v2.0.0');
      expect(result.hit).toBe(false);
    });

    it('returns miss for different repo URL', () => {
      browserCacheWrite(REPO_URL, REF, makeGraph('test'), RAW_DATA);

      const result = browserCacheLookup('https://github.com/other/repo.git', REF);
      expect(result.hit).toBe(false);
    });

    it('updates lastAccessedAt on hit', () => {
      browserCacheWrite(REPO_URL, REF, makeGraph('test'), RAW_DATA);

      const first = browserCacheLookup(REPO_URL, REF);
      const firstAccess = first.entry!.lastAccessedAt;

      // Small delay to ensure different timestamp
      const second = browserCacheLookup(REPO_URL, REF);
      expect(second.entry!.lastAccessedAt.getTime()).toBeGreaterThanOrEqual(firstAccess.getTime());
    });

    it('is case-insensitive for repo URL', () => {
      browserCacheWrite('HTTPS://GITHUB.COM/ORG/REPO.GIT', REF, makeGraph('test'), RAW_DATA);

      const result = browserCacheLookup('https://github.com/org/repo.git', REF);
      expect(result.hit).toBe(true);
    });
  });

  describe('browserCacheWrite', () => {
    it('stores graph and raw data', () => {
      const graph = makeGraph('write-test', 3);
      browserCacheWrite(REPO_URL, REF, graph, RAW_DATA);

      const result = browserCacheLookup(REPO_URL, REF);
      expect(result.entry!.graph.nodes).toHaveLength(3);
      expect(result.entry!.graph.description).toBe('Test graph: write-test');
    });

    it('overwrites existing entry', () => {
      browserCacheWrite(REPO_URL, REF, makeGraph('first'), RAW_DATA);
      browserCacheWrite(REPO_URL, REF, makeGraph('second'), RAW_DATA);

      const result = browserCacheLookup(REPO_URL, REF);
      expect(result.entry!.graph.name).toBe('second');
      expect(browserCacheSize()).toBe(1);
    });

    it('stores multiple entries for different refs', () => {
      browserCacheWrite(REPO_URL, 'v1.0.0', makeGraph('v1'), RAW_DATA);
      browserCacheWrite(REPO_URL, 'v2.0.0', makeGraph('v2'), RAW_DATA);

      expect(browserCacheSize()).toBe(2);
      expect(browserCacheLookup(REPO_URL, 'v1.0.0').entry!.graph.name).toBe('v1');
      expect(browserCacheLookup(REPO_URL, 'v2.0.0').entry!.graph.name).toBe('v2');
    });
  });

  describe('browserCacheInvalidate', () => {
    it('removes a specific entry', () => {
      browserCacheWrite(REPO_URL, REF, makeGraph('test'), RAW_DATA);
      expect(browserCacheSize()).toBe(1);

      browserCacheInvalidate(REPO_URL, REF);
      expect(browserCacheSize()).toBe(0);
      expect(browserCacheLookup(REPO_URL, REF).hit).toBe(false);
    });

    it('no-op for non-existent entry', () => {
      browserCacheInvalidate(REPO_URL, REF);
      expect(browserCacheSize()).toBe(0);
    });

    it('does not affect other entries', () => {
      browserCacheWrite(REPO_URL, 'v1.0.0', makeGraph('v1'), RAW_DATA);
      browserCacheWrite(REPO_URL, 'v2.0.0', makeGraph('v2'), RAW_DATA);

      browserCacheInvalidate(REPO_URL, 'v1.0.0');
      expect(browserCacheSize()).toBe(1);
      expect(browserCacheLookup(REPO_URL, 'v2.0.0').hit).toBe(true);
    });
  });

  describe('browserCacheClear', () => {
    it('removes all entries', () => {
      browserCacheWrite(REPO_URL, 'v1', makeGraph('a'), RAW_DATA);
      browserCacheWrite(REPO_URL, 'v2', makeGraph('b'), RAW_DATA);
      browserCacheWrite('https://github.com/other/repo.git', 'v1', makeGraph('c'), RAW_DATA);

      expect(browserCacheSize()).toBe(3);
      browserCacheClear();
      expect(browserCacheSize()).toBe(0);
    });
  });

  describe('browserCacheSize', () => {
    it('returns 0 for empty cache', () => {
      expect(browserCacheSize()).toBe(0);
    });

    it('reflects correct count after writes', () => {
      browserCacheWrite(REPO_URL, 'v1', makeGraph('a'), RAW_DATA);
      expect(browserCacheSize()).toBe(1);
      browserCacheWrite(REPO_URL, 'v2', makeGraph('b'), RAW_DATA);
      expect(browserCacheSize()).toBe(2);
    });
  });
});

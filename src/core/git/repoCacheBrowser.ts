/**
 * Browser-compatible in-memory cache for remote .archc files.
 *
 * Unlike repoCache.ts (which uses Node.js filesystem APIs), this module
 * stores cached data in a Map for use in the browser environment.
 *
 * Cache key: `${repoUrl}@${ref}`
 * Used by useChildGraph hook when a canvas-ref node has a repoUrl arg.
 */

import type { ArchGraph } from '@/types/graph';

// ─── Types ──────────────────────────────────────────────────────

/** Cached entry for a remote .archc file. */
export interface BrowserCacheEntry {
  /** The parsed architecture graph */
  graph: ArchGraph;
  /** The raw .archc binary data */
  rawData: Uint8Array;
  /** When the entry was fetched */
  fetchedAt: Date;
  /** When the entry was last accessed */
  lastAccessedAt: Date;
  /** The repo URL */
  repoUrl: string;
  /** The git ref (tag or commit SHA) */
  ref: string;
}

/** Result of a cache lookup. */
export interface BrowserCacheLookupResult {
  /** Whether the entry was found in cache */
  hit: boolean;
  /** The cached entry (only present on hit) */
  entry?: BrowserCacheEntry;
}

// ─── Cache Store ────────────────────────────────────────────────

/** In-memory cache Map */
const cache = new Map<string, BrowserCacheEntry>();

/** Build a cache key from repo URL and ref */
function cacheKey(repoUrl: string, ref: string): string {
  return `${repoUrl.trim().toLowerCase()}@${ref}`;
}

// ─── Cache Operations ───────────────────────────────────────────

/**
 * Look up a cached .archc graph by repo URL and ref.
 */
export function browserCacheLookup(repoUrl: string, ref: string): BrowserCacheLookupResult {
  const key = cacheKey(repoUrl, ref);
  const entry = cache.get(key);

  if (entry) {
    // Update last accessed timestamp
    entry.lastAccessedAt = new Date();
    return { hit: true, entry };
  }

  return { hit: false };
}

/**
 * Store a fetched .archc graph in the browser cache.
 */
export function browserCacheWrite(
  repoUrl: string,
  ref: string,
  graph: ArchGraph,
  rawData: Uint8Array,
): void {
  const key = cacheKey(repoUrl, ref);
  const now = new Date();

  cache.set(key, {
    graph,
    rawData,
    fetchedAt: now,
    lastAccessedAt: now,
    repoUrl,
    ref,
  });
}

/**
 * Invalidate (remove) a cached entry.
 */
export function browserCacheInvalidate(repoUrl: string, ref: string): void {
  const key = cacheKey(repoUrl, ref);
  cache.delete(key);
}

/**
 * Clear the entire in-memory cache.
 */
export function browserCacheClear(): void {
  cache.clear();
}

/**
 * Get the number of cached entries.
 */
export function browserCacheSize(): number {
  return cache.size;
}

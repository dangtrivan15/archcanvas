/**
 * Global cache for remote .archc files fetched from git repositories.
 *
 * Cache location: ~/.archcanvas/cache/<repo-url-hash>/<ref>/main.archc
 * Each cached entry includes a manifest.json with metadata.
 *
 * The cache is keyed by (repo URL + ref). When a canvas-ref node's ref
 * changes, the old cached entry is deleted and the new one is fetched.
 */

import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ─── Types ──────────────────────────────────────────────────────

/** Metadata stored alongside each cached .archc file. */
export interface CacheManifest {
  /** The original repo URL */
  repoUrl: string;
  /** The git ref (tag or commit SHA) */
  ref: string;
  /** ISO 8601 timestamp of when the file was fetched */
  fetchedAt: string;
  /** Size of the cached .archc file in bytes */
  fileSize: number;
  /** ISO 8601 timestamp of last access (for LRU eviction) */
  lastAccessedAt: string;
}

/** Summary of a single cache entry, returned by list/stats operations. */
export interface CacheEntry {
  /** Hash-based directory name for this repo URL */
  repoUrlHash: string;
  /** The ref subdirectory */
  ref: string;
  /** Full manifest metadata */
  manifest: CacheManifest;
  /** Absolute path to the cached .archc file */
  archcPath: string;
}

/** Result of a cache lookup. */
export interface CacheLookupResult {
  /** Whether the entry was found in cache */
  hit: boolean;
  /** The raw .archc binary data (only present on hit) */
  data?: Uint8Array;
  /** The manifest (only present on hit) */
  manifest?: CacheManifest;
}

/** Options for cache eviction. */
export interface EvictionOptions {
  /** Maximum total cache size in bytes. Entries are evicted LRU until under this limit. */
  maxSizeBytes?: number;
  /** Maximum number of cached entries. Oldest accessed entries are evicted first. */
  maxEntries?: number;
}

// ─── Path Helpers ───────────────────────────────────────────────

/**
 * Hash a repo URL to create a filesystem-safe directory name.
 * Uses SHA-256 truncated to 16 hex chars for reasonable uniqueness.
 */
export function hashRepoUrl(repoUrl: string): string {
  return createHash('sha256').update(repoUrl.trim().toLowerCase()).digest('hex').slice(0, 16);
}

/** Returns the root cache directory: ~/.archcanvas/cache */
export function getCacheDir(): string {
  return join(homedir(), '.archcanvas', 'cache');
}

/** Returns the directory for a specific repo URL: ~/.archcanvas/cache/<hash> */
export function getRepoCacheDir(repoUrl: string): string {
  return join(getCacheDir(), hashRepoUrl(repoUrl));
}

/** Returns the directory for a specific ref: ~/.archcanvas/cache/<hash>/<ref> */
export function getRefCacheDir(repoUrl: string, ref: string): string {
  // Sanitize ref for filesystem safety (replace / with __)
  const safeRef = ref.replace(/\//g, '__');
  return join(getRepoCacheDir(repoUrl), safeRef);
}

/** Returns the path to the cached .archc file */
export function getCachedArchcPath(repoUrl: string, ref: string): string {
  return join(getRefCacheDir(repoUrl, ref), 'main.archc');
}

/** Returns the path to the manifest.json file */
export function getManifestPath(repoUrl: string, ref: string): string {
  return join(getRefCacheDir(repoUrl, ref), 'manifest.json');
}

// ─── Cache Operations ───────────────────────────────────────────

/**
 * Ensure the cache directory exists, creating it if needed.
 * Safe to call multiple times (idempotent).
 */
export async function ensureCacheDir(): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.mkdir(getCacheDir(), { recursive: true });
}

/**
 * Look up a cached .archc file by repo URL and ref.
 *
 * @param repoUrl - The git repository URL
 * @param ref - The git ref (tag or commit SHA)
 * @returns Cache lookup result with hit status, data, and manifest
 */
export async function cacheLookup(repoUrl: string, ref: string): Promise<CacheLookupResult> {
  const fs = await import('node:fs/promises');
  const archcPath = getCachedArchcPath(repoUrl, ref);
  const manifestPath = getManifestPath(repoUrl, ref);

  try {
    const [data, manifestRaw] = await Promise.all([
      fs.readFile(archcPath),
      fs.readFile(manifestPath, 'utf-8'),
    ]);

    let manifest: CacheManifest;
    try {
      manifest = JSON.parse(manifestRaw) as CacheManifest;
    } catch {
      // Malformed manifest — treat as cache miss
      return { hit: false };
    }

    // Update last accessed timestamp
    manifest.lastAccessedAt = new Date().toISOString();
    try {
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    } catch {
      // Non-critical — ignore write failure for access time update
    }

    return {
      hit: true,
      data: new Uint8Array(data),
      manifest,
    };
  } catch {
    return { hit: false };
  }
}

/**
 * Write a fetched .archc file to the cache.
 *
 * @param repoUrl - The git repository URL
 * @param ref - The git ref (tag or commit SHA)
 * @param data - The raw .archc binary data
 */
export async function cacheWrite(repoUrl: string, ref: string, data: Uint8Array): Promise<void> {
  const fs = await import('node:fs/promises');
  const refDir = getRefCacheDir(repoUrl, ref);

  // Ensure directory structure exists
  await fs.mkdir(refDir, { recursive: true });

  const manifest: CacheManifest = {
    repoUrl,
    ref,
    fetchedAt: new Date().toISOString(),
    fileSize: data.byteLength,
    lastAccessedAt: new Date().toISOString(),
  };

  // Write both files
  await Promise.all([
    fs.writeFile(getCachedArchcPath(repoUrl, ref), data),
    fs.writeFile(getManifestPath(repoUrl, ref), JSON.stringify(manifest, null, 2) + '\n', 'utf-8'),
  ]);
}

/**
 * Invalidate (delete) a cached entry for a specific repo URL and ref.
 * No-op if the entry doesn't exist. Never throws.
 *
 * @param repoUrl - The git repository URL
 * @param ref - The ref to invalidate
 */
export async function cacheInvalidate(repoUrl: string, ref: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const refDir = getRefCacheDir(repoUrl, ref);

  try {
    await fs.rm(refDir, { recursive: true, force: true });
  } catch {
    // Ignore errors — directory may not exist
  }
}

/**
 * Invalidate all cached entries for a specific repo URL.
 * Removes the entire repo hash directory. Never throws.
 *
 * @param repoUrl - The git repository URL
 */
export async function cacheInvalidateRepo(repoUrl: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const repoDir = getRepoCacheDir(repoUrl);

  try {
    await fs.rm(repoDir, { recursive: true, force: true });
  } catch {
    // Ignore errors — directory may not exist
  }
}

/**
 * Handle ref change on a canvas-ref node: invalidate the old cached entry
 * and return that the new ref needs to be fetched.
 *
 * @param repoUrl - The git repository URL
 * @param oldRef - The previous ref value (will be deleted from cache)
 * @param newRef - The new ref value (caller should fetch this)
 */
export async function cacheOnRefChange(
  repoUrl: string,
  oldRef: string,
  newRef: string,
): Promise<CacheLookupResult> {
  // Delete old cached entry
  await cacheInvalidate(repoUrl, oldRef);
  // Check if new ref is already cached
  return cacheLookup(repoUrl, newRef);
}

// ─── Cache Management ───────────────────────────────────────────

/**
 * List all cached entries with their manifests.
 * Scans the cache directory structure and reads each manifest.json.
 *
 * @returns Array of cache entries sorted by last access time (oldest first)
 */
export async function cacheList(): Promise<CacheEntry[]> {
  const fs = await import('node:fs/promises');
  const cacheDir = getCacheDir();
  const entries: CacheEntry[] = [];

  try {
    const repoDirs = await fs.readdir(cacheDir, { withFileTypes: true });

    for (const repoDir of repoDirs) {
      if (!repoDir.isDirectory()) continue;

      const repoPath = join(cacheDir, repoDir.name);
      try {
        const refDirs = await fs.readdir(repoPath, { withFileTypes: true });

        for (const refDir of refDirs) {
          if (!refDir.isDirectory()) continue;

          const manifestPath = join(repoPath, refDir.name, 'manifest.json');
          const archcPath = join(repoPath, refDir.name, 'main.archc');

          try {
            const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestRaw) as CacheManifest;

            entries.push({
              repoUrlHash: repoDir.name,
              ref: refDir.name,
              manifest,
              archcPath,
            });
          } catch {
            // Skip entries with missing or malformed manifests
            continue;
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Cache directory doesn't exist yet — return empty
    return [];
  }

  // Sort by last accessed time (oldest first, for LRU eviction)
  entries.sort((a, b) => {
    const aTime = new Date(a.manifest.lastAccessedAt).getTime();
    const bTime = new Date(b.manifest.lastAccessedAt).getTime();
    return aTime - bTime;
  });

  return entries;
}

/**
 * Get total cache size in bytes.
 */
export async function cacheTotalSize(): Promise<number> {
  const entries = await cacheList();
  return entries.reduce((total, entry) => total + entry.manifest.fileSize, 0);
}

/**
 * Evict cache entries based on size or count limits (LRU strategy).
 * Removes the least recently accessed entries first.
 *
 * @param options - Eviction limits
 * @returns Number of entries evicted
 */
export async function cacheEvict(options: EvictionOptions): Promise<number> {
  const fs = await import('node:fs/promises');
  const entries = await cacheList(); // sorted oldest-first (LRU)
  let evicted = 0;

  // Evict by entry count
  if (options.maxEntries !== undefined && entries.length > options.maxEntries) {
    const toRemove = entries.length - options.maxEntries;
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const entry = entries[i]!;
      const refDir = join(getCacheDir(), entry.repoUrlHash, entry.ref);
      try {
        await fs.rm(refDir, { recursive: true, force: true });
        evicted++;
      } catch {
        // Skip entries that can't be removed
      }
    }
    // Remove evicted entries from array for size check
    entries.splice(0, toRemove);
  }

  // Evict by total size
  if (options.maxSizeBytes !== undefined) {
    let totalSize = entries.reduce((sum, e) => sum + e.manifest.fileSize, 0);

    for (let i = 0; i < entries.length && totalSize > options.maxSizeBytes; i++) {
      const entry = entries[i]!;
      const refDir = join(getCacheDir(), entry.repoUrlHash, entry.ref);
      try {
        await fs.rm(refDir, { recursive: true, force: true });
        totalSize -= entry.manifest.fileSize;
        evicted++;
      } catch {
        // Skip entries that can't be removed
      }
    }
  }

  return evicted;
}

/**
 * Clear the entire cache. Removes all cached .archc files and manifests.
 * Never throws.
 *
 * @returns Number of entries that were cleared
 */
export async function cacheClear(): Promise<number> {
  const fs = await import('node:fs/promises');
  const entries = await cacheList();
  const count = entries.length;

  try {
    await fs.rm(getCacheDir(), { recursive: true, force: true });
  } catch {
    // Ignore errors
  }

  return count;
}

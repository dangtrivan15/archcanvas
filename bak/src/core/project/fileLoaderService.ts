/**
 * Cross-file loader service for nested canvas navigation.
 *
 * Loads and caches .archc files on demand using an LRU eviction strategy.
 * When the user navigates into a container node that references another
 * .archc file, this service loads, decodes, and caches the graph so that
 * back-navigation restores instantly from cache.
 *
 * Features:
 * - LRU cache with configurable max size (default 10)
 * - Circular reference detection during load chains
 * - Error handling: file not found, corrupted, circular refs
 * - Integration with projectStore for directory handle resolution
 */

import type { ArchGraph } from '@/types/graph';
import { readProjectFile } from './scanner';
import { decodeArchcData } from '@/core/storage/fileIO';
import { CodecError, IntegrityError } from '@/core/storage/codec';

// ─── Error Types ────────────────────────────────────────────────

/**
 * Error thrown when a file cannot be found in the project directory.
 */
export class FileNotFoundError extends Error {
  constructor(
    public readonly path: string,
    cause?: Error,
  ) {
    super(`File not found: ${path}`);
    this.name = 'FileNotFoundError';
    if (cause) this.cause = cause;
  }
}

/**
 * Error thrown when a circular reference is detected in the file load chain.
 */
export class CircularReferenceError extends Error {
  constructor(
    public readonly path: string,
    public readonly chain: string[],
  ) {
    super(
      `Circular reference detected: ${[...chain, path].join(' → ')}`,
    );
    this.name = 'CircularReferenceError';
  }
}

/**
 * Error thrown when a file is corrupted or cannot be decoded.
 */
export class CorruptedFileError extends Error {
  constructor(
    public readonly path: string,
    cause?: Error,
  ) {
    super(`Corrupted file: ${path} — ${cause?.message ?? 'unknown error'}`);
    this.name = 'CorruptedFileError';
    if (cause) this.cause = cause;
  }
}

// ─── LRU Cache ──────────────────────────────────────────────────

/**
 * A cached entry for a loaded .archc file.
 */
export interface CachedFileEntry {
  /** Relative path within the project folder. */
  path: string;
  /** The decoded architecture graph. */
  graph: ArchGraph;
  /** When this entry was loaded (ms since epoch). */
  loadedAtMs: number;
}

/**
 * Simple LRU (Least Recently Used) cache for decoded graph data.
 *
 * Uses a Map to maintain insertion/access order. The most recently
 * accessed entries are moved to the end; eviction removes from the front.
 */
export class LRUCache<K, V> {
  private readonly cache = new Map<K, V>();
  private readonly _maxSize: number;

  constructor(maxSize: number) {
    if (maxSize < 1) throw new Error('LRU cache maxSize must be >= 1');
    this._maxSize = maxSize;
  }

  /** Current number of entries in the cache. */
  get size(): number {
    return this.cache.size;
  }

  /** Maximum capacity of the cache. */
  get maxSize(): number {
    return this._maxSize;
  }

  /**
   * Get a value by key. Returns undefined if not present.
   * Moves the entry to most-recently-used position on access.
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value === undefined) return undefined;

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set a value for a key. If the cache is full, evicts the least recently used entry.
   */
  set(key: K, value: V): void {
    // If key already exists, delete first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict LRU entry if at capacity
    if (this.cache.size >= this._maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Check if a key exists in the cache (does NOT update access order).
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove a specific entry from the cache.
   * @returns true if the entry existed and was removed.
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /** Clear all entries from the cache. */
  clear(): void {
    this.cache.clear();
  }

  /** Get all keys in order from LRU to MRU. */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  /** Get all values in order from LRU to MRU. */
  values(): IterableIterator<V> {
    return this.cache.values();
  }
}

// ─── FileLoaderService ──────────────────────────────────────────

/** Default number of decoded graphs to keep in memory. */
const DEFAULT_CACHE_SIZE = 10;

/**
 * Service that loads and caches .archc files on demand for nested canvas navigation.
 *
 * Usage:
 * ```ts
 * const loader = new FileLoaderService(dirHandle, { maxCacheSize: 10 });
 * const graph = await loader.loadFile('sub-system.archc');
 * // ... user navigates back
 * const cached = loader.getCached('sub-system.archc'); // instant
 * ```
 */
export class FileLoaderService {
  private readonly cache: LRUCache<string, CachedFileEntry>;
  private readonly baseDirHandle: FileSystemDirectoryHandle;
  /** Tracks files currently being loaded to detect circular references. */
  private readonly loadingChain: Set<string> = new Set();

  constructor(
    baseDirHandle: FileSystemDirectoryHandle,
    options?: { maxCacheSize?: number },
  ) {
    this.baseDirHandle = baseDirHandle;
    this.cache = new LRUCache(options?.maxCacheSize ?? DEFAULT_CACHE_SIZE);
  }

  /**
   * Load an .archc file by its relative path within the project directory.
   *
   * - Returns from cache if available (cache hit updates LRU order).
   * - Otherwise reads, decodes, and caches the file.
   * - Detects circular references if called recursively.
   *
   * @param relativePath - Path relative to the project base directory
   * @returns The decoded ArchGraph for the file
   * @throws {FileNotFoundError} If the file doesn't exist
   * @throws {CorruptedFileError} If the file can't be decoded
   * @throws {CircularReferenceError} If a circular load chain is detected
   */
  async loadFile(relativePath: string): Promise<ArchGraph> {
    const normalizedPath = this.normalizePath(relativePath);

    // Check cache first (updates LRU order on hit)
    const cached = this.cache.get(normalizedPath);
    if (cached) return cached.graph;

    // Detect circular references
    if (this.loadingChain.has(normalizedPath)) {
      throw new CircularReferenceError(normalizedPath, [...this.loadingChain]);
    }

    this.loadingChain.add(normalizedPath);
    try {
      // Read raw bytes from filesystem
      let data: Uint8Array;
      try {
        data = await readProjectFile(this.baseDirHandle, normalizedPath);
      } catch (err) {
        throw new FileNotFoundError(
          normalizedPath,
          err instanceof Error ? err : new Error(String(err)),
        );
      }

      // Decode the .archc binary data
      let graph: ArchGraph;
      try {
        const result = await decodeArchcData(data);
        graph = result.graph;
      } catch (err) {
        // Re-throw our own error types (e.g. circular ref from nested load)
        if (err instanceof CircularReferenceError || err instanceof FileNotFoundError || err instanceof CorruptedFileError) {
          throw err;
        }
        if (err instanceof CodecError || err instanceof IntegrityError) {
          throw new CorruptedFileError(normalizedPath, err);
        }
        throw new CorruptedFileError(
          normalizedPath,
          err instanceof Error ? err : new Error(String(err)),
        );
      }

      // Cache the result
      const entry: CachedFileEntry = {
        path: normalizedPath,
        graph,
        loadedAtMs: Date.now(),
      };
      this.cache.set(normalizedPath, entry);

      return graph;
    } finally {
      this.loadingChain.delete(normalizedPath);
    }
  }

  /**
   * Remove a cached file entry. Use when a file is known to have changed
   * and needs to be reloaded on next access.
   *
   * @param relativePath - Path relative to the project base directory
   * @returns true if the entry was in the cache and removed
   */
  unloadFile(relativePath: string): boolean {
    return this.cache.delete(this.normalizePath(relativePath));
  }

  /**
   * Get a cached file entry without triggering a load.
   * Returns undefined if the file is not in the cache.
   *
   * Note: This DOES update LRU order (marks as recently used).
   *
   * @param relativePath - Path relative to the project base directory
   */
  getCached(relativePath: string): CachedFileEntry | undefined {
    return this.cache.get(this.normalizePath(relativePath));
  }

  /**
   * Check if a file is currently cached (does NOT update LRU order).
   */
  isCached(relativePath: string): boolean {
    return this.cache.has(this.normalizePath(relativePath));
  }

  /** Number of files currently in the cache. */
  get cacheSize(): number {
    return this.cache.size;
  }

  /** Maximum cache capacity. */
  get maxCacheSize(): number {
    return this.cache.maxSize;
  }

  /** Clear the entire cache. */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Normalize a file path for consistent cache key lookup.
   * Removes leading "./" and normalizes separators.
   */
  private normalizePath(path: string): string {
    return path.replace(/^\.\//, '').replace(/\\/g, '/');
  }
}

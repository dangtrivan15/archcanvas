/**
 * Unit tests for the FileLoaderService and LRU cache.
 *
 * Tests cover:
 * - LRU cache: get, set, eviction, delete, clear
 * - FileLoaderService: load, cache hit/miss, eviction, unload, error handling
 * - Error cases: file not found, corrupted file, circular references
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LRUCache,
  FileLoaderService,
  FileNotFoundError,
  CircularReferenceError,
  CorruptedFileError,
} from '@/core/project/fileLoaderService';
import type { ArchGraph } from '@/types/graph';

// ─── Mock dependencies ──────────────────────────────────────────

const mockReadProjectFile = vi.fn<
  (dir: FileSystemDirectoryHandle, path: string) => Promise<Uint8Array>
>();
const mockDecodeArchcData = vi.fn<
  (data: Uint8Array) => Promise<{ graph: ArchGraph }>
>();

vi.mock('@/core/project/scanner', () => ({
  readProjectFile: (...args: unknown[]) =>
    mockReadProjectFile(args[0] as FileSystemDirectoryHandle, args[1] as string),
}));

vi.mock('@/core/storage/fileIO', () => ({
  decodeArchcData: (...args: unknown[]) =>
    mockDecodeArchcData(args[0] as Uint8Array),
}));

vi.mock('@/core/storage/codec', () => ({
  CodecError: class CodecError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'CodecError';
    }
  },
  IntegrityError: class IntegrityError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'IntegrityError';
    }
  },
}));

// ─── Helpers ────────────────────────────────────────────────────

function makeGraph(name: string): ArchGraph {
  return {
    name,
    description: `Graph for ${name}`,
    owners: [],
    nodes: [],
    edges: [],
    annotations: [],
  };
}

function makeDirHandle(): FileSystemDirectoryHandle {
  return {} as FileSystemDirectoryHandle;
}

// ─── LRUCache Tests ─────────────────────────────────────────────

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(2);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts least recently used entry when at capacity', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Cache is full (3 entries). Adding d should evict a (LRU).
    cache.set('d', 4);
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('accessing an entry moves it to MRU position', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'a' — moves it to MRU. LRU order is now b, c, a.
    cache.get('a');
    // Add 'd' — should evict 'b' (now LRU)
    cache.set('d', 4);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('updating an existing key moves it to MRU', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Update 'a' — moves to MRU. LRU order: b, c, a.
    cache.set('a', 10);
    cache.set('d', 4);
    expect(cache.get('a')).toBe(10);
    expect(cache.get('b')).toBeUndefined();
  });

  it('delete removes a specific entry', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(1);
  });

  it('delete returns false for non-existent key', () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.delete('missing')).toBe(false);
  });

  it('clear removes all entries', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('has() checks existence without updating order', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // has() should NOT update order
    expect(cache.has('a')).toBe(true);
    expect(cache.has('missing')).toBe(false);
    // Add 'd' — 'a' should still be LRU (has() didn't promote it)
    cache.set('d', 4);
    expect(cache.get('a')).toBeUndefined();
  });

  it('throws for maxSize < 1', () => {
    expect(() => new LRUCache(0)).toThrow('maxSize must be >= 1');
    expect(() => new LRUCache(-1)).toThrow('maxSize must be >= 1');
  });

  it('works with maxSize of 1', () => {
    const cache = new LRUCache<string, number>(1);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    cache.set('b', 2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('keys() returns keys in LRU to MRU order', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // promote 'a'
    expect([...cache.keys()]).toEqual(['b', 'c', 'a']);
  });
});

// ─── FileLoaderService Tests ────────────────────────────────────

describe('FileLoaderService', () => {
  let dirHandle: FileSystemDirectoryHandle;

  beforeEach(() => {
    vi.clearAllMocks();
    dirHandle = makeDirHandle();
  });

  function setupMockFile(path: string, graph: ArchGraph): void {
    const fakeBytes = new Uint8Array([1, 2, 3]);
    mockReadProjectFile.mockImplementation(async (_dir, p) => {
      if (p === path) return fakeBytes;
      throw new Error(`File not found: ${p}`);
    });
    mockDecodeArchcData.mockResolvedValue({ graph });
  }

  it('loads a file and returns its graph', async () => {
    const graph = makeGraph('test');
    setupMockFile('test.archc', graph);

    const service = new FileLoaderService(dirHandle);
    const result = await service.loadFile('test.archc');

    expect(result).toEqual(graph);
    expect(mockReadProjectFile).toHaveBeenCalledWith(dirHandle, 'test.archc');
    expect(mockDecodeArchcData).toHaveBeenCalled();
  });

  it('returns cached graph on second load (cache hit)', async () => {
    const graph = makeGraph('cached');
    setupMockFile('cached.archc', graph);

    const service = new FileLoaderService(dirHandle);
    await service.loadFile('cached.archc');

    // Reset mocks — second load should NOT call readProjectFile
    mockReadProjectFile.mockClear();
    mockDecodeArchcData.mockClear();

    const result = await service.loadFile('cached.archc');
    expect(result).toEqual(graph);
    expect(mockReadProjectFile).not.toHaveBeenCalled();
    expect(mockDecodeArchcData).not.toHaveBeenCalled();
  });

  it('getCached returns entry for loaded file', async () => {
    const graph = makeGraph('test');
    setupMockFile('test.archc', graph);

    const service = new FileLoaderService(dirHandle);
    await service.loadFile('test.archc');

    const cached = service.getCached('test.archc');
    expect(cached).toBeDefined();
    expect(cached!.graph).toEqual(graph);
    expect(cached!.path).toBe('test.archc');
    expect(typeof cached!.loadedAtMs).toBe('number');
  });

  it('getCached returns undefined for unloaded file', () => {
    const service = new FileLoaderService(dirHandle);
    expect(service.getCached('missing.archc')).toBeUndefined();
  });

  it('unloadFile removes cached entry', async () => {
    const graph = makeGraph('test');
    setupMockFile('test.archc', graph);

    const service = new FileLoaderService(dirHandle);
    await service.loadFile('test.archc');
    expect(service.isCached('test.archc')).toBe(true);

    const removed = service.unloadFile('test.archc');
    expect(removed).toBe(true);
    expect(service.isCached('test.archc')).toBe(false);
  });

  it('unloadFile returns false for non-cached file', () => {
    const service = new FileLoaderService(dirHandle);
    expect(service.unloadFile('missing.archc')).toBe(false);
  });

  it('respects configurable cache size', async () => {
    const service = new FileLoaderService(dirHandle, { maxCacheSize: 2 });
    expect(service.maxCacheSize).toBe(2);

    // Set up mock to return different graphs for different paths
    mockReadProjectFile.mockResolvedValue(new Uint8Array([1]));
    mockDecodeArchcData
      .mockResolvedValueOnce({ graph: makeGraph('A') })
      .mockResolvedValueOnce({ graph: makeGraph('B') })
      .mockResolvedValueOnce({ graph: makeGraph('C') });

    await service.loadFile('a.archc');
    await service.loadFile('b.archc');
    expect(service.cacheSize).toBe(2);

    // Loading a third file should evict 'a.archc' (LRU)
    await service.loadFile('c.archc');
    expect(service.cacheSize).toBe(2);
    expect(service.isCached('a.archc')).toBe(false);
    expect(service.isCached('b.archc')).toBe(true);
    expect(service.isCached('c.archc')).toBe(true);
  });

  it('clearCache removes all entries', async () => {
    const graph = makeGraph('test');
    setupMockFile('test.archc', graph);

    const service = new FileLoaderService(dirHandle);
    await service.loadFile('test.archc');
    expect(service.cacheSize).toBe(1);

    service.clearCache();
    expect(service.cacheSize).toBe(0);
    expect(service.getCached('test.archc')).toBeUndefined();
  });

  it('normalizes paths (strips leading ./)', async () => {
    const graph = makeGraph('normalized');
    setupMockFile('sub/test.archc', graph);

    const service = new FileLoaderService(dirHandle);
    await service.loadFile('./sub/test.archc');

    // Should be findable by either path form
    expect(service.isCached('sub/test.archc')).toBe(true);
    expect(service.getCached('./sub/test.archc')).toBeDefined();
  });

  // ─── Error handling ─────────────────────────────────────────

  it('throws FileNotFoundError when file does not exist', async () => {
    mockReadProjectFile.mockRejectedValue(new Error('NotFoundError'));

    const service = new FileLoaderService(dirHandle);
    await expect(service.loadFile('missing.archc')).rejects.toThrow(FileNotFoundError);
    await expect(service.loadFile('missing.archc')).rejects.toThrow('File not found: missing.archc');
  });

  it('throws CorruptedFileError when file cannot be decoded', async () => {
    mockReadProjectFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

    // Import the mock CodecError to throw
    const { CodecError } = await import('@/core/storage/codec');
    mockDecodeArchcData.mockRejectedValue(new CodecError('bad magic bytes'));

    const service = new FileLoaderService(dirHandle);
    await expect(service.loadFile('bad.archc')).rejects.toThrow(CorruptedFileError);
    await expect(service.loadFile('bad.archc')).rejects.toThrow('Corrupted file: bad.archc');
  });

  it('throws CircularReferenceError for circular load chains', async () => {
    // Simulate circular reference: loading 'a.archc' triggers loading 'a.archc' again
    const service = new FileLoaderService(dirHandle);

    mockReadProjectFile.mockResolvedValue(new Uint8Array([1]));
    mockDecodeArchcData.mockImplementation(async () => {
      // While decoding 'a.archc', try to load it again (circular)
      await service.loadFile('a.archc');
      return { graph: makeGraph('A') };
    });

    await expect(service.loadFile('a.archc')).rejects.toThrow(CircularReferenceError);
  });

  it('circular reference error includes the load chain', async () => {
    const service = new FileLoaderService(dirHandle);

    mockReadProjectFile.mockResolvedValue(new Uint8Array([1]));
    mockDecodeArchcData.mockImplementation(async () => {
      await service.loadFile('a.archc');
      return { graph: makeGraph('A') };
    });

    try {
      await service.loadFile('a.archc');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CircularReferenceError);
      expect((err as CircularReferenceError).chain).toContain('a.archc');
    }
  });

  it('does not cache files that fail to load', async () => {
    mockReadProjectFile.mockRejectedValue(new Error('NotFoundError'));

    const service = new FileLoaderService(dirHandle);
    try {
      await service.loadFile('bad.archc');
    } catch {
      // Expected
    }
    expect(service.isCached('bad.archc')).toBe(false);
    expect(service.cacheSize).toBe(0);
  });

  it('cleans up loading chain on error (allows retry)', async () => {
    const service = new FileLoaderService(dirHandle);

    // First attempt fails
    mockReadProjectFile.mockRejectedValueOnce(new Error('Temporary error'));
    try {
      await service.loadFile('retry.archc');
    } catch {
      // Expected
    }

    // Second attempt succeeds — should NOT throw CircularReferenceError
    const graph = makeGraph('retry');
    mockReadProjectFile.mockResolvedValueOnce(new Uint8Array([1]));
    mockDecodeArchcData.mockResolvedValueOnce({ graph });

    const result = await service.loadFile('retry.archc');
    expect(result).toEqual(graph);
  });

  it('uses default cache size of 10 when not specified', () => {
    const service = new FileLoaderService(dirHandle);
    expect(service.maxCacheSize).toBe(10);
  });
});

/**
 * Tests for the global .archc file cache module.
 *
 * Verifies cache directory structure, lookup, write, invalidation,
 * manifest metadata, cache management (list, evict, clear), and
 * ref change handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  hashRepoUrl,
  getCacheDir,
  getRepoCacheDir,
  getRefCacheDir,
  getCachedArchcPath,
  getManifestPath,
  ensureCacheDir,
  cacheLookup,
  cacheWrite,
  cacheInvalidate,
  cacheInvalidateRepo,
  cacheOnRefChange,
  cacheList,
  cacheTotalSize,
  cacheEvict,
  cacheClear,
} from '@/core/git/repoCache';
import type { CacheManifest } from '@/core/git/repoCache';

// ─── Mocking homedir ────────────────────────────────────────────

let testHomeDir: string;

// We mock 'node:os' so homedir() returns our temp directory
vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => testHomeDir,
  };
});

beforeEach(async () => {
  testHomeDir = await mkdtemp(join(tmpdir(), 'archcanvas-cache-test-'));
});

afterEach(async () => {
  await rm(testHomeDir, { recursive: true, force: true });
});

// ─── Test Data ──────────────────────────────────────────────────

const TEST_REPO_URL = 'https://github.com/acme/my-arch';
const TEST_REF = 'v1.0.0';
const TEST_DATA = new Uint8Array([65, 82, 67, 72, 67, 0, 1, 2, 3, 4]); // mock binary

// ─── Path Helpers ───────────────────────────────────────────────

describe('hashRepoUrl', () => {
  it('returns a 16-character hex string', () => {
    const hash = hashRepoUrl(TEST_REPO_URL);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for the same URL', () => {
    expect(hashRepoUrl(TEST_REPO_URL)).toBe(hashRepoUrl(TEST_REPO_URL));
  });

  it('normalizes by trimming and lowercasing', () => {
    expect(hashRepoUrl('  https://GitHub.com/Acme/My-Arch  ')).toBe(
      hashRepoUrl('https://github.com/acme/my-arch'),
    );
  });

  it('produces different hashes for different URLs', () => {
    expect(hashRepoUrl('https://github.com/a/b')).not.toBe(
      hashRepoUrl('https://github.com/c/d'),
    );
  });
});

describe('path helpers', () => {
  it('getCacheDir returns ~/.archcanvas/cache', () => {
    expect(getCacheDir()).toBe(join(testHomeDir, '.archcanvas', 'cache'));
  });

  it('getRepoCacheDir returns cache/<hash>', () => {
    const dir = getRepoCacheDir(TEST_REPO_URL);
    expect(dir).toBe(join(testHomeDir, '.archcanvas', 'cache', hashRepoUrl(TEST_REPO_URL)));
  });

  it('getRefCacheDir returns cache/<hash>/<ref>', () => {
    const dir = getRefCacheDir(TEST_REPO_URL, TEST_REF);
    expect(dir).toBe(
      join(testHomeDir, '.archcanvas', 'cache', hashRepoUrl(TEST_REPO_URL), TEST_REF),
    );
  });

  it('getRefCacheDir sanitizes slashes in ref', () => {
    const dir = getRefCacheDir(TEST_REPO_URL, 'feature/branch');
    expect(dir).toContain('feature__branch');
    expect(dir).not.toContain('feature/branch');
  });

  it('getCachedArchcPath returns cache/<hash>/<ref>/main.archc', () => {
    const path = getCachedArchcPath(TEST_REPO_URL, TEST_REF);
    expect(path.endsWith(join(TEST_REF, 'main.archc'))).toBe(true);
  });

  it('getManifestPath returns cache/<hash>/<ref>/manifest.json', () => {
    const path = getManifestPath(TEST_REPO_URL, TEST_REF);
    expect(path.endsWith(join(TEST_REF, 'manifest.json'))).toBe(true);
  });
});

// ─── Cache Directory Creation ───────────────────────────────────

describe('ensureCacheDir', () => {
  it('creates the cache directory on first use', async () => {
    await ensureCacheDir();
    const entries = await readdir(join(testHomeDir, '.archcanvas'));
    expect(entries).toContain('cache');
  });

  it('is idempotent — safe to call multiple times', async () => {
    await ensureCacheDir();
    await ensureCacheDir();
    const entries = await readdir(join(testHomeDir, '.archcanvas'));
    expect(entries).toContain('cache');
  });
});

// ─── Cache Write ────────────────────────────────────────────────

describe('cacheWrite', () => {
  it('creates directory structure and writes main.archc', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    const archcPath = getCachedArchcPath(TEST_REPO_URL, TEST_REF);
    const data = await readFile(archcPath);
    expect(new Uint8Array(data)).toEqual(TEST_DATA);
  });

  it('writes manifest.json alongside the .archc file', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    const manifestPath = getManifestPath(TEST_REPO_URL, TEST_REF);
    const raw = await readFile(manifestPath, 'utf-8');
    const manifest: CacheManifest = JSON.parse(raw);

    expect(manifest.repoUrl).toBe(TEST_REPO_URL);
    expect(manifest.ref).toBe(TEST_REF);
    expect(manifest.fileSize).toBe(TEST_DATA.byteLength);
    expect(manifest.fetchedAt).toBeTruthy();
    expect(manifest.lastAccessedAt).toBeTruthy();
  });

  it('stores correct file size in manifest', async () => {
    const largeData = new Uint8Array(1024);
    await cacheWrite(TEST_REPO_URL, TEST_REF, largeData);

    const manifestPath = getManifestPath(TEST_REPO_URL, TEST_REF);
    const manifest: CacheManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    expect(manifest.fileSize).toBe(1024);
  });

  it('overwrites existing cached entry', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    const newData = new Uint8Array([99, 98, 97]);
    await cacheWrite(TEST_REPO_URL, TEST_REF, newData);

    const archcPath = getCachedArchcPath(TEST_REPO_URL, TEST_REF);
    const data = await readFile(archcPath);
    expect(new Uint8Array(data)).toEqual(newData);
  });
});

// ─── Cache Lookup ───────────────────────────────────────────────

describe('cacheLookup', () => {
  it('returns hit: false when entry does not exist', async () => {
    const result = await cacheLookup(TEST_REPO_URL, TEST_REF);
    expect(result.hit).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.manifest).toBeUndefined();
  });

  it('returns hit: true with data and manifest when entry exists', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    const result = await cacheLookup(TEST_REPO_URL, TEST_REF);
    expect(result.hit).toBe(true);
    expect(result.data).toEqual(TEST_DATA);
    expect(result.manifest).toBeDefined();
    expect(result.manifest!.repoUrl).toBe(TEST_REPO_URL);
    expect(result.manifest!.ref).toBe(TEST_REF);
  });

  it('updates lastAccessedAt on cache hit', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    // Read initial timestamp
    const manifestPath = getManifestPath(TEST_REPO_URL, TEST_REF);
    const before = JSON.parse(await readFile(manifestPath, 'utf-8')) as CacheManifest;

    // Small delay to ensure timestamps differ
    await new Promise((r) => setTimeout(r, 10));

    await cacheLookup(TEST_REPO_URL, TEST_REF);

    const after = JSON.parse(await readFile(manifestPath, 'utf-8')) as CacheManifest;
    expect(new Date(after.lastAccessedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before.lastAccessedAt).getTime(),
    );
  });

  it('returns hit: false when manifest is malformed', async () => {
    const refDir = getRefCacheDir(TEST_REPO_URL, TEST_REF);
    await mkdir(refDir, { recursive: true });
    await writeFile(getCachedArchcPath(TEST_REPO_URL, TEST_REF), TEST_DATA);
    await writeFile(getManifestPath(TEST_REPO_URL, TEST_REF), 'not json');

    const result = await cacheLookup(TEST_REPO_URL, TEST_REF);
    expect(result.hit).toBe(false);
  });
});

// ─── Cache Invalidation ─────────────────────────────────────────

describe('cacheInvalidate', () => {
  it('removes a specific ref entry', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    await cacheInvalidate(TEST_REPO_URL, TEST_REF);

    const result = await cacheLookup(TEST_REPO_URL, TEST_REF);
    expect(result.hit).toBe(false);
  });

  it('does not affect other refs for the same repo', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1.0.0', TEST_DATA);
    await cacheWrite(TEST_REPO_URL, 'v2.0.0', TEST_DATA);

    await cacheInvalidate(TEST_REPO_URL, 'v1.0.0');

    expect((await cacheLookup(TEST_REPO_URL, 'v1.0.0')).hit).toBe(false);
    expect((await cacheLookup(TEST_REPO_URL, 'v2.0.0')).hit).toBe(true);
  });

  it('is a no-op when entry does not exist', async () => {
    // Should not throw
    await cacheInvalidate(TEST_REPO_URL, 'nonexistent');
  });
});

describe('cacheInvalidateRepo', () => {
  it('removes all cached entries for a repo URL', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1.0.0', TEST_DATA);
    await cacheWrite(TEST_REPO_URL, 'v2.0.0', TEST_DATA);

    await cacheInvalidateRepo(TEST_REPO_URL);

    expect((await cacheLookup(TEST_REPO_URL, 'v1.0.0')).hit).toBe(false);
    expect((await cacheLookup(TEST_REPO_URL, 'v2.0.0')).hit).toBe(false);
  });

  it('is a no-op when repo has no cached entries', async () => {
    await cacheInvalidateRepo('https://github.com/nonexistent/repo');
  });
});

// ─── Ref Change Handling ────────────────────────────────────────

describe('cacheOnRefChange', () => {
  it('invalidates old ref and checks for new ref in cache', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1.0.0', TEST_DATA);

    const result = await cacheOnRefChange(TEST_REPO_URL, 'v1.0.0', 'v2.0.0');

    // Old ref should be gone
    expect((await cacheLookup(TEST_REPO_URL, 'v1.0.0')).hit).toBe(false);
    // New ref was not cached, so miss
    expect(result.hit).toBe(false);
  });

  it('returns hit when new ref is already cached', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1.0.0', TEST_DATA);
    await cacheWrite(TEST_REPO_URL, 'v2.0.0', TEST_DATA);

    const result = await cacheOnRefChange(TEST_REPO_URL, 'v1.0.0', 'v2.0.0');

    expect((await cacheLookup(TEST_REPO_URL, 'v1.0.0')).hit).toBe(false);
    expect(result.hit).toBe(true);
  });
});

// ─── Cache List & Stats ─────────────────────────────────────────

describe('cacheList', () => {
  it('returns empty array when cache directory does not exist', async () => {
    const entries = await cacheList();
    expect(entries).toEqual([]);
  });

  it('lists all cached entries', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1.0.0', TEST_DATA);
    await cacheWrite(TEST_REPO_URL, 'v2.0.0', TEST_DATA);
    await cacheWrite('https://github.com/other/repo', 'main', TEST_DATA);

    const entries = await cacheList();
    expect(entries).toHaveLength(3);
  });

  it('entries include manifest data and archcPath', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    const entries = await cacheList();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.manifest.repoUrl).toBe(TEST_REPO_URL);
    expect(entries[0]!.manifest.ref).toBe(TEST_REF);
    expect(entries[0]!.archcPath).toContain('main.archc');
    expect(entries[0]!.repoUrlHash).toBe(hashRepoUrl(TEST_REPO_URL));
  });

  it('sorts entries by lastAccessedAt (oldest first)', async () => {
    // Write entries with different access times
    await cacheWrite(TEST_REPO_URL, 'v1.0.0', TEST_DATA);
    await new Promise((r) => setTimeout(r, 10));
    await cacheWrite(TEST_REPO_URL, 'v2.0.0', TEST_DATA);

    const entries = await cacheList();
    expect(entries).toHaveLength(2);
    const t1 = new Date(entries[0]!.manifest.lastAccessedAt).getTime();
    const t2 = new Date(entries[1]!.manifest.lastAccessedAt).getTime();
    expect(t1).toBeLessThanOrEqual(t2);
  });
});

describe('cacheTotalSize', () => {
  it('returns 0 when cache is empty', async () => {
    expect(await cacheTotalSize()).toBe(0);
  });

  it('returns sum of all cached file sizes', async () => {
    const data1 = new Uint8Array(100);
    const data2 = new Uint8Array(200);
    await cacheWrite(TEST_REPO_URL, 'v1', data1);
    await cacheWrite(TEST_REPO_URL, 'v2', data2);

    expect(await cacheTotalSize()).toBe(300);
  });
});

// ─── Cache Eviction ─────────────────────────────────────────────

describe('cacheEvict', () => {
  it('evicts oldest entries when over maxEntries', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1', TEST_DATA);
    await new Promise((r) => setTimeout(r, 10));
    await cacheWrite(TEST_REPO_URL, 'v2', TEST_DATA);
    await new Promise((r) => setTimeout(r, 10));
    await cacheWrite(TEST_REPO_URL, 'v3', TEST_DATA);

    const evicted = await cacheEvict({ maxEntries: 1 });
    expect(evicted).toBe(2);

    const remaining = await cacheList();
    expect(remaining).toHaveLength(1);
    // Most recently accessed should survive
    expect(remaining[0]!.manifest.ref).toBe('v3');
  });

  it('evicts oldest entries when over maxSizeBytes', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1', new Uint8Array(500));
    await new Promise((r) => setTimeout(r, 10));
    await cacheWrite(TEST_REPO_URL, 'v2', new Uint8Array(500));
    await new Promise((r) => setTimeout(r, 10));
    await cacheWrite(TEST_REPO_URL, 'v3', new Uint8Array(500));

    const evicted = await cacheEvict({ maxSizeBytes: 600 });
    expect(evicted).toBeGreaterThanOrEqual(1);

    const totalSize = await cacheTotalSize();
    expect(totalSize).toBeLessThanOrEqual(600);
  });

  it('returns 0 when no eviction needed', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1', TEST_DATA);
    const evicted = await cacheEvict({ maxEntries: 10 });
    expect(evicted).toBe(0);
  });
});

// ─── Cache Clear ────────────────────────────────────────────────

describe('cacheClear', () => {
  it('removes all cached entries', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1', TEST_DATA);
    await cacheWrite(TEST_REPO_URL, 'v2', TEST_DATA);
    await cacheWrite('https://github.com/other/repo', 'main', TEST_DATA);

    const count = await cacheClear();
    expect(count).toBe(3);

    const entries = await cacheList();
    expect(entries).toEqual([]);
  });

  it('returns 0 when cache is already empty', async () => {
    const count = await cacheClear();
    expect(count).toBe(0);
  });

  it('removes the cache directory entirely', async () => {
    await cacheWrite(TEST_REPO_URL, 'v1', TEST_DATA);
    await cacheClear();

    // Cache dir should not exist
    const result = await cacheLookup(TEST_REPO_URL, 'v1');
    expect(result.hit).toBe(false);
  });
});

// ─── Manifest Content ───────────────────────────────────────────

describe('manifest.json', () => {
  it('contains all required fields', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    const manifestPath = getManifestPath(TEST_REPO_URL, TEST_REF);
    const manifest: CacheManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

    expect(manifest).toHaveProperty('repoUrl');
    expect(manifest).toHaveProperty('ref');
    expect(manifest).toHaveProperty('fetchedAt');
    expect(manifest).toHaveProperty('fileSize');
    expect(manifest).toHaveProperty('lastAccessedAt');
  });

  it('fetchedAt is a valid ISO 8601 timestamp', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    const manifestPath = getManifestPath(TEST_REPO_URL, TEST_REF);
    const manifest: CacheManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

    const parsed = new Date(manifest.fetchedAt);
    expect(parsed.toISOString()).toBe(manifest.fetchedAt);
  });

  it('is formatted JSON (human-readable)', async () => {
    await cacheWrite(TEST_REPO_URL, TEST_REF, TEST_DATA);

    const manifestPath = getManifestPath(TEST_REPO_URL, TEST_REF);
    const raw = await readFile(manifestPath, 'utf-8');

    // Should contain newlines (formatted) and end with newline
    expect(raw).toContain('\n');
    expect(raw).toMatch(/\n$/);
  });
});

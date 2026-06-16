import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncOfficialNodeDefs } from '@/core/registry/officialSync';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import type { LockfileData } from '@/core/registry/lockfile';

vi.mock('@/core/registry/remoteRegistry', () => ({
  browseRegistry: vi.fn(),
  checkUpdatesRemote: vi.fn(),
  fetchNodeDefDetail: vi.fn(),
}));

vi.mock('@/core/registry/installer', () => ({
  downloadAndInstallNodeDef: vi.fn(),
}));

import { browseRegistry, checkUpdatesRemote, fetchNodeDefDetail } from '@/core/registry/remoteRegistry';
import { downloadAndInstallNodeDef } from '@/core/registry/installer';

const OFFICIAL_NAMESPACES = [
  'compute', 'data', 'messaging', 'network', 'client',
  'integration', 'security', 'observability', 'ai',
];

function makeSummary(namespace: string, name: string) {
  return { namespace, name, latestVer: '1.0.0', tags: [], downloadCount: 0 };
}

function makeDetail(namespace: string, name: string, latestVer = '1.0.0') {
  return {
    nodedef: makeSummary(namespace, name),
    version: {
      nodedefId: `${namespace}/${name}`,
      version: latestVer,
      blob: {},
      publishedAt: '2026-01-01T00:00:00Z',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncOfficialNodeDefs', () => {
  describe('Branch A — no remote-official entries in lockfile', () => {
    it('calls browseRegistry once per namespace (9 times) when lockfile is null', async () => {
      vi.mocked(browseRegistry).mockResolvedValue({ items: [], total: 0 });

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, null);

      expect(browseRegistry).toHaveBeenCalledTimes(9);
      for (const ns of OFFICIAL_NAMESPACES) {
        expect(browseRegistry).toHaveBeenCalledWith({ namespace: ns }, undefined);
      }
    });

    it('calls browseRegistry once per namespace when lockfile has no remote-official entries', async () => {
      vi.mocked(browseRegistry).mockResolvedValue({ items: [], total: 0 });

      const lockfile: LockfileData = {
        lockfileVersion: 1,
        resolvedAt: '2026-01-01T00:00:00Z',
        entries: {
          'custom/widget': { version: '1.0.0', source: 'local' },
        },
      };

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, lockfile);

      expect(browseRegistry).toHaveBeenCalledTimes(9);
    });

    it('calls downloadAndInstallNodeDef with remote-official for each returned summary', async () => {
      const computeSummary = makeSummary('compute', 'service');
      const dataSummary = makeSummary('data', 'database');

      vi.mocked(browseRegistry).mockImplementation(async (opts) => {
        if (opts.namespace === 'compute') return { items: [computeSummary], total: 1 };
        if (opts.namespace === 'data') return { items: [dataSummary], total: 1 };
        return { items: [], total: 0 };
      });

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, null);

      expect(downloadAndInstallNodeDef).toHaveBeenCalledWith(
        fs, computeSummary, 'remote-official',
      );
      expect(downloadAndInstallNodeDef).toHaveBeenCalledWith(
        fs, dataSummary, 'remote-official',
      );
    });

    it('does not abort remaining namespaces when one namespace throws', async () => {
      let callCount = 0;
      vi.mocked(browseRegistry).mockImplementation(async (opts) => {
        callCount++;
        if (opts.namespace === 'compute') throw new Error('Network error');
        return { items: [], total: 0 };
      });

      const fs = new InMemoryFileSystem();
      await expect(syncOfficialNodeDefs(fs, null)).resolves.not.toThrow();

      // All 9 namespaces should have been attempted
      expect(callCount).toBe(9);
    });

    it('passes signal to browseRegistry in Branch A', async () => {
      vi.mocked(browseRegistry).mockResolvedValue({ items: [], total: 0 });

      const controller = new AbortController();
      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, null, controller.signal);

      expect(browseRegistry).toHaveBeenCalledWith(expect.anything(), controller.signal);
    });

    it('returns false when no downloads occurred (Branch A, no items)', async () => {
      vi.mocked(browseRegistry).mockResolvedValue({ items: [], total: 0 });

      const fs = new InMemoryFileSystem();
      const result = await syncOfficialNodeDefs(fs, null);

      expect(result).toBe(false);
    });

    it('returns true when at least one download occurred (Branch A)', async () => {
      vi.mocked(browseRegistry).mockImplementation(async (opts) => {
        if (opts.namespace === 'compute') return { items: [makeSummary('compute', 'service')], total: 1 };
        return { items: [], total: 0 };
      });
      vi.mocked(downloadAndInstallNodeDef).mockResolvedValue(undefined);

      const fs = new InMemoryFileSystem();
      const result = await syncOfficialNodeDefs(fs, null);

      expect(result).toBe(true);
    });
  });

  describe('Branch B — remote-official entries exist in lockfile', () => {
    const lockfileWithOfficials: LockfileData = {
      lockfileVersion: 1,
      resolvedAt: '2026-01-01T00:00:00Z',
      entries: {
        'compute/service': { version: '1.0.0', source: 'remote-official' },
        'data/database': { version: '1.0.0', source: 'remote-official' },
        'custom/widget': { version: '1.0.0', source: 'local' },
      },
    };

    it('calls checkUpdatesRemote once with official entries', async () => {
      vi.mocked(checkUpdatesRemote).mockResolvedValue([]);

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, lockfileWithOfficials);

      expect(checkUpdatesRemote).toHaveBeenCalledTimes(1);
      expect(checkUpdatesRemote).toHaveBeenCalledWith(
        expect.arrayContaining([
          { namespace: 'compute', name: 'service' },
          { namespace: 'data', name: 'database' },
        ]),
        undefined,
      );
    });

    it('only passes official entries (not community) to checkUpdatesRemote', async () => {
      const lockfileWithMixed: LockfileData = {
        lockfileVersion: 1,
        resolvedAt: '2026-01-01T00:00:00Z',
        entries: {
          'compute/service': { version: '1.0.0', source: 'remote-official' },
          'data/database': { version: '1.0.0', source: 'remote-official' },
          'community/widget': { version: '1.0.0', source: 'remote' },
          'community/other': { version: '2.0.0', source: 'remote' },
        },
      };

      vi.mocked(checkUpdatesRemote).mockResolvedValue([]);

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, lockfileWithMixed);

      const [entries] = vi.mocked(checkUpdatesRemote).mock.calls[0];
      // Only the 2 remote-official entries should be passed, not the 2 remote entries
      expect(entries).toHaveLength(2);
      expect(entries).toEqual(
        expect.arrayContaining([
          { namespace: 'compute', name: 'service' },
          { namespace: 'data', name: 'database' },
        ]),
      );
    });

    it('does not call browseRegistry or fetchNodeDefDetail when there are no changed entries', async () => {
      vi.mocked(checkUpdatesRemote).mockResolvedValue([]);

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, lockfileWithOfficials);

      expect(browseRegistry).not.toHaveBeenCalled();
      expect(fetchNodeDefDetail).not.toHaveBeenCalled();
    });

    it('downloads only changed entries via fetchNodeDefDetail', async () => {
      const detail = makeDetail('compute', 'service', '2.0.0');

      vi.mocked(checkUpdatesRemote).mockResolvedValue([
        { namespace: 'compute', name: 'service', latestVersion: '2.0.0' },
      ]);
      vi.mocked(fetchNodeDefDetail).mockResolvedValue(detail);

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, lockfileWithOfficials);

      expect(fetchNodeDefDetail).toHaveBeenCalledTimes(1);
      expect(fetchNodeDefDetail).toHaveBeenCalledWith('compute', 'service', '2.0.0', undefined);
      expect(downloadAndInstallNodeDef).toHaveBeenCalledWith(
        fs, detail.nodedef, 'remote-official',
      );
    });

    it('skips download if latestVersion matches installed version', async () => {
      vi.mocked(checkUpdatesRemote).mockResolvedValue([
        // latestVersion matches what lockfile has (1.0.0)
        { namespace: 'compute', name: 'service', latestVersion: '1.0.0' },
      ]);

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, lockfileWithOfficials);

      expect(fetchNodeDefDetail).not.toHaveBeenCalled();
      expect(downloadAndInstallNodeDef).not.toHaveBeenCalled();
    });

    it('passes signal to checkUpdatesRemote and fetchNodeDefDetail', async () => {
      const detail = makeDetail('compute', 'service', '2.0.0');
      vi.mocked(checkUpdatesRemote).mockResolvedValue([
        { namespace: 'compute', name: 'service', latestVersion: '2.0.0' },
      ]);
      vi.mocked(fetchNodeDefDetail).mockResolvedValue(detail);

      const controller = new AbortController();
      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, lockfileWithOfficials, controller.signal);

      expect(checkUpdatesRemote).toHaveBeenCalledWith(expect.anything(), controller.signal);
      expect(fetchNodeDefDetail).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), '2.0.0', controller.signal,
      );
    });

    it('returns false when no downloads occurred (Branch B, no changes)', async () => {
      vi.mocked(checkUpdatesRemote).mockResolvedValue([]);

      const fs = new InMemoryFileSystem();
      const result = await syncOfficialNodeDefs(fs, lockfileWithOfficials);

      expect(result).toBe(false);
    });

    it('returns true when at least one download occurred (Branch B)', async () => {
      const detail = makeDetail('compute', 'service', '2.0.0');
      vi.mocked(checkUpdatesRemote).mockResolvedValue([
        { namespace: 'compute', name: 'service', latestVersion: '2.0.0' },
      ]);
      vi.mocked(fetchNodeDefDetail).mockResolvedValue(detail);
      vi.mocked(downloadAndInstallNodeDef).mockResolvedValue(undefined);

      const fs = new InMemoryFileSystem();
      const result = await syncOfficialNodeDefs(fs, lockfileWithOfficials);

      expect(result).toBe(true);
    });

    it('continues processing other entries when downloadAndInstallNodeDef throws for one entry', async () => {
      const detail1 = makeDetail('compute', 'service', '2.0.0');
      const detail2 = makeDetail('data', 'database', '3.0.0');

      const lockfileMultiple: LockfileData = {
        lockfileVersion: 1,
        resolvedAt: '2026-01-01T00:00:00Z',
        entries: {
          'compute/service': { version: '1.0.0', source: 'remote-official' },
          'data/database': { version: '2.0.0', source: 'remote-official' },
        },
      };

      vi.mocked(checkUpdatesRemote).mockResolvedValue([
        { namespace: 'compute', name: 'service', latestVersion: '2.0.0' },
        { namespace: 'data', name: 'database', latestVersion: '3.0.0' },
      ]);
      vi.mocked(fetchNodeDefDetail).mockImplementation(async (ns) => {
        if (ns === 'compute') return detail1;
        return detail2;
      });
      vi.mocked(downloadAndInstallNodeDef).mockImplementation(async (_fs, summary) => {
        if (summary.namespace === 'compute') throw new Error('Install failed');
      });

      const fs = new InMemoryFileSystem();
      const result = await syncOfficialNodeDefs(fs, lockfileMultiple);

      expect(result).toBe(true); // data/database was downloaded successfully even though compute failed
      // Both entries should have been attempted
      expect(fetchNodeDefDetail).toHaveBeenCalledTimes(2);
      expect(downloadAndInstallNodeDef).toHaveBeenCalledTimes(2);
    });

    it('continues processing other entries when fetchNodeDefDetail throws for one entry', async () => {
      const detail2 = makeDetail('data', 'database', '3.0.0');

      const lockfileMultiple: LockfileData = {
        lockfileVersion: 1,
        resolvedAt: '2026-01-01T00:00:00Z',
        entries: {
          'compute/service': { version: '1.0.0', source: 'remote-official' },
          'data/database': { version: '2.0.0', source: 'remote-official' },
        },
      };

      vi.mocked(checkUpdatesRemote).mockResolvedValue([
        { namespace: 'compute', name: 'service', latestVersion: '2.0.0' },
        { namespace: 'data', name: 'database', latestVersion: '3.0.0' },
      ]);
      vi.mocked(fetchNodeDefDetail).mockImplementation(async (ns) => {
        if (ns === 'compute') throw new Error('Detail fetch failed');
        return detail2;
      });
      vi.mocked(downloadAndInstallNodeDef).mockResolvedValue(undefined);

      const fs = new InMemoryFileSystem();
      await expect(syncOfficialNodeDefs(fs, lockfileMultiple)).resolves.not.toThrow();

      // fetchNodeDefDetail was called for both; downloadAndInstallNodeDef only for the successful one
      expect(fetchNodeDefDetail).toHaveBeenCalledTimes(2);
      expect(downloadAndInstallNodeDef).toHaveBeenCalledTimes(1);
      expect(downloadAndInstallNodeDef).toHaveBeenCalledWith(
        expect.anything(), detail2.nodedef, 'remote-official',
      );
    });
  });

  describe('Error handling', () => {
    it('swallows top-level errors and always resolves', async () => {
      vi.mocked(checkUpdatesRemote).mockRejectedValue(new Error('Fatal network error'));

      const lockfileWithOfficials: LockfileData = {
        lockfileVersion: 1,
        resolvedAt: '2026-01-01T00:00:00Z',
        entries: {
          'compute/service': { version: '1.0.0', source: 'remote-official' },
        },
      };

      const fs = new InMemoryFileSystem();
      const result = await syncOfficialNodeDefs(fs, lockfileWithOfficials);
      expect(result).toBe(false);
    });

    it('continues downloading remaining items in Branch A when per-namespace install throws', async () => {
      vi.mocked(browseRegistry).mockImplementation(async (opts) => {
        return { items: [makeSummary(opts.namespace!, 'node')], total: 1 };
      });
      let installCount = 0;
      vi.mocked(downloadAndInstallNodeDef).mockImplementation(async (_fs, summary) => {
        installCount++;
        if (summary.namespace === 'compute') throw new Error('Install failed');
      });

      const fs = new InMemoryFileSystem();
      await expect(syncOfficialNodeDefs(fs, null)).resolves.not.toThrow();

      // All 9 namespaces should have been attempted
      expect(installCount).toBe(9);
    });

    it('filters out malformed lockfile keys (no slash) before passing to checkUpdatesRemote', async () => {
      const lockfileWithMalformed: LockfileData = {
        lockfileVersion: 1,
        resolvedAt: '2026-01-01T00:00:00Z',
        entries: {
          'compute/service': { version: '1.0.0', source: 'remote-official' },
          'malformed-key': { version: '1.0.0', source: 'remote-official' },
        },
      };

      vi.mocked(checkUpdatesRemote).mockResolvedValue([]);

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, lockfileWithMalformed);

      const [entries] = vi.mocked(checkUpdatesRemote).mock.calls[0];
      // Only the valid key should be passed
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({ namespace: 'compute', name: 'service' });
    });
  });
});

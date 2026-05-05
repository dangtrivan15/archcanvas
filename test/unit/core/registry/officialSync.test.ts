import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncOfficialNodeDefs } from '@/core/registry/officialSync';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import type { LockfileData } from '@/core/registry/lockfile';

vi.mock('@/core/registry/remoteRegistry', () => ({
  browseRegistry: vi.fn(),
  checkUpdatesRemote: vi.fn(),
}));

vi.mock('@/core/registry/installer', () => ({
  downloadAndInstallNodeDef: vi.fn(),
}));

import { browseRegistry } from '@/core/registry/remoteRegistry';
import { downloadAndInstallNodeDef } from '@/core/registry/installer';

const OFFICIAL_NAMESPACES = [
  'compute', 'data', 'messaging', 'network', 'client',
  'integration', 'security', 'observability', 'ai',
];

function makeSummary(namespace: string, name: string) {
  return { namespace, name, latestVer: '1.0.0', tags: [], downloadCount: 0 };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncOfficialNodeDefs', () => {
  describe('Branch A — no remote-official entries in lockfile', () => {
    it('calls browseRegistry once per namespace (9 times) when lockfile is null', async () => {
      vi.mocked(browseRegistry).mockResolvedValue({ items: [], total: 0 });

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, 'project', null);

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
      await syncOfficialNodeDefs(fs, 'project', lockfile);

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
      await syncOfficialNodeDefs(fs, 'project', null);

      expect(downloadAndInstallNodeDef).toHaveBeenCalledWith(
        fs, 'project', computeSummary, 'remote-official',
      );
      expect(downloadAndInstallNodeDef).toHaveBeenCalledWith(
        fs, 'project', dataSummary, 'remote-official',
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
      await expect(syncOfficialNodeDefs(fs, 'project', null)).resolves.not.toThrow();

      // All 9 namespaces should have been attempted
      expect(callCount).toBe(9);
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
      const { checkUpdatesRemote } = await import('@/core/registry/remoteRegistry');
      vi.mocked(checkUpdatesRemote).mockResolvedValue([]);

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, 'project', lockfileWithOfficials);

      expect(checkUpdatesRemote).toHaveBeenCalledTimes(1);
      expect(checkUpdatesRemote).toHaveBeenCalledWith(
        expect.arrayContaining([
          { namespace: 'compute', name: 'service' },
          { namespace: 'data', name: 'database' },
        ]),
        undefined,
      );
    });

    it('does not call browseRegistry when there are no changed entries', async () => {
      const { checkUpdatesRemote } = await import('@/core/registry/remoteRegistry');
      vi.mocked(checkUpdatesRemote).mockResolvedValue([]);

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, 'project', lockfileWithOfficials);

      expect(browseRegistry).not.toHaveBeenCalled();
    });

    it('downloads only changed entries via browseRegistry', async () => {
      const { checkUpdatesRemote } = await import('@/core/registry/remoteRegistry');
      const updatedSummary = makeSummary('compute', 'service');
      updatedSummary.latestVer = '2.0.0';

      vi.mocked(checkUpdatesRemote).mockResolvedValue([
        { namespace: 'compute', name: 'service', latestVersion: '2.0.0' },
      ]);
      vi.mocked(browseRegistry).mockResolvedValue({ items: [updatedSummary], total: 1 });

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, 'project', lockfileWithOfficials);

      expect(browseRegistry).toHaveBeenCalledTimes(1);
      expect(browseRegistry).toHaveBeenCalledWith({ namespace: 'compute' }, undefined);
      expect(downloadAndInstallNodeDef).toHaveBeenCalledWith(
        fs, 'project', updatedSummary, 'remote-official',
      );
    });

    it('skips install if matching summary not found in browse results', async () => {
      const { checkUpdatesRemote } = await import('@/core/registry/remoteRegistry');
      vi.mocked(checkUpdatesRemote).mockResolvedValue([
        { namespace: 'compute', name: 'service', latestVersion: '2.0.0' },
      ]);
      // Browse returns items from a different name
      vi.mocked(browseRegistry).mockResolvedValue({
        items: [makeSummary('compute', 'other-service')],
        total: 1,
      });

      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, 'project', lockfileWithOfficials);

      expect(downloadAndInstallNodeDef).not.toHaveBeenCalled();
    });

    it('passes signal to checkUpdatesRemote and browseRegistry', async () => {
      const { checkUpdatesRemote } = await import('@/core/registry/remoteRegistry');
      const updatedSummary = makeSummary('compute', 'service');
      vi.mocked(checkUpdatesRemote).mockResolvedValue([
        { namespace: 'compute', name: 'service', latestVersion: '2.0.0' },
      ]);
      vi.mocked(browseRegistry).mockResolvedValue({ items: [updatedSummary], total: 1 });

      const controller = new AbortController();
      const fs = new InMemoryFileSystem();
      await syncOfficialNodeDefs(fs, 'project', lockfileWithOfficials, controller.signal);

      expect(checkUpdatesRemote).toHaveBeenCalledWith(expect.anything(), controller.signal);
      expect(browseRegistry).toHaveBeenCalledWith(expect.anything(), controller.signal);
    });
  });

  describe('Error handling', () => {
    it('swallows top-level errors and always resolves', async () => {
      const { checkUpdatesRemote } = await import('@/core/registry/remoteRegistry');
      vi.mocked(checkUpdatesRemote).mockRejectedValue(new Error('Fatal network error'));

      const lockfileWithOfficials: LockfileData = {
        lockfileVersion: 1,
        resolvedAt: '2026-01-01T00:00:00Z',
        entries: {
          'compute/service': { version: '1.0.0', source: 'remote-official' },
        },
      };

      const fs = new InMemoryFileSystem();
      await expect(syncOfficialNodeDefs(fs, 'project', lockfileWithOfficials)).resolves.not.toThrow();
    });

    it('continues downloading remaining items in Branch A when per-namespace install throws', async () => {
      vi.mocked(browseRegistry).mockImplementation(async (opts) => {
        return { items: [makeSummary(opts.namespace!, 'node')], total: 1 };
      });
      let installCount = 0;
      vi.mocked(downloadAndInstallNodeDef).mockImplementation(async (_fs, _root, summary) => {
        installCount++;
        if (summary.namespace === 'compute') throw new Error('Install failed');
      });

      const fs = new InMemoryFileSystem();
      await expect(syncOfficialNodeDefs(fs, 'project', null)).resolves.not.toThrow();

      // All 9 namespaces should have been attempted
      expect(installCount).toBe(9);
    });
  });
});

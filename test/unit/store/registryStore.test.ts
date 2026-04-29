import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';

const validNodeDefYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: custom-node
  namespace: custom
  version: "1.0.0"
  displayName: Custom Node
  description: A custom node
  icon: Box
  shape: rectangle
spec:
  ports:
    - name: in
      direction: inbound
      protocol: [HTTP]
`;

const invalidNodeDefYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: bad
spec: {}
`;

const overrideNodeDefYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: service
  namespace: compute
  version: "2.0.0"
  displayName: Custom Service
  description: A custom service override
  icon: Box
  shape: rectangle
spec:
  ports:
    - name: in
      direction: inbound
      protocol: [HTTP]
`;

const remoteNodeDefYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: kubernetes-deployment
  namespace: community
  version: "1.0.0"
  displayName: Kubernetes Deployment
  description: A K8s Deployment node
  icon: Box
  shape: rectangle
spec:
  ports: []
`;

describe('registryStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useRegistryStore.setState({
      registry: null,
      status: 'idle',
      builtinCount: 0,
      projectLocalCount: 0,
      projectLocalKeys: new Set(),
      remoteInstalledCount: 0,
      remoteInstalledKeys: new Set(),
      remoteInstalledVersions: new Map(),
      overrides: [],
      loadErrors: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('before initialization — safe no-ops', () => {
    it('resolve returns undefined', () => {
      expect(useRegistryStore.getState().resolve('compute/service')).toBeUndefined();
    });

    it('list returns empty array', () => {
      expect(useRegistryStore.getState().list()).toEqual([]);
    });

    it('search returns empty array', () => {
      expect(useRegistryStore.getState().search('service')).toEqual([]);
    });

    it('listByNamespace returns empty array', () => {
      expect(useRegistryStore.getState().listByNamespace('compute')).toEqual([]);
    });

    it('initial status is idle', () => {
      expect(useRegistryStore.getState().status).toBe('idle');
    });
  });

  describe('initialize', () => {
    it('transitions from idle → loading → ready', async () => {
      // Capture all status values seen during the lifecycle
      const statusHistory: string[] = [useRegistryStore.getState().status];
      const unsub = useRegistryStore.subscribe((state) => {
        statusHistory.push(state.status);
      });

      await useRegistryStore.getState().initialize();
      unsub();

      // Verify correct ordering: idle → loading → ready
      const idleIdx = statusHistory.indexOf('idle');
      const loadingIdx = statusHistory.indexOf('loading');
      const readyIdx = statusHistory.indexOf('ready');
      expect(idleIdx).toBeLessThan(loadingIdx);
      expect(loadingIdx).toBeLessThan(readyIdx);
      // Final state must be ready
      expect(useRegistryStore.getState().status).toBe('ready');
    });

    it('populates registry after initialization', async () => {
      await useRegistryStore.getState().initialize();
      expect(useRegistryStore.getState().registry).not.toBeNull();
    });

    it('accepts optional fs parameter without error (forward-compat)', async () => {
      await expect(useRegistryStore.getState().initialize(undefined)).resolves.toBeUndefined();
    });
  });

  describe('after initialization', () => {
    beforeEach(async () => {
      await useRegistryStore.getState().initialize();
    });

    describe('list', () => {
      it('returns all 32 built-in NodeDefs', () => {
        const defs = useRegistryStore.getState().list();
        expect(defs).toHaveLength(32);
      });

      it('returns NodeDef objects with metadata', () => {
        const defs = useRegistryStore.getState().list();
        expect(defs[0]).toHaveProperty('metadata');
        expect(defs[0].metadata).toHaveProperty('name');
        expect(defs[0].metadata).toHaveProperty('namespace');
      });
    });

    describe('resolve', () => {
      it('returns a NodeDef for known built-in type', () => {
        const def = useRegistryStore.getState().resolve('compute/service');
        expect(def).toBeDefined();
        expect(def?.metadata.namespace).toBe('compute');
        expect(def?.metadata.name).toBe('service');
      });

      it('returns undefined for unknown type', () => {
        expect(useRegistryStore.getState().resolve('nonexistent/type')).toBeUndefined();
      });

      it('returns undefined for empty string', () => {
        expect(useRegistryStore.getState().resolve('')).toBeUndefined();
      });
    });

    describe('search', () => {
      it('finds matching defs by name substring', () => {
        const results = useRegistryStore.getState().search('service');
        expect(results.length).toBeGreaterThan(0);
        // Every result should relate to "service"
        for (const def of results) {
          const { name, displayName, description } = def.metadata;
          const tags = def.metadata.tags ?? [];
          const combined = [name, displayName, description, ...tags].join(' ').toLowerCase();
          expect(combined).toContain('service');
        }
      });

      it('returns empty array for a query with no matches', () => {
        expect(useRegistryStore.getState().search('zzznomatch999')).toEqual([]);
      });

      it('search is case-insensitive', () => {
        const lower = useRegistryStore.getState().search('service');
        const upper = useRegistryStore.getState().search('SERVICE');
        expect(lower).toHaveLength(upper.length);
      });
    });

    describe('listByNamespace', () => {
      it('filters defs by namespace', () => {
        const results = useRegistryStore.getState().listByNamespace('compute');
        expect(results.length).toBeGreaterThan(0);
        for (const def of results) {
          expect(def.metadata.namespace).toBe('compute');
        }
      });

      it('returns empty array for unknown namespace', () => {
        expect(useRegistryStore.getState().listByNamespace('nonexistent')).toEqual([]);
      });

      it('results from all namespaces add up to full list', () => {
        const all = useRegistryStore.getState().list();
        const namespaces = [...new Set(all.map((d) => d.metadata.namespace))];
        const total = namespaces.reduce(
          (sum, ns) => sum + useRegistryStore.getState().listByNamespace(ns).length,
          0,
        );
        expect(total).toBe(all.length);
      });
    });
  });

  describe('initialize with project-local defs', () => {
    it('loads project-local defs when fs and projectRoot are provided', async () => {
      const fs = new InMemoryFileSystem();
      fs.seed({
        'project/.archcanvas/nodedefs/custom.yaml': validNodeDefYaml,
      });

      await useRegistryStore.getState().initialize(fs, 'project');

      const state = useRegistryStore.getState();
      expect(state.status).toBe('ready');
      expect(state.builtinCount).toBe(32);
      expect(state.projectLocalCount).toBe(1);
      expect(state.projectLocalKeys.has('custom/custom-node')).toBe(true);
      expect(state.loadErrors).toHaveLength(0);
    });

    it('sets loadErrors for invalid YAML files', async () => {
      const fs = new InMemoryFileSystem();
      fs.seed({
        'project/.archcanvas/nodedefs/bad.yaml': invalidNodeDefYaml,
      });

      await useRegistryStore.getState().initialize(fs, 'project');

      const state = useRegistryStore.getState();
      expect(state.status).toBe('ready');
      expect(state.projectLocalCount).toBe(0);
      expect(state.loadErrors.length).toBeGreaterThan(0);
      expect(state.loadErrors[0].file).toBe('bad.yaml');
    });

    it('detects overrides when project-local shadows builtin', async () => {
      const fs = new InMemoryFileSystem();
      fs.seed({
        'project/.archcanvas/nodedefs/service.yaml': overrideNodeDefYaml,
      });

      await useRegistryStore.getState().initialize(fs, 'project');

      const state = useRegistryStore.getState();
      expect(state.overrides.length).toBeGreaterThan(0);
    });

    it('initializes cleanly when .archcanvas/nodedefs/ does not exist', async () => {
      const fs = new InMemoryFileSystem();
      await useRegistryStore.getState().initialize(fs, 'project');

      const state = useRegistryStore.getState();
      expect(state.status).toBe('ready');
      expect(state.projectLocalCount).toBe(0);
      expect(state.projectLocalKeys.size).toBe(0);
      expect(state.loadErrors).toHaveLength(0);
    });
  });

  describe('reloadProjectLocal', () => {
    it('updates counts and registry', async () => {
      const fs = new InMemoryFileSystem();
      // Start with no project-local defs
      await useRegistryStore.getState().initialize(fs, 'project');
      expect(useRegistryStore.getState().projectLocalCount).toBe(0);

      // Add a file and reload
      fs.seed({
        'project/.archcanvas/nodedefs/custom.yaml': validNodeDefYaml,
      });
      await useRegistryStore.getState().reloadProjectLocal(fs, 'project');

      expect(useRegistryStore.getState().projectLocalCount).toBe(1);
      expect(useRegistryStore.getState().projectLocalKeys.has('custom/custom-node')).toBe(true);
    });

    it('surfaces errors in loadErrors without crashing', async () => {
      const fs = new InMemoryFileSystem();
      await useRegistryStore.getState().initialize(fs, 'project');

      // Trigger reload with a bad file
      fs.seed({
        'project/.archcanvas/nodedefs/bad.yaml': invalidNodeDefYaml,
      });
      await useRegistryStore.getState().reloadProjectLocal(fs, 'project');

      const state = useRegistryStore.getState();
      // Should still be ready (previous registry preserved if partial)
      expect(state.status).toBe('ready');
      expect(state.loadErrors.length).toBeGreaterThan(0);
    });

    it('keeps previous registry on full failure', async () => {
      const fs = new InMemoryFileSystem();
      fs.seed({
        'project/.archcanvas/nodedefs/custom.yaml': validNodeDefYaml,
      });
      await useRegistryStore.getState().initialize(fs, 'project');
      const prevCount = useRegistryStore.getState().list().length;

      // Simulate by using a fs that throws on exists
      const brokenFs = {
        ...fs,
        exists: async () => { throw new Error('disk error'); },
      } as any;

      await useRegistryStore.getState().reloadProjectLocal(brokenFs, 'project');

      // Previous registry should still work
      expect(useRegistryStore.getState().list().length).toBe(prevCount);
      expect(useRegistryStore.getState().loadErrors).toHaveLength(1);
      expect(useRegistryStore.getState().loadErrors[0].file).toBe('(reload)');
    });

    it('preserves remoteInstalledKeys across reload (regression test)', async () => {
      const fs = new InMemoryFileSystem();

      // Seed a lockfile that marks community/kubernetes-deployment as remote
      const lockfileYaml = [
        '# Auto-generated by ArchCanvas',
        'lockfileVersion: 1',
        "resolvedAt: '2026-01-01T00:00:00.000Z'",
        'entries:',
        '  community/kubernetes-deployment:',
        "    version: '1.0.0'",
        '    source: remote',
      ].join('\n');
      fs.seed({
        'project/.archcanvas/nodedefs/community-kubernetes-deployment.yaml': remoteNodeDefYaml,
        'project/.archcanvas/registry.lock.yaml': lockfileYaml,
      });

      await useRegistryStore.getState().initialize(fs, 'project');
      expect(useRegistryStore.getState().remoteInstalledCount).toBe(1);

      // Reload should preserve the remote classification
      await useRegistryStore.getState().reloadProjectLocal(fs, 'project');
      expect(useRegistryStore.getState().remoteInstalledCount).toBe(1);
      expect(useRegistryStore.getState().remoteInstalledKeys.has('community/kubernetes-deployment')).toBe(true);
    });

    it('populates remoteInstalledVersions from lockfile entries with source:remote', async () => {
      const fs = new InMemoryFileSystem();
      const lockfileYaml = [
        '# Auto-generated by ArchCanvas',
        'lockfileVersion: 1',
        "resolvedAt: '2026-01-01T00:00:00.000Z'",
        'entries:',
        '  community/kubernetes-deployment:',
        "    version: '1.0.0'",
        '    source: remote',
      ].join('\n');
      fs.seed({
        'project/.archcanvas/nodedefs/community-kubernetes-deployment.yaml': remoteNodeDefYaml,
        'project/.archcanvas/registry.lock.yaml': lockfileYaml,
      });

      await useRegistryStore.getState().initialize(fs, 'project');

      const state = useRegistryStore.getState();
      expect(state.remoteInstalledVersions.get('community/kubernetes-deployment')).toBe('1.0.0');
    });
  });

  describe('installRemoteNodeDef', () => {
    it('downloads, writes, and reloads so the def is resolvable', async () => {
      // Mock fetch to return valid YAML
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => remoteNodeDefYaml,
      }));

      const fs = new InMemoryFileSystem();
      await useRegistryStore.getState().initialize(fs, 'project');

      const summary = {
        namespace: 'community',
        name: 'kubernetes-deployment',
        version: '1.0.0',
        displayName: 'Kubernetes Deployment',
      };

      await useRegistryStore.getState().installRemoteNodeDef(fs, 'project', summary);

      // Should now be resolvable
      const def = useRegistryStore.getState().resolve('community/kubernetes-deployment');
      expect(def).toBeDefined();
      expect(def?.metadata.name).toBe('kubernetes-deployment');
    });

    it('after install, remoteInstalledKeys contains the installed key', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => remoteNodeDefYaml,
      }));

      const fs = new InMemoryFileSystem();
      await useRegistryStore.getState().initialize(fs, 'project');

      const summary = {
        namespace: 'community',
        name: 'kubernetes-deployment',
        version: '1.0.0',
      };

      await useRegistryStore.getState().installRemoteNodeDef(fs, 'project', summary);

      const state = useRegistryStore.getState();
      expect(state.remoteInstalledKeys.has('community/kubernetes-deployment')).toBe(true);
      expect(state.remoteInstalledCount).toBe(1);
      expect(state.projectLocalKeys.has('community/kubernetes-deployment')).toBe(false);
    });

    it('throws when download fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }));

      const fs = new InMemoryFileSystem();
      await useRegistryStore.getState().initialize(fs, 'project');

      const summary = {
        namespace: 'community',
        name: 'kubernetes-deployment',
        version: '1.0.0',
      };

      await expect(
        useRegistryStore.getState().installRemoteNodeDef(fs, 'project', summary),
      ).rejects.toThrow('Failed to fetch NodeDef YAML: 503');
    });
  });
});

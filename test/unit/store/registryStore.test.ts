import { describe, it, expect, beforeEach } from 'vitest';
import { useRegistryStore } from '@/store/registryStore';

describe('registryStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useRegistryStore.setState({
      registry: null,
      status: 'idle',
    });
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

      expect(statusHistory).toContain('idle');
      expect(statusHistory).toContain('loading');
      expect(statusHistory).toContain('ready');
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
});

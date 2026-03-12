import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/registry/core';
import type { NodeDef } from '@/types';

function makeNodeDef(
  namespace: string,
  name: string,
  overrides: Partial<{ displayName: string; description: string; tags: string[] }> = {},
): NodeDef {
  return {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      name,
      namespace,
      version: '1.0.0',
      displayName: overrides.displayName ?? name,
      description: overrides.description ?? `A ${name} node`,
      icon: 'Box',
      tags: overrides.tags,
      shape: 'rectangle',
    },
    spec: {
      ports: [{ name: 'in', direction: 'inbound', protocol: ['HTTP'] }],
    },
  };
}

describe('createRegistry', () => {
  const builtinService = makeNodeDef('compute', 'service', {
    displayName: 'Service',
    description: 'A backend service',
    tags: ['backend'],
  });
  const builtinDb = makeNodeDef('data', 'database', {
    displayName: 'Database',
    description: 'A database',
    tags: ['storage'],
  });

  function builtins(): Map<string, NodeDef> {
    return new Map([
      ['compute/service', builtinService],
      ['data/database', builtinDb],
    ]);
  }

  describe('resolve', () => {
    it('resolves built-in by namespace/name', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.resolve('compute/service')).toBe(builtinService);
    });

    it('returns undefined for unknown type', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.resolve('unknown/type')).toBeUndefined();
    });

    it('project-local overrides built-in', () => {
      const localService = makeNodeDef('compute', 'service', {
        displayName: 'Custom Service',
      });
      const projectLocal = new Map([['compute/service', localService]]);
      const { registry } = createRegistry(builtins(), projectLocal);
      expect(registry.resolve('compute/service')).toBe(localService);
    });

    it('resolves project-local only types', () => {
      const custom = makeNodeDef('custom', 'widget');
      const projectLocal = new Map([['custom/widget', custom]]);
      const { registry } = createRegistry(builtins(), projectLocal);
      expect(registry.resolve('custom/widget')).toBe(custom);
    });
  });

  describe('warnings', () => {
    it('no warnings when no overrides', () => {
      const { warnings } = createRegistry(builtins(), new Map());
      expect(warnings).toHaveLength(0);
    });

    it('warns when project-local overrides built-in', () => {
      const localService = makeNodeDef('compute', 'service');
      const projectLocal = new Map([['compute/service', localService]]);
      const { warnings } = createRegistry(builtins(), projectLocal);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('compute/service');
      expect(warnings[0]).toContain('overridden');
    });
  });

  describe('list', () => {
    it('returns all NodeDefs', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.list()).toHaveLength(2);
    });

    it('includes project-local overrides', () => {
      const localService = makeNodeDef('compute', 'service', {
        displayName: 'Custom',
      });
      const projectLocal = new Map([['compute/service', localService]]);
      const { registry } = createRegistry(builtins(), projectLocal);
      const all = registry.list();
      expect(all).toHaveLength(2);
      expect(all.find((d) => d.metadata.name === 'service')?.metadata.displayName).toBe('Custom');
    });
  });

  describe('search', () => {
    it('matches by name', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.search('service')).toHaveLength(1);
    });

    it('matches by displayName', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.search('Database')).toHaveLength(1);
    });

    it('matches by description', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.search('backend')).toHaveLength(1);
    });

    it('matches by tags', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.search('storage')).toHaveLength(1);
    });

    it('is case-insensitive', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.search('SERVICE')).toHaveLength(1);
    });

    it('returns empty for no match', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.search('zzz_nonexistent')).toHaveLength(0);
    });
  });

  describe('listByNamespace', () => {
    it('filters by namespace', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.listByNamespace('compute')).toHaveLength(1);
      expect(registry.listByNamespace('data')).toHaveLength(1);
    });

    it('returns empty for unknown namespace', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.listByNamespace('unknown')).toHaveLength(0);
    });
  });
});

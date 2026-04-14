import { describe, it, expect } from 'vitest';
import { createRegistry } from '@/core/registry/core';
import type { NodeDef } from '@/types';
import type { LockfileData } from '@/core/registry/lockfile';
import type { TypeRef } from '@/core/registry/version';

function makeNodeDef(
  namespace: string,
  name: string,
  overrides: Partial<{ displayName: string; description: string; tags: string[]; version: string }> = {},
): NodeDef {
  return {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      name,
      namespace,
      version: overrides.version ?? '1.0.0',
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

  describe('resolve with @ version suffix', () => {
    it('strips version and resolves to def', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.resolve('data/database@1.0.0')).toBe(builtinDb);
    });

    it('strips caret version and resolves to def', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.resolve('data/database@^1.0.0')).toBe(builtinDb);
    });

    it('returns undefined for unknown type with version', () => {
      const { registry } = createRegistry(builtins(), new Map());
      expect(registry.resolve('unknown/type@1.0.0')).toBeUndefined();
    });
  });

  describe('resolveVersioned', () => {
    it('returns nodeDef and versionMatch: true when no constraint', () => {
      const { registry } = createRegistry(builtins(), new Map());
      const ref: TypeRef = { typeKey: 'data/database' };
      const result = registry.resolveVersioned(ref);
      expect(result.nodeDef).toBe(builtinDb);
      expect(result.versionMatch).toBe(true);
    });

    it('returns versionMatch: true when constraint is satisfied', () => {
      const { registry } = createRegistry(builtins(), new Map());
      const ref: TypeRef = {
        typeKey: 'data/database',
        constraint: { type: 'caret', version: { major: 1, minor: 0, patch: 0 } },
      };
      const result = registry.resolveVersioned(ref);
      expect(result.nodeDef).toBe(builtinDb);
      expect(result.versionMatch).toBe(true);
    });

    it('returns versionMatch: false when constraint is not satisfied', () => {
      const { registry } = createRegistry(builtins(), new Map());
      const ref: TypeRef = {
        typeKey: 'data/database',
        constraint: { type: 'caret', version: { major: 2, minor: 0, patch: 0 } },
      };
      const result = registry.resolveVersioned(ref);
      expect(result.nodeDef).toBe(builtinDb);
      expect(result.versionMatch).toBe(false);
    });

    it('returns nodeDef: undefined for unknown type', () => {
      const { registry } = createRegistry(builtins(), new Map());
      const ref: TypeRef = { typeKey: 'unknown/type' };
      const result = registry.resolveVersioned(ref);
      expect(result.nodeDef).toBeUndefined();
      expect(result.versionMatch).toBe(false);
    });

    it('includes lockfile entry when lockfile is provided', () => {
      const lockfile: LockfileData = {
        lockfileVersion: 1,
        resolvedAt: '2026-04-14T12:00:00Z',
        entries: {
          'data/database': { version: '1.0.0', source: 'builtin' },
        },
      };
      const { registry } = createRegistry(builtins(), new Map(), lockfile);
      const ref: TypeRef = { typeKey: 'data/database' };
      const result = registry.resolveVersioned(ref);
      expect(result.locked).toEqual({ version: '1.0.0', source: 'builtin' });
    });

    it('returns locked: undefined when no lockfile', () => {
      const { registry } = createRegistry(builtins(), new Map());
      const ref: TypeRef = { typeKey: 'data/database' };
      const result = registry.resolveVersioned(ref);
      expect(result.locked).toBeUndefined();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { NodeDef } from '@/types/nodeDefSchema';
import { builtinNodeDefs } from '@/core/registry/builtins';
import { loadBuiltins } from '@/core/registry/loader';

describe('built-in NodeDefs', () => {
  it('has exactly 32 built-in NodeDef objects (C3.2)', () => {
    expect(builtinNodeDefs).toHaveLength(32);
  });

  it('every built-in passes nodeDefSchema.parse() without error (C3.3)', () => {
    for (const def of builtinNodeDefs) {
      const result = NodeDef.safeParse(def);
      if (!result.success) {
        throw new Error(
          `Failed to validate ${def.metadata.namespace}/${def.metadata.name}: ${result.error.message}`,
        );
      }
      expect(result.data.kind).toBe('NodeDef');
      expect(result.data.apiVersion).toBe('v1');
    }
  });

  it('loadBuiltins returns all 32 NodeDefs', () => {
    const map = loadBuiltins();
    expect(map.size).toBe(32);
  });

  it('every built-in has at least one port', () => {
    for (const def of builtinNodeDefs) {
      const key = `${def.metadata.namespace}/${def.metadata.name}`;
      expect(def.spec.ports?.length, `${key} has no ports`).toBeGreaterThan(0);
    }
  });

  it('every built-in has an ai.context string', () => {
    for (const def of builtinNodeDefs) {
      const key = `${def.metadata.namespace}/${def.metadata.name}`;
      expect(def.spec.ai?.context, `${key} has no ai.context`).toBeTruthy();
    }
  });

  it('no duplicate namespace/name combinations', () => {
    const keys = new Set<string>();
    for (const def of builtinNodeDefs) {
      const key = `${def.metadata.namespace}/${def.metadata.name}`;
      expect(keys.has(key), `Duplicate key: ${key}`).toBe(false);
      keys.add(key);
    }
  });

  it('covers all 9 expected namespaces (C3.4)', () => {
    const namespaces = new Set(
      builtinNodeDefs.map((d) => d.metadata.namespace),
    );
    expect(namespaces).toEqual(
      new Set([
        'compute',
        'data',
        'messaging',
        'network',
        'client',
        'integration',
        'security',
        'observability',
        'ai',
      ]),
    );
  });

  it('builtinNodeDefs is a static array (C3.1, C3.5)', () => {
    // Verify it's a plain array of objects, not the result of YAML parsing
    expect(Array.isArray(builtinNodeDefs)).toBe(true);
    for (const def of builtinNodeDefs) {
      expect(typeof def).toBe('object');
      expect(def).not.toBeNull();
      expect(def.kind).toBe('NodeDef');
    }
  });
});

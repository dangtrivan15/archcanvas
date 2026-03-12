import { describe, it, expect } from 'vitest';
import { loadBuiltins } from '@/core/registry/loader';
import { parseNodeDef } from '@/core/registry/validator';
import { builtinYamlStrings } from '@/core/registry/builtins';

describe('built-in NodeDefs', () => {
  it('has exactly 32 built-in YAML strings', () => {
    expect(builtinYamlStrings).toHaveLength(32);
  });

  it('every built-in parses without error', () => {
    for (const yaml of builtinYamlStrings) {
      const result = parseNodeDef(yaml);
      if ('error' in result) {
        throw new Error(`Failed to parse built-in: ${result.error}`);
      }
      expect(result.nodeDef.kind).toBe('NodeDef');
      expect(result.nodeDef.apiVersion).toBe('v1');
    }
  });

  it('loadBuiltins returns all 32 NodeDefs', () => {
    const map = loadBuiltins();
    expect(map.size).toBe(32);
  });

  it('every built-in has at least one port', () => {
    const map = loadBuiltins();
    for (const [key, def] of map) {
      expect(def.spec.ports?.length, `${key} has no ports`).toBeGreaterThan(0);
    }
  });

  it('every built-in has an ai.context string', () => {
    const map = loadBuiltins();
    for (const [key, def] of map) {
      expect(def.spec.ai?.context, `${key} has no ai.context`).toBeTruthy();
    }
  });

  it('no duplicate namespace/name combinations', () => {
    const keys = new Set<string>();
    for (const yaml of builtinYamlStrings) {
      const result = parseNodeDef(yaml);
      if ('error' in result) continue;
      const key = `${result.nodeDef.metadata.namespace}/${result.nodeDef.metadata.name}`;
      expect(keys.has(key), `Duplicate key: ${key}`).toBe(false);
      keys.add(key);
    }
  });

  it('covers all 9 expected namespaces', () => {
    const map = loadBuiltins();
    const namespaces = new Set(
      Array.from(map.values()).map((d) => d.metadata.namespace),
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
});

import { describe, it, expect } from 'vitest';
import { parseNodeDef } from '@/core/registry/validator';
import { stringify } from 'yaml';
import { builtinNodeDefs } from '@/core/registry/builtins';

describe('Schema compatibility', () => {
  it('parseNodeDef is importable and functional', () => {
    const result = parseNodeDef(`
kind: NodeDef
apiVersion: v1
metadata:
  name: test
  namespace: test
  version: "1.0.0"
  displayName: Test
  description: "Test NodeDef"
  icon: Box
  shape: rectangle
spec: {}
`);
    expect('nodeDef' in result).toBe(true);
  });

  it('all built-in NodeDefs are valid when round-tripped through YAML', () => {
    expect(builtinNodeDefs.length).toBeGreaterThan(0);

    for (const nodeDef of builtinNodeDefs) {
      const yamlStr = stringify(nodeDef);
      const result = parseNodeDef(yamlStr);

      if ('error' in result) {
        throw new Error(
          `Built-in NodeDef ${nodeDef.metadata.namespace}/${nodeDef.metadata.name} ` +
            `failed validation after YAML round-trip: ${result.error}`,
        );
      }

      expect(result.nodeDef.metadata.name).toBe(nodeDef.metadata.name);
      expect(result.nodeDef.metadata.namespace).toBe(
        nodeDef.metadata.namespace,
      );
    }
  });

  it('rejects invalid NodeDef', () => {
    const result = parseNodeDef('invalid: yaml');
    expect('error' in result).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  validateAndBuildNode,
  type NodeDefLookup,
  type AddNodeInput,
} from '@/core/validation/addNodeValidation';
import type { NodeDef } from '@/types/nodeDefSchema';

// ---------------------------------------------------------------------------
// Fake NodeDef factory
// ---------------------------------------------------------------------------

function fakeNodeDef(overrides: {
  namespace: string;
  name: string;
  displayName?: string;
}): NodeDef {
  return {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      namespace: overrides.namespace,
      name: overrides.name,
      version: '1.0.0',
      displayName: overrides.displayName ?? overrides.name,
      description: `A ${overrides.name}`,
      icon: 'box',
      tags: [overrides.namespace],
      shape: 'rectangle',
    },
    spec: {},
  };
}

// ---------------------------------------------------------------------------
// Fake registry
// ---------------------------------------------------------------------------

function createFakeLookup(defs: NodeDef[]): NodeDefLookup {
  return {
    resolve(type: string): NodeDef | undefined {
      return defs.find(
        (d) => `${d.metadata.namespace}/${d.metadata.name}` === type,
      );
    },
    search(query: string): NodeDef[] {
      const q = query.toLowerCase();
      return defs.filter(
        (d) =>
          d.metadata.name.toLowerCase().includes(q) ||
          d.metadata.displayName.toLowerCase().includes(q) ||
          d.metadata.description.toLowerCase().includes(q) ||
          (d.metadata.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    },
    listByNamespace(namespace: string): NodeDef[] {
      return defs.filter((d) => d.metadata.namespace === namespace);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateAndBuildNode', () => {
  const serviceDef = fakeNodeDef({
    namespace: 'compute',
    name: 'service',
    displayName: 'Service',
  });
  const databaseDef = fakeNodeDef({
    namespace: 'storage',
    name: 'database',
    displayName: 'Database',
  });
  const cacheDef = fakeNodeDef({
    namespace: 'storage',
    name: 'cache',
    displayName: 'Cache',
  });

  const registry = createFakeLookup([serviceDef, databaseDef, cacheDef]);

  it('resolves a valid type and returns ok with correct displayName', () => {
    const input: AddNodeInput = {
      id: 'svc-1',
      type: 'compute/service',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.id).toBe('svc-1');
      expect(result.node.type).toBe('compute/service');
      expect(result.node.displayName).toBe('Service');
      expect(result.resolvedType).toBe('compute/service');
    }
  });

  it('resolves dot notation via dot→slash substitution', () => {
    const input: AddNodeInput = {
      id: 'svc-dot',
      type: 'compute.service',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.type).toBe('compute/service');
      expect(result.resolvedType).toBe('compute/service');
      expect(result.node.displayName).toBe('Service');
    }
  });

  it('returns error with suggestions for unknown type', () => {
    const input: AddNodeInput = {
      id: 'x',
      type: 'compute/nonexistent',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNKNOWN_NODE_TYPE');
      expect(result.message).toContain("Node type 'compute/nonexistent' is not registered.");
      // Should include similar types from search/namespace
      expect(result.message).toContain('compute/service');
    }
  });

  it('includes "Did you mean?" for unknown type with dot notation', () => {
    const input: AddNodeInput = {
      id: 'x',
      type: 'storage.nonexistent',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNKNOWN_NODE_TYPE');
      expect(result.message).toContain("Did you mean 'storage/nonexistent'?");
    }
  });

  it('returns INVALID_ARGS for malformed JSON args', () => {
    const input: AddNodeInput = {
      id: 'svc-bad',
      type: 'compute/service',
      args: '{bad json',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_ARGS');
      expect(result.message).toContain('{bad json');
    }
  });

  it('parses valid JSON args and includes them in node', () => {
    const input: AddNodeInput = {
      id: 'svc-args',
      type: 'compute/service',
      args: '{"port":"8080","replicas":"3"}',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.args).toEqual({ port: '8080', replicas: '3' });
    }
  });

  it('uses provided name override instead of NodeDef displayName', () => {
    const input: AddNodeInput = {
      id: 'svc-named',
      type: 'compute/service',
      name: 'My Custom API',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.displayName).toBe('My Custom API');
    }
  });

  it('falls back to NodeDef displayName when no name provided', () => {
    const input: AddNodeInput = {
      id: 'svc-default',
      type: 'storage/database',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.displayName).toBe('Database');
    }
  });

  it('resolves type with valid version constraint via @', () => {
    const input: AddNodeInput = {
      id: 'svc-ver',
      type: 'compute/service@^1.0.0',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.type).toBe('compute/service@^1.0.0');
      expect(result.resolvedType).toBe('compute/service@^1.0.0');
    }
  });

  it('silently ignores invalid version constraint after @', () => {
    const input: AddNodeInput = {
      id: 'svc-bad-ver',
      type: 'compute/service@badversion',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Invalid constraint is silently ignored — type resolves normally
      expect(result.node.type).toBe('compute/service@badversion');
      expect(result.resolvedType).toBe('compute/service@badversion');
    }
  });

  it('resolves dot notation with invalid version via dot→slash substitution', () => {
    const input: AddNodeInput = {
      id: 'svc-dot-bad-ver',
      type: 'compute.service@badversion',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // dot→slash substitution works; invalid constraint has no prefix so formatConstraint isn't called
      expect(result.node.type).toBe('compute/service');
      expect(result.resolvedType).toBe('compute/service');
    }
  });

  it('resolves dot notation with valid version constraint', () => {
    const input: AddNodeInput = {
      id: 'svc-dot-ver',
      type: 'compute.service@^1.0.0',
    };
    const result = validateAndBuildNode(input, registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.type).toBe('compute/service@^1.0.0');
      expect(result.resolvedType).toBe('compute/service@^1.0.0');
    }
  });
});

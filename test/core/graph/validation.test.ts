import { describe, it, expect } from 'vitest';
import { validateNode, validateEdge, validateCanvas } from '@/core/graph/validation';
import {
  makeCanvas,
  makeNode,
  makeRefNode,
  makeEdge,
  makeEntity,
  serviceNodeDef,
  registryWith,
  makeMockRegistry,
} from './helpers';

// --- validateNode ---

describe('validateNode', () => {
  it('returns empty array for a ref node', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const result = validateNode(makeRefNode(), registry);
    expect(result).toEqual([]);
  });

  it('warns on unknown node type', () => {
    const registry = makeMockRegistry();
    const node = makeNode({ type: 'unknown/thing' });
    const result = validateNode(node, registry);
    expect(result).toEqual([
      { code: 'UNKNOWN_NODE_TYPE', type: 'unknown/thing' },
    ]);
  });

  it('returns empty array when node is valid', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const node = makeNode({ args: { runtime: 'node' } });
    const result = validateNode(node, registry);
    expect(result).toEqual([]);
  });

  it('warns on required arg missing', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const node = makeNode({ args: {} }); // missing 'runtime' (required)
    const result = validateNode(node, registry);
    expect(result).toContainEqual({
      code: 'INVALID_ARG',
      nodeId: 'test-node',
      arg: 'runtime',
      reason: 'required argument missing',
    });
  });

  it('warns on invalid enum value', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const node = makeNode({ args: { runtime: 'python' } });
    const result = validateNode(node, registry);
    expect(result).toContainEqual({
      code: 'INVALID_ARG',
      nodeId: 'test-node',
      arg: 'runtime',
      reason: 'invalid enum value, expected one of [node, go, rust]',
    });
  });

  it('warns on unknown argument', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const node = makeNode({ args: { runtime: 'node', bogus: 'val' } });
    const result = validateNode(node, registry);
    expect(result).toContainEqual({
      code: 'INVALID_ARG',
      nodeId: 'test-node',
      arg: 'bogus',
      reason: 'unknown argument',
    });
  });
});

// --- validateEdge ---

describe('validateEdge', () => {
  it('returns empty array when no ports specified', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
    });
    const edge = makeEdge({ from: { node: 'a' }, to: { node: 'b' } });
    const result = validateEdge(edge, canvas, registry);
    expect(result).toEqual([]);
  });

  it('warns on unknown port', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
    });
    const edge = makeEdge({
      from: { node: 'a', port: 'nonexistent' },
      to: { node: 'b' },
    });
    const result = validateEdge(edge, canvas, registry);
    expect(result).toContainEqual({
      code: 'UNKNOWN_PORT',
      nodeId: 'a',
      port: 'nonexistent',
    });
  });

  it('warns on port direction mismatch (inbound used as from)', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
    });
    // 'http-in' is inbound, but used in the 'from' position (should be outbound)
    const edge = makeEdge({
      from: { node: 'a', port: 'http-in' },
      to: { node: 'b' },
    });
    const result = validateEdge(edge, canvas, registry);
    expect(result).toContainEqual({
      code: 'INVALID_PORT_DIRECTION',
      nodeId: 'a',
      port: 'http-in',
      expected: 'outbound',
    });
  });

  it('skips port checks when node type is unknown', () => {
    const registry = makeMockRegistry(); // empty — no types resolve
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a', type: 'unknown/x' })],
    });
    const edge = makeEdge({
      from: { node: 'a', port: 'anything' },
      to: { node: 'b' },
    });
    const result = validateEdge(edge, canvas, registry);
    expect(result).toEqual([]);
  });

  it('skips port checks for @ cross-scope references', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' })],
    });
    const edge = makeEdge({
      from: { node: 'a', port: 'http-out' },
      to: { node: '@db-svc/db-postgres', port: 'sql-in' },
    });
    const result = validateEdge(edge, canvas, registry);
    // Only from-port checked, to-port skipped because @ prefix
    expect(result).toEqual([]);
  });

  it('validates correct port directions', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
    });
    const edge = makeEdge({
      from: { node: 'a', port: 'http-out' },
      to: { node: 'b', port: 'http-in' },
    });
    const result = validateEdge(edge, canvas, registry);
    expect(result).toEqual([]);
  });
});

// --- validateCanvas ---

describe('validateCanvas', () => {
  it('combines node and edge warnings', () => {
    const registry = makeMockRegistry(); // empty — all types unknown
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a', type: 'x/y' }), makeNode({ id: 'b', type: 'x/z' })],
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' } })],
    });
    const result = validateCanvas(canvas, registry);
    expect(result).toContainEqual({ code: 'UNKNOWN_NODE_TYPE', type: 'x/y' });
    expect(result).toContainEqual({ code: 'UNKNOWN_NODE_TYPE', type: 'x/z' });
  });

  it('detects unreferenced entities', () => {
    const registry = makeMockRegistry();
    const canvas = makeCanvas({
      entities: [makeEntity({ name: 'Order' }), makeEntity({ name: 'User' })],
      edges: [
        makeEdge({
          from: { node: 'a' },
          to: { node: 'b' },
          entities: ['Order'],
        }),
      ],
    });
    const result = validateCanvas(canvas, registry);
    expect(result).toContainEqual({
      code: 'ENTITY_UNREFERENCED',
      name: 'User',
    });
    expect(result).not.toContainEqual({
      code: 'ENTITY_UNREFERENCED',
      name: 'Order',
    });
  });

  it('deduplicates warnings', () => {
    const registry = makeMockRegistry();
    // Two nodes with the same unknown type
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'a', type: 'unknown/dup' }),
        makeNode({ id: 'b', type: 'unknown/dup' }),
      ],
    });
    const result = validateCanvas(canvas, registry);
    const unknownTypeWarnings = result.filter(
      (w) => w.code === 'UNKNOWN_NODE_TYPE' && w.type === 'unknown/dup',
    );
    // Each node produces its own warning with the same code+type — both kept because
    // they come from different nodes (but the warning payload is identical here, so
    // dedup collapses them to one)
    expect(unknownTypeWarnings).toHaveLength(1);
  });

  it('returns empty array for a clean canvas', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'a', args: { runtime: 'node' } }),
        makeNode({ id: 'b', args: { runtime: 'go' } }),
      ],
      edges: [
        makeEdge({
          from: { node: 'a', port: 'http-out' },
          to: { node: 'b', port: 'http-in' },
          entities: ['Order'],
        }),
      ],
      entities: [makeEntity({ name: 'Order' })],
    });
    const result = validateCanvas(canvas, registry);
    expect(result).toEqual([]);
  });
});

// --- VERSION_MISMATCH ---

describe('VERSION_MISMATCH', () => {
  it('does not warn when version satisfies caret constraint', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const node = makeNode({ type: 'compute/service@^1.0.0', args: { runtime: 'node' } });
    const result = validateNode(node, registry);
    expect(result.filter(w => w.code === 'VERSION_MISMATCH')).toHaveLength(0);
  });

  it('warns when version does not satisfy caret constraint', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const node = makeNode({ id: 'svc-1', type: 'compute/service@^2.0.0', args: { runtime: 'node' } });
    const result = validateNode(node, registry);
    expect(result).toContainEqual({
      code: 'VERSION_MISMATCH',
      nodeId: 'svc-1',
      type: 'compute/service@^2.0.0',
      constraint: '^2.0.0',
      actual: '1.0.0',
    });
  });

  it('does not warn for bare type without version constraint', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const node = makeNode({ type: 'compute/service', args: { runtime: 'node' } });
    const result = validateNode(node, registry);
    expect(result.filter(w => w.code === 'VERSION_MISMATCH')).toHaveLength(0);
  });

  it('deduplicates VERSION_MISMATCH in validateCanvas', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'a', type: 'compute/service@^2.0.0' }),
        makeNode({ id: 'b', type: 'compute/service@^2.0.0' }),
      ],
    });
    const result = validateCanvas(canvas, registry);
    // Two different nodeIds produce different dedup keys, so both should appear
    const versionWarnings = result.filter(w => w.code === 'VERSION_MISMATCH');
    expect(versionWarnings).toHaveLength(2);
  });
});

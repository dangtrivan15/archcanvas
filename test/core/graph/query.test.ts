import { describe, it, expect } from 'vitest';
import type { CanvasFile } from '@/types';
import type { LoadedCanvas } from '@/storage/fileResolver';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import {
  findNode,
  findEdge,
  listNodes,
  listEdges,
  listEntities,
  findNodeAcrossScopes,
  findEdgesReferencingNode,
  findEdgesReferencingEntity,
  findRefsToSubsystem,
  searchGraph,
} from '@/core/graph/query';
import { makeCanvas, makeNode, makeRefNode, makeEdge, makeEntity } from './helpers';

function makeLoadedCanvas(data: CanvasFile, filePath = 'test.yaml'): LoadedCanvas {
  return { filePath, data, doc: {} as any };
}

// ────────────────────────────────────────────
// Single-Canvas Queries
// ────────────────────────────────────────────

describe('findNode', () => {
  it('returns the node when found', () => {
    const node = makeNode({ id: 'svc-a' });
    const canvas = makeCanvas({ nodes: [node] });
    expect(findNode(canvas, 'svc-a')).toEqual(node);
  });

  it('returns undefined when not found', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'svc-a' })] });
    expect(findNode(canvas, 'svc-b')).toBeUndefined();
  });

  it('returns undefined for empty canvas (nodes undefined)', () => {
    const canvas = makeCanvas({ nodes: undefined });
    expect(findNode(canvas, 'svc-a')).toBeUndefined();
  });
});

describe('findEdge', () => {
  it('returns the edge when found', () => {
    const edge = makeEdge({ from: { node: 'a' }, to: { node: 'b' } });
    const canvas = makeCanvas({ edges: [edge] });
    expect(findEdge(canvas, 'a', 'b')).toEqual(edge);
  });

  it('returns undefined when not found', () => {
    const edge = makeEdge({ from: { node: 'a' }, to: { node: 'b' } });
    const canvas = makeCanvas({ edges: [edge] });
    expect(findEdge(canvas, 'a', 'c')).toBeUndefined();
  });
});

describe('listNodes', () => {
  it('returns all nodes', () => {
    const nodes = [makeNode({ id: 'a' }), makeNode({ id: 'b' })];
    const canvas = makeCanvas({ nodes });
    expect(listNodes(canvas)).toEqual(nodes);
  });

  it('returns empty array when nodes undefined', () => {
    const canvas = makeCanvas({ nodes: undefined });
    expect(listNodes(canvas)).toEqual([]);
  });

  it('returns empty array when nodes empty', () => {
    const canvas = makeCanvas({ nodes: [] });
    expect(listNodes(canvas)).toEqual([]);
  });
});

describe('listEdges', () => {
  it('returns all edges', () => {
    const edges = [makeEdge()];
    const canvas = makeCanvas({ edges });
    expect(listEdges(canvas)).toEqual(edges);
  });

  it('returns empty array when edges undefined', () => {
    const canvas = makeCanvas({ edges: undefined });
    expect(listEdges(canvas)).toEqual([]);
  });
});

describe('listEntities', () => {
  it('returns all entities', () => {
    const entities = [makeEntity({ name: 'Order' }), makeEntity({ name: 'User' })];
    const canvas = makeCanvas({ entities });
    expect(listEntities(canvas)).toEqual(entities);
  });

  it('returns empty array when entities undefined', () => {
    const canvas = makeCanvas({ entities: undefined });
    expect(listEntities(canvas)).toEqual([]);
  });
});

// ────────────────────────────────────────────
// Cross-Scope Queries
// ────────────────────────────────────────────

function makeTwoCanvasMap(): Map<string, LoadedCanvas> {
  const root = makeCanvas({
    nodes: [
      makeNode({ id: 'db-postgres', type: 'storage/database', displayName: 'PostgreSQL' }),
      makeRefNode({ id: 'svc-auth', ref: 'auth-service' }),
    ],
    edges: [
      makeEdge({ from: { node: 'svc-auth' }, to: { node: 'db-postgres' }, label: 'reads from' }),
    ],
    entities: [makeEntity({ name: 'User' })],
  });

  const sub = makeCanvas({
    nodes: [
      makeNode({ id: 'handler', type: 'compute/function', displayName: 'Auth Handler' }),
      makeNode({ id: 'cache', type: 'storage/cache', displayName: 'Redis Cache' }),
    ],
    edges: [
      makeEdge({
        from: { node: 'handler' },
        to: { node: '@root/db-postgres' },
        label: 'writes to',
        entities: ['User'],
      }),
      makeEdge({
        from: { node: 'handler' },
        to: { node: 'cache' },
        protocol: 'redis',
        entities: ['Session'],
      }),
    ],
    entities: [
      makeEntity({ name: 'Session', description: 'User session token' }),
    ],
  });

  const canvases = new Map<string, LoadedCanvas>();
  canvases.set(ROOT_CANVAS_KEY, makeLoadedCanvas(root, 'main.yaml'));
  canvases.set('auth-service', makeLoadedCanvas(sub, 'auth-service.yaml'));
  return canvases;
}

describe('findNodeAcrossScopes', () => {
  it('finds node in root canvas', () => {
    const canvases = makeTwoCanvasMap();
    const result = findNodeAcrossScopes(canvases, 'db-postgres');
    expect(result).toBeDefined();
    expect(result!.canvasId).toBe(ROOT_CANVAS_KEY);
    expect(result!.node.id).toBe('db-postgres');
  });

  it('finds node in sub canvas', () => {
    const canvases = makeTwoCanvasMap();
    const result = findNodeAcrossScopes(canvases, 'handler');
    expect(result).toBeDefined();
    expect(result!.canvasId).toBe('auth-service');
    expect(result!.node.id).toBe('handler');
  });

  it('returns undefined when node not found', () => {
    const canvases = makeTwoCanvasMap();
    expect(findNodeAcrossScopes(canvases, 'nonexistent')).toBeUndefined();
  });
});

describe('findEdgesReferencingNode', () => {
  it('finds edges with direct node match', () => {
    const canvases = makeTwoCanvasMap();
    const results = findEdgesReferencingNode(canvases, 'handler');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.canvasId === 'auth-service')).toBe(true);
  });

  it('finds edges via @root/ prefix match', () => {
    const canvases = makeTwoCanvasMap();
    const results = findEdgesReferencingNode(canvases, 'db-postgres');
    // Root canvas: svc-auth -> db-postgres (direct)
    // Sub canvas: handler -> @root/db-postgres (@root/ match)
    expect(results).toHaveLength(2);
    const canvasIds = results.map((r) => r.canvasId);
    expect(canvasIds).toContain(ROOT_CANVAS_KEY);
    expect(canvasIds).toContain('auth-service');
  });

  it('returns empty array when no matches', () => {
    const canvases = makeTwoCanvasMap();
    expect(findEdgesReferencingNode(canvases, 'nonexistent')).toEqual([]);
  });
});

describe('findEdgesReferencingEntity', () => {
  it('finds edges referencing entity across canvases', () => {
    const canvases = makeTwoCanvasMap();
    const results = findEdgesReferencingEntity(canvases, 'User');
    expect(results).toHaveLength(1);
    expect(results[0].canvasId).toBe('auth-service');
    expect(results[0].edge.entities).toContain('User');
  });

  it('finds entity referenced in multiple edges', () => {
    const canvases = makeTwoCanvasMap();
    const results = findEdgesReferencingEntity(canvases, 'Session');
    expect(results).toHaveLength(1);
    expect(results[0].canvasId).toBe('auth-service');
  });

  it('returns empty array when entity not referenced', () => {
    const canvases = makeTwoCanvasMap();
    expect(findEdgesReferencingEntity(canvases, 'Order')).toEqual([]);
  });
});

describe('findRefsToSubsystem', () => {
  it('finds ref nodes pointing to subsystem', () => {
    const canvases = makeTwoCanvasMap();
    const results = findRefsToSubsystem(canvases, 'auth-service');
    expect(results).toHaveLength(1);
    expect(results[0].canvasId).toBe(ROOT_CANVAS_KEY);
    expect(results[0].nodeId).toBe('svc-auth');
  });

  it('finds multiple refs across canvases', () => {
    const third = makeCanvas({
      nodes: [makeRefNode({ id: 'auth-ref', ref: 'auth-service' })],
    });
    const canvases = makeTwoCanvasMap();
    canvases.set('other-service', makeLoadedCanvas(third));

    const results = findRefsToSubsystem(canvases, 'auth-service');
    expect(results).toHaveLength(2);
    const nodeIds = results.map((r) => r.nodeId);
    expect(nodeIds).toContain('svc-auth');
    expect(nodeIds).toContain('auth-ref');
  });

  it('returns empty array when no refs match', () => {
    const canvases = makeTwoCanvasMap();
    expect(findRefsToSubsystem(canvases, 'payment-service')).toEqual([]);
  });
});

// ────────────────────────────────────────────
// Search
// ────────────────────────────────────────────

describe('searchGraph', () => {
  it('returns empty array for empty query', () => {
    const canvases = makeTwoCanvasMap();
    expect(searchGraph(canvases, '')).toEqual([]);
  });

  it('ranks node displayName highest (20 points)', () => {
    const canvases = makeTwoCanvasMap();
    const results = searchGraph(canvases, 'PostgreSQL');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].type).toBe('node');
    if (results[0].type === 'node') {
      expect(results[0].nodeId).toBe('db-postgres');
      expect(results[0].score).toBe(20);
      expect(results[0].matchContext).toBe('PostgreSQL');
    }
  });

  it('searches case-insensitively', () => {
    const canvases = makeTwoCanvasMap();
    const results = searchGraph(canvases, 'postgresql');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].type).toBe('node');
  });

  it('finds entities by name (15 points)', () => {
    const canvases = makeTwoCanvasMap();
    const results = searchGraph(canvases, 'Session');
    const entityResults = results.filter((r) => r.type === 'entity');
    expect(entityResults.length).toBeGreaterThanOrEqual(1);
    expect(entityResults[0].score).toBeGreaterThanOrEqual(15);
  });

  it('finds edges by label (10 points)', () => {
    const canvases = makeTwoCanvasMap();
    const results = searchGraph(canvases, 'reads from');
    const edgeResults = results.filter((r) => r.type === 'edge');
    expect(edgeResults).toHaveLength(1);
    expect(edgeResults[0].score).toBe(10);
  });

  it('finds edges by protocol (5 points)', () => {
    const canvases = makeTwoCanvasMap();
    const results = searchGraph(canvases, 'redis');
    const edgeResults = results.filter((r) => r.type === 'edge');
    expect(edgeResults).toHaveLength(1);
    expect(edgeResults[0].score).toBe(5);
  });

  it('accumulates score when multiple fields match', () => {
    // Create a node where displayName and description both contain the query
    const canvas = makeCanvas({
      nodes: [
        makeNode({
          id: 'svc-auth',
          type: 'auth-service',
          displayName: 'Auth Service',
          description: 'Handles auth tokens',
        }),
      ],
    });
    const canvases = new Map<string, LoadedCanvas>();
    canvases.set(ROOT_CANVAS_KEY, makeLoadedCanvas(canvas));

    const results = searchGraph(canvases, 'auth');
    expect(results).toHaveLength(1);
    // displayName "Auth Service" = 20, type "auth-service" = 10, description "Handles auth tokens" = 5
    expect(results[0].score).toBe(35);
  });

  it('searches across multiple canvases', () => {
    const canvases = makeTwoCanvasMap();
    // "cache" matches node displayName "Redis Cache" in sub canvas
    const results = searchGraph(canvases, 'cache');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const nodeResults = results.filter((r) => r.type === 'node');
    expect(nodeResults.some((r) => r.type === 'node' && r.nodeId === 'cache')).toBe(true);
  });

  it('sorts results by score descending', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'high', type: 'compute/service', displayName: 'test-service' }),
        makeNode({ id: 'low', type: 'test-type' }),
      ],
    });
    const canvases = new Map<string, LoadedCanvas>();
    canvases.set(ROOT_CANVAS_KEY, makeLoadedCanvas(canvas));

    const results = searchGraph(canvases, 'test');
    expect(results.length).toBe(2);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    // 'high' matches displayName (20) + type is "compute/service" (no match) = 20? No:
    // 'high' displayName "test-service" = 20
    // 'low' type "test-type" = 10
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('uses matchContext from highest-scoring field', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({
          id: 'svc',
          type: 'compute/service',
          displayName: 'Data Pipeline',
          description: 'Processes data from multiple sources',
        }),
      ],
    });
    const canvases = new Map<string, LoadedCanvas>();
    canvases.set(ROOT_CANVAS_KEY, makeLoadedCanvas(canvas));

    const results = searchGraph(canvases, 'data');
    expect(results).toHaveLength(1);
    // displayName "Data Pipeline" = 20, description "Processes data..." = 5
    // matchContext should be from highest-scoring: displayName
    expect(results[0].matchContext).toBe('Data Pipeline');
  });

  it('includes edge displayName as label when present, fallback to from/to', () => {
    const canvas = makeCanvas({
      edges: [
        makeEdge({
          from: { node: 'a' },
          to: { node: 'b' },
          label: 'fetches data',
        }),
        makeEdge({
          from: { node: 'c' },
          to: { node: 'd' },
          protocol: 'data-stream',
        }),
      ],
    });
    const canvases = new Map<string, LoadedCanvas>();
    canvases.set(ROOT_CANVAS_KEY, makeLoadedCanvas(canvas));

    const results = searchGraph(canvases, 'data');
    expect(results).toHaveLength(2);

    const withLabel = results.find((r) => r.type === 'edge' && r.from === 'a');
    expect(withLabel).toBeDefined();
    if (withLabel && withLabel.type === 'edge') {
      expect(withLabel.displayName).toBe('fetches data');
    }

    const withoutLabel = results.find((r) => r.type === 'edge' && r.from === 'c');
    expect(withoutLabel).toBeDefined();
    if (withoutLabel && withoutLabel.type === 'edge') {
      expect(withoutLabel.displayName).toContain('c');
      expect(withoutLabel.displayName).toContain('d');
    }
  });

  it('searches node args values', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({
          id: 'db',
          type: 'storage/database',
          args: { engine: 'mysql', port: 3306 },
        }),
      ],
    });
    const canvases = new Map<string, LoadedCanvas>();
    canvases.set(ROOT_CANVAS_KEY, makeLoadedCanvas(canvas));

    const results = searchGraph(canvases, 'mysql');
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(5);
    expect(results[0].matchContext).toBe('mysql');
  });

  it('does not search type/args/description on RefNode', () => {
    const canvas = makeCanvas({
      nodes: [makeRefNode({ id: 'ref-svc', ref: 'some-service' })],
    });
    const canvases = new Map<string, LoadedCanvas>();
    canvases.set(ROOT_CANVAS_KEY, makeLoadedCanvas(canvas));

    // "some-service" is the ref, not searchable
    const results = searchGraph(canvases, 'some-service');
    expect(results).toEqual([]);
  });

  it('returns node displayName for InlineNode, id for RefNode', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'svc-a', type: 'compute/service', displayName: 'Service Alpha' }),
        makeNode({ id: 'svc-b', type: 'compute/service' }),
      ],
    });
    const canvases = new Map<string, LoadedCanvas>();
    canvases.set(ROOT_CANVAS_KEY, makeLoadedCanvas(canvas));

    const results = searchGraph(canvases, 'service');
    // Both match on type "compute/service"
    const svcA = results.find((r) => r.type === 'node' && r.nodeId === 'svc-a');
    const svcB = results.find((r) => r.type === 'node' && r.nodeId === 'svc-b');

    expect(svcA).toBeDefined();
    expect(svcB).toBeDefined();
    // svc-a has displayName "Service Alpha" which also matches -> 20 + 10 = 30
    // Its displayName in result should be "Service Alpha"
    if (svcA && svcA.type === 'node') {
      expect(svcA.displayName).toBe('Service Alpha');
    }
    // svc-b has no displayName -> fallback to id
    if (svcB && svcB.type === 'node') {
      expect(svcB.displayName).toBe('svc-b');
    }
  });

  it('searches entity description', () => {
    const canvas = makeCanvas({
      entities: [
        makeEntity({ name: 'Token', description: 'JWT authentication token' }),
      ],
    });
    const canvases = new Map<string, LoadedCanvas>();
    canvases.set(ROOT_CANVAS_KEY, makeLoadedCanvas(canvas));

    const results = searchGraph(canvases, 'JWT');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('entity');
    expect(results[0].score).toBe(5);
    expect(results[0].matchContext).toBe('JWT authentication token');
  });
});

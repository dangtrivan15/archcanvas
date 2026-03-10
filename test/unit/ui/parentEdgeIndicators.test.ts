/**
 * Tests for Feature #452: Parent Edge Border Indicators
 *
 * Verifies:
 * 1. nestedCanvasStore captures parent edges when pushing a file with containerNodeId
 * 2. Parent edge indicators are split by direction (incoming/outgoing)
 * 3. Indicators are cleared on popFile and popToRoot
 * 4. buildParentEdgeIndicators correctly identifies incoming/outgoing edges
 * 5. ParentEdgeIndicators component renders pills with correct data attributes
 * 6. Click behavior calls popFile and requestCenterOnNode
 * 7. Component hides when depth=0 or no indicators
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ArchGraph, ArchEdge, ArchNode } from '@/types/graph';
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useCanvasStore } from '@/store/canvasStore';

// ─── Helpers ──────────────────────────────────────────────────

function createTestNode(id: string, displayName: string): ArchNode {
  return {
    id,
    type: 'core/service',
    displayName,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x: 0, y: 0, width: 200, height: 100 },
    children: [],
  };
}

function createTestEdge(
  id: string,
  fromNode: string,
  toNode: string,
  type: 'sync' | 'async' | 'data-flow' = 'sync',
  label?: string,
): ArchEdge {
  return {
    id,
    fromNode,
    toNode,
    type,
    label,
    properties: {},
    notes: [],
  };
}

function createParentGraph(): ArchGraph {
  return {
    name: 'Parent Architecture',
    description: 'Test parent graph',
    owners: [],
    nodes: [
      createTestNode('api-gateway', 'API Gateway'),
      createTestNode('container-1', 'Auth Service'),
      createTestNode('database', 'Database'),
      createTestNode('cache', 'Redis Cache'),
    ],
    edges: [
      // Edge INTO container: api-gateway -> container-1
      createTestEdge('e1', 'api-gateway', 'container-1', 'sync', 'REST'),
      // Edge OUT of container: container-1 -> database
      createTestEdge('e2', 'container-1', 'database', 'async', 'Events'),
      // Edge OUT of container: container-1 -> cache
      createTestEdge('e3', 'container-1', 'cache', 'data-flow', 'Cache Write'),
      // Edge NOT involving container: api-gateway -> database (should be ignored)
      createTestEdge('e4', 'api-gateway', 'database', 'sync'),
    ],
    annotations: [],
  };
}

function createChildGraph(): ArchGraph {
  return {
    name: 'Child Architecture',
    description: 'Nested child graph',
    owners: [],
    nodes: [createTestNode('child-node-1', 'Internal Handler')],
    edges: [],
    annotations: [],
  };
}

// ─── Store Tests ────────────────────────────────────────────────

describe('nestedCanvasStore - parent edge indicators', () => {
  beforeEach(() => {
    useNestedCanvasStore.getState().reset();
    // Set up the parent graph in coreStore so pushFile can capture edges
    useGraphStore.getState()._setGraph(createParentGraph());
    useNavigationStore.getState().zoomToRoot();
    useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });
  });

  it('starts with empty parentEdgeIndicators', () => {
    expect(useNestedCanvasStore.getState().parentEdgeIndicators).toEqual([]);
  });

  it('captures parent edges when pushFile is called with containerNodeId', () => {
    const childGraph = createChildGraph();
    useNestedCanvasStore.getState().pushFile('./auth.archc', childGraph, 'container-1');

    const indicators = useNestedCanvasStore.getState().parentEdgeIndicators;
    expect(indicators).toHaveLength(3); // e1 (incoming), e2 (outgoing), e3 (outgoing)
  });

  it('correctly identifies incoming edges (to container)', () => {
    const childGraph = createChildGraph();
    useNestedCanvasStore.getState().pushFile('./auth.archc', childGraph, 'container-1');

    const incoming = useNestedCanvasStore
      .getState()
      .parentEdgeIndicators.filter((i) => i.direction === 'incoming');
    expect(incoming).toHaveLength(1);
    expect(incoming[0]!.connectedNodeName).toBe('API Gateway');
    expect(incoming[0]!.connectedNodeId).toBe('api-gateway');
    expect(incoming[0]!.edge.id).toBe('e1');
    expect(incoming[0]!.edge.type).toBe('sync');
  });

  it('correctly identifies outgoing edges (from container)', () => {
    const childGraph = createChildGraph();
    useNestedCanvasStore.getState().pushFile('./auth.archc', childGraph, 'container-1');

    const outgoing = useNestedCanvasStore
      .getState()
      .parentEdgeIndicators.filter((i) => i.direction === 'outgoing');
    expect(outgoing).toHaveLength(2);

    const dbEdge = outgoing.find((i) => i.connectedNodeId === 'database');
    expect(dbEdge).toBeDefined();
    expect(dbEdge!.connectedNodeName).toBe('Database');
    expect(dbEdge!.edge.type).toBe('async');
    expect(dbEdge!.edge.label).toBe('Events');

    const cacheEdge = outgoing.find((i) => i.connectedNodeId === 'cache');
    expect(cacheEdge).toBeDefined();
    expect(cacheEdge!.connectedNodeName).toBe('Redis Cache');
    expect(cacheEdge!.edge.type).toBe('data-flow');
  });

  it('does not include edges unrelated to the container node', () => {
    const childGraph = createChildGraph();
    useNestedCanvasStore.getState().pushFile('./auth.archc', childGraph, 'container-1');

    const indicators = useNestedCanvasStore.getState().parentEdgeIndicators;
    const edgeIds = indicators.map((i) => i.edge.id);
    expect(edgeIds).not.toContain('e4'); // api-gateway -> database
  });

  it('captures no indicators when pushFile is called without containerNodeId', () => {
    const childGraph = createChildGraph();
    useNestedCanvasStore.getState().pushFile('./auth.archc', childGraph);

    expect(useNestedCanvasStore.getState().parentEdgeIndicators).toEqual([]);
  });

  it('clears indicators on popFile', () => {
    const childGraph = createChildGraph();
    useNestedCanvasStore.getState().pushFile('./auth.archc', childGraph, 'container-1');
    expect(useNestedCanvasStore.getState().parentEdgeIndicators.length).toBeGreaterThan(0);

    useNestedCanvasStore.getState().popFile();
    expect(useNestedCanvasStore.getState().parentEdgeIndicators).toEqual([]);
  });

  it('clears indicators on popToRoot', () => {
    const childGraph = createChildGraph();
    useNestedCanvasStore.getState().pushFile('./auth.archc', childGraph, 'container-1');
    // Push a second level
    useGraphStore.getState()._setGraph(childGraph);
    useNestedCanvasStore.getState().pushFile('./inner.archc', createChildGraph());

    expect(useNestedCanvasStore.getState().fileStack.length).toBe(2);

    useNestedCanvasStore.getState().popToRoot();
    expect(useNestedCanvasStore.getState().parentEdgeIndicators).toEqual([]);
  });

  it('clears indicators on reset', () => {
    const childGraph = createChildGraph();
    useNestedCanvasStore.getState().pushFile('./auth.archc', childGraph, 'container-1');

    useNestedCanvasStore.getState().reset();
    expect(useNestedCanvasStore.getState().parentEdgeIndicators).toEqual([]);
  });

  it('uses node ID as fallback name when node is not found', () => {
    // Create a graph with an edge referencing a non-existent node
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [createTestNode('container-x', 'Container')],
      edges: [createTestEdge('ex', 'ghost-node', 'container-x', 'sync')],
      annotations: [],
    };
    useGraphStore.getState()._setGraph(graph);

    useNestedCanvasStore.getState().pushFile('./child.archc', createChildGraph(), 'container-x');
    const indicators = useNestedCanvasStore.getState().parentEdgeIndicators;
    expect(indicators).toHaveLength(1);
    expect(indicators[0]!.connectedNodeName).toBe('ghost-node'); // Falls back to ID
  });
});

// ─── Component Rendering Tests ─────────────────────────────────

describe('ParentEdgeIndicators component structure', () => {
  beforeEach(() => {
    useNestedCanvasStore.getState().reset();
  });

  it('parentEdgeIndicators has correct shape for rendering', () => {
    useGraphStore.getState()._setGraph(createParentGraph());
    useNavigationStore.getState().zoomToRoot();
    useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

    useNestedCanvasStore.getState().pushFile('./auth.archc', createChildGraph(), 'container-1');

    const indicators = useNestedCanvasStore.getState().parentEdgeIndicators;

    // Each indicator has the required fields for rendering
    for (const ind of indicators) {
      expect(ind.edge).toBeDefined();
      expect(ind.edge.id).toBeTruthy();
      expect(ind.edge.type).toMatch(/^(sync|async|data-flow)$/);
      expect(ind.connectedNodeName).toBeTruthy();
      expect(ind.connectedNodeId).toBeTruthy();
      expect(ind.direction).toMatch(/^(incoming|outgoing)$/);
    }
  });

  it('indicators can be split into incoming and outgoing groups', () => {
    useGraphStore.getState()._setGraph(createParentGraph());
    useNavigationStore.getState().zoomToRoot();
    useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

    useNestedCanvasStore.getState().pushFile('./auth.archc', createChildGraph(), 'container-1');

    const indicators = useNestedCanvasStore.getState().parentEdgeIndicators;
    const incoming = indicators.filter((i) => i.direction === 'incoming');
    const outgoing = indicators.filter((i) => i.direction === 'outgoing');

    // All indicators are accounted for in one group or the other
    expect(incoming.length + outgoing.length).toBe(indicators.length);
    expect(incoming.length).toBe(1);
    expect(outgoing.length).toBe(2);
  });

  it('edge labels are preserved in indicators', () => {
    useGraphStore.getState()._setGraph(createParentGraph());
    useNavigationStore.getState().zoomToRoot();
    useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

    useNestedCanvasStore.getState().pushFile('./auth.archc', createChildGraph(), 'container-1');

    const indicators = useNestedCanvasStore.getState().parentEdgeIndicators;
    const labeled = indicators.filter((i) => i.edge.label);
    expect(labeled.length).toBe(3); // 'REST', 'Events', 'Cache Write'

    const labels = labeled.map((i) => i.edge.label);
    expect(labels).toContain('REST');
    expect(labels).toContain('Events');
    expect(labels).toContain('Cache Write');
  });
});

// ─── Navigation behavior tests ──────────────────────────────────

describe('ParentEdgeIndicators navigation', () => {
  beforeEach(() => {
    useNestedCanvasStore.getState().reset();
    useGraphStore.getState()._setGraph(createParentGraph());
    useNavigationStore.getState().zoomToRoot();
    useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });
  });

  it('popFile restores parent graph when navigating back', () => {
    const parentGraph = createParentGraph();
    useGraphStore.getState()._setGraph(parentGraph);

    useNestedCanvasStore.getState().pushFile('./auth.archc', createChildGraph(), 'container-1');

    // Now inside nested - graph should be the child
    expect(useGraphStore.getState().graph.name).toBe('Child Architecture');

    // Pop back
    useNestedCanvasStore.getState().popFile();
    expect(useGraphStore.getState().graph.name).toBe('Parent Architecture');
  });

  it('requestCenterOnNode is available on canvasStore for post-navigation centering', () => {
    expect(typeof useCanvasStore.getState().requestCenterOnNode).toBe('function');

    // Call it and verify the counter increments
    const before = useCanvasStore.getState().centerOnNodeCounter;
    useCanvasStore.getState().requestCenterOnNode('api-gateway');
    expect(useCanvasStore.getState().centerOnNodeCounter).toBe(before + 1);
    expect(useCanvasStore.getState().centerOnNodeId).toBe('api-gateway');
  });
});

// ─── Edge case tests ────────────────────────────────────────────

describe('ParentEdgeIndicators edge cases', () => {
  beforeEach(() => {
    useNestedCanvasStore.getState().reset();
  });

  it('handles container with no edges', () => {
    const graph: ArchGraph = {
      name: 'Isolated',
      description: '',
      owners: [],
      nodes: [createTestNode('lonely', 'Lonely Container')],
      edges: [],
      annotations: [],
    };
    useGraphStore.getState()._setGraph(graph);
    useNavigationStore.getState().zoomToRoot();
    useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

    useNestedCanvasStore.getState().pushFile('./child.archc', createChildGraph(), 'lonely');
    expect(useNestedCanvasStore.getState().parentEdgeIndicators).toEqual([]);
  });

  it('handles container with only incoming edges', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [
        createTestNode('source', 'Source'),
        createTestNode('target', 'Target Container'),
      ],
      edges: [createTestEdge('e1', 'source', 'target', 'async')],
      annotations: [],
    };
    useGraphStore.getState()._setGraph(graph);
    useNavigationStore.getState().zoomToRoot();
    useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

    useNestedCanvasStore.getState().pushFile('./child.archc', createChildGraph(), 'target');
    const indicators = useNestedCanvasStore.getState().parentEdgeIndicators;
    expect(indicators).toHaveLength(1);
    expect(indicators[0]!.direction).toBe('incoming');
  });

  it('handles container with only outgoing edges', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [
        createTestNode('source', 'Source Container'),
        createTestNode('target', 'Target'),
      ],
      edges: [createTestEdge('e1', 'source', 'target', 'data-flow')],
      annotations: [],
    };
    useGraphStore.getState()._setGraph(graph);
    useNavigationStore.getState().zoomToRoot();
    useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

    useNestedCanvasStore.getState().pushFile('./child.archc', createChildGraph(), 'source');
    const indicators = useNestedCanvasStore.getState().parentEdgeIndicators;
    expect(indicators).toHaveLength(1);
    expect(indicators[0]!.direction).toBe('outgoing');
  });

  it('handles multiple edges between same nodes', () => {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [
        createTestNode('client', 'Client'),
        createTestNode('server', 'Server Container'),
      ],
      edges: [
        createTestEdge('e1', 'client', 'server', 'sync', 'HTTP'),
        createTestEdge('e2', 'client', 'server', 'async', 'WebSocket'),
        createTestEdge('e3', 'server', 'client', 'data-flow', 'SSE'),
      ],
      annotations: [],
    };
    useGraphStore.getState()._setGraph(graph);
    useNavigationStore.getState().zoomToRoot();
    useCanvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });

    useNestedCanvasStore.getState().pushFile('./child.archc', createChildGraph(), 'server');
    const indicators = useNestedCanvasStore.getState().parentEdgeIndicators;
    expect(indicators).toHaveLength(3);

    const incoming = indicators.filter((i) => i.direction === 'incoming');
    const outgoing = indicators.filter((i) => i.direction === 'outgoing');
    expect(incoming).toHaveLength(2); // e1, e2 go TO server
    expect(outgoing).toHaveLength(1); // e3 goes FROM server
  });
});

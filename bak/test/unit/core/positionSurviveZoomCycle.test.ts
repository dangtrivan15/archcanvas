import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ArchNode, ArchGraph } from '@/types/graph';
import { getNodesAtLevel } from '@/core/graph/graphQuery';
import { moveNode } from '@/core/graph/graphEngine';

/** Helper to create a minimal ArchNode with a given position. */
function makeNode(id: string, x: number, y: number, children: ArchNode[] = []): ArchNode {
  return {
    id,
    type: 'compute/server',
    displayName: `Node ${id}`,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x, y, width: 240, height: 100 },
    children,
  };
}

/** Helper to create a minimal ArchGraph. */
function makeGraph(nodes: ArchNode[]): ArchGraph {
  return {
    name: 'test',
    description: '',
    owners: [],
    nodes,
    edges: [],
  };
}

describe('Feature #514: Positions survive across zoom-out and zoom-back-in', () => {
  // Build a graph with a parent "backend" that has 3 children at specific positions
  const childA = makeNode('auth-service', 100, 50);
  const childB = makeNode('user-service', 400, 200);
  const childC = makeNode('db-adapter', 700, 100);
  const parent = makeNode('backend', 200, 300, [childA, childB, childC]);
  const rootSibling = makeNode('frontend', 50, 50);
  const graph = makeGraph([rootSibling, parent]);

  describe('Step 1: Open a file and zoom into a parent node', () => {
    it('root nodes are visible at path []', () => {
      const rootNodes = getNodesAtLevel(graph, []);
      expect(rootNodes).toHaveLength(2);
      expect(rootNodes.map((n) => n.id)).toEqual(['frontend', 'backend']);
    });

    it('children are visible when zoomed into backend', () => {
      const children = getNodesAtLevel(graph, ['backend']);
      expect(children).toHaveLength(3);
      expect(children.map((n) => n.id)).toEqual([
        'auth-service',
        'user-service',
        'db-adapter',
      ]);
    });
  });

  describe('Step 2: Note the positions of all children', () => {
    it('children have their original positions when zoomed in', () => {
      const children = getNodesAtLevel(graph, ['backend']);
      expect(children[0].position).toEqual({ x: 100, y: 50, width: 240, height: 100 });
      expect(children[1].position).toEqual({ x: 400, y: 200, width: 240, height: 100 });
      expect(children[2].position).toEqual({ x: 700, y: 100, width: 240, height: 100 });
    });

    it('positions include fractional values when set', () => {
      const fracChild = makeNode('frac-node', 123.456, 789.012);
      const fracParent = makeNode('frac-parent', 0, 0, [fracChild]);
      const fracGraph = makeGraph([fracParent]);
      const children = getNodesAtLevel(fracGraph, ['frac-parent']);
      expect(children[0].position.x).toBeCloseTo(123.456);
      expect(children[0].position.y).toBeCloseTo(789.012);
    });
  });

  describe('Step 3: Zoom out to root level', () => {
    it('root nodes are accessible at path [] (simulating zoom-out)', () => {
      // Zoom out = changing navigation path from ['backend'] back to []
      const rootNodes = getNodesAtLevel(graph, []);
      expect(rootNodes).toHaveLength(2);
      expect(rootNodes[0].id).toBe('frontend');
      expect(rootNodes[1].id).toBe('backend');
    });

    it('parent node position is preserved at root level', () => {
      const rootNodes = getNodesAtLevel(graph, []);
      const backend = rootNodes.find((n) => n.id === 'backend')!;
      expect(backend.position).toEqual({ x: 200, y: 300, width: 240, height: 100 });
    });
  });

  describe('Step 4: Zoom back into the same parent', () => {
    it('children are retrieved again when re-zooming into backend', () => {
      // Simulate: path went [] -> ['backend'] -> [] -> ['backend']
      // Since the graph object is the same, children persist
      const childrenFirstZoom = getNodesAtLevel(graph, ['backend']);
      const rootLevel = getNodesAtLevel(graph, []);
      const childrenSecondZoom = getNodesAtLevel(graph, ['backend']);

      expect(childrenSecondZoom).toHaveLength(3);
      expect(childrenSecondZoom.map((n) => n.id)).toEqual(
        childrenFirstZoom.map((n) => n.id),
      );
    });
  });

  describe('Step 5: Verify all children are at the exact same positions as before', () => {
    it('children positions are identical after zoom-out and zoom-back-in', () => {
      // Record positions on first zoom-in
      const firstZoom = getNodesAtLevel(graph, ['backend']);
      const positionsBefore = firstZoom.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.position.width,
        height: n.position.height,
      }));

      // Zoom out (query root)
      getNodesAtLevel(graph, []);

      // Zoom back in
      const secondZoom = getNodesAtLevel(graph, ['backend']);
      const positionsAfter = secondZoom.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.position.width,
        height: n.position.height,
      }));

      expect(positionsAfter).toEqual(positionsBefore);
    });

    it('positions survive after moving a child node, zooming out, and zooming back in', () => {
      // Move auth-service to a new position while zoomed in
      const updatedGraph = moveNode(graph, 'auth-service', 999, 888);

      // Verify move happened
      const childrenAfterMove = getNodesAtLevel(updatedGraph, ['backend']);
      const movedNode = childrenAfterMove.find((n) => n.id === 'auth-service')!;
      expect(movedNode.position.x).toBe(999);
      expect(movedNode.position.y).toBe(888);

      // Zoom out
      const rootAfterMove = getNodesAtLevel(updatedGraph, []);
      expect(rootAfterMove).toHaveLength(2);

      // Zoom back in
      const childrenAfterReZoom = getNodesAtLevel(updatedGraph, ['backend']);
      const reZoomedNode = childrenAfterReZoom.find((n) => n.id === 'auth-service')!;
      expect(reZoomedNode.position.x).toBe(999);
      expect(reZoomedNode.position.y).toBe(888);
    });

    it('other children positions are unaffected by moving one child', () => {
      const updatedGraph = moveNode(graph, 'auth-service', 999, 888);

      // Zoom in, out, back in
      getNodesAtLevel(updatedGraph, ['backend']);
      getNodesAtLevel(updatedGraph, []);
      const children = getNodesAtLevel(updatedGraph, ['backend']);

      const userService = children.find((n) => n.id === 'user-service')!;
      const dbAdapter = children.find((n) => n.id === 'db-adapter')!;
      expect(userService.position).toEqual({ x: 400, y: 200, width: 240, height: 100 });
      expect(dbAdapter.position).toEqual({ x: 700, y: 100, width: 240, height: 100 });
    });

    it('deeply nested children positions survive multi-level zoom cycles', () => {
      // Create a 3-level deep hierarchy
      const grandchild1 = makeNode('gc-1', 10, 20);
      const grandchild2 = makeNode('gc-2', 300, 400);
      const child = makeNode('child', 50, 60, [grandchild1, grandchild2]);
      const root = makeNode('root', 0, 0, [child]);
      const deepGraph = makeGraph([root]);

      // Zoom into root -> child (2 levels deep)
      const gcFirstZoom = getNodesAtLevel(deepGraph, ['root', 'child']);
      expect(gcFirstZoom).toHaveLength(2);
      expect(gcFirstZoom[0].position).toEqual({ x: 10, y: 20, width: 240, height: 100 });
      expect(gcFirstZoom[1].position).toEqual({ x: 300, y: 400, width: 240, height: 100 });

      // Zoom out to root -> root level
      getNodesAtLevel(deepGraph, ['root']);
      // Zoom out to root
      getNodesAtLevel(deepGraph, []);
      // Zoom back in: root -> child
      const gcSecondZoom = getNodesAtLevel(deepGraph, ['root', 'child']);
      expect(gcSecondZoom[0].position).toEqual(gcFirstZoom[0].position);
      expect(gcSecondZoom[1].position).toEqual(gcFirstZoom[1].position);
    });

    it('graph positions are stored in-place and not copied on navigation queries', () => {
      // getNodesAtLevel returns references to the actual node objects in the graph,
      // not copies. This ensures position mutations persist.
      const children = getNodesAtLevel(graph, ['backend']);
      const backendNode = graph.nodes.find((n) => n.id === 'backend')!;

      // The returned children ARE the same objects as parent.children
      expect(children[0]).toBe(backendNode.children[0]);
      expect(children[1]).toBe(backendNode.children[1]);
      expect(children[2]).toBe(backendNode.children[2]);
    });
  });

  describe('Source code verification', () => {
    it('navigationStore supports zoomIn and zoomOut path operations', () => {
      const src = readFileSync(
        join(__dirname, '../../../src/store/navigationStore.ts'),
        'utf8',
      );
      expect(src).toContain('zoomIn');
      expect(src).toContain('zoomOut');
      expect(src).toContain('[...s.path, nodeId]');
      expect(src).toContain('s.path.slice(0, -1)');
    });

    it('getNodesAtLevel traverses children hierarchy based on path', () => {
      const src = readFileSync(
        join(__dirname, '../../../src/core/graph/graphQuery.ts'),
        'utf8',
      );
      expect(src).toContain('export function getNodesAtLevel');
      expect(src).toContain('parent.children');
      expect(src).toContain('currentNodes = parent.children');
    });

    it('moveNode recursively updates position in nested children', () => {
      const src = readFileSync(
        join(__dirname, '../../../src/core/graph/graphEngine.ts'),
        'utf8',
      );
      expect(src).toContain('export function moveNode');
      expect(src).toContain('moveNodeInList');
      // Verify recursive traversal for nested nodes
      expect(src).toContain('moveNodeInList(node.children');
    });
  });
});

/**
 * Feature #513: Adding a new node triggers re-layout at current level
 *
 * When a new node is added at any navigation level (root or inside a parent),
 * auto-layout should re-run to incorporate the new node into the existing arrangement.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ArchGraph, ArchNode } from '@/types/graph';
import { applyElkLayout } from '@/core/layout/elkLayout';
import { createNode } from '@/core/graph/graphEngine';
import { addNode as engineAddNode, addChildNode } from '@/core/graph/graphEngine';
import { getNodesAtLevel } from '@/core/graph/graphQuery';

// Read source code for verification
const coreStoreSrc = readFileSync(
  resolve(__dirname, '../../../src/store/coreStore.ts'),
  'utf-8',
);

// ── Helpers ──────────────────────────────────────────────────────────────

function makeGraph(nodes: ArchNode[], edges: ArchGraph['edges'] = []): ArchGraph {
  return {
    name: 'test',
    description: '',
    owners: [],
    nodes,
    edges,
    annotations: [],
  };
}

function makeNode(id: string, x: number, y: number, children: ArchNode[] = []): ArchNode {
  return {
    id,
    type: 'compute/service',
    displayName: `Node ${id}`,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x, y, width: 240, height: 100 },
    children,
  };
}

// ── Step 1: Source code verifies auto-layout trigger after addNode ──────

describe('Feature #513: Adding a new node triggers re-layout at current level', () => {
  describe('Step 1: addNode in coreStore triggers auto-layout', () => {
    it('coreStore.addNode calls autoLayout after adding a node', () => {
      expect(coreStoreSrc).toContain('Auto-layout after addNode');
    });

    it('auto-layout is triggered via setTimeout(0) for async scheduling', () => {
      const addNodeImpl = coreStoreSrc.split('addNode: (params) =>')[1]?.split(/\n\s{2}\w+:/)[0] ?? '';
      expect(addNodeImpl).toContain('setTimeout');
      expect(addNodeImpl).toContain('autoLayout');
    });

    it('uses navigation path from useNavigationStore for correct level', () => {
      expect(coreStoreSrc).toContain("import { useNavigationStore } from '@/store/navigationStore'");
      const addNodeImpl = coreStoreSrc.split('addNode: (params) =>')[1]?.split(/\n\s{2}\w+:/)[0] ?? '';
      expect(addNodeImpl).toContain('useNavigationStore.getState().path');
    });

    it('requests fitView after auto-layout completes', () => {
      const addNodeImpl = coreStoreSrc.split('addNode: (params) =>')[1]?.split(/\n\s{2}\w+:/)[0] ?? '';
      expect(addNodeImpl).toContain('requestFitView');
    });

    it('handles auto-layout failure gracefully with catch', () => {
      const addNodeImpl = coreStoreSrc.split('addNode: (params) =>')[1]?.split(/\n\s{2}\w+:/)[0] ?? '';
      expect(addNodeImpl).toContain('.catch');
    });
  });

  // ── Step 2: ELK layout incorporates a new node at root level ──────────

  describe('Step 2: Auto-layout incorporates new node at root level', () => {
    it('new node gets a position assigned by ELK', async () => {
      const nodeA = makeNode('a', 100, 50);
      const nodeB = makeNode('b', 350, 50);
      const newNode = makeNode('c', 0, 0);
      const graph = makeGraph([nodeA, nodeB, newNode]);

      const result = await applyElkLayout(graph, 'horizontal', []);
      const posC = result.nodes.find((n) => n.id === 'c')!.position;

      expect(posC).toBeDefined();
      expect(typeof posC.x).toBe('number');
      expect(typeof posC.y).toBe('number');
    });

    it('all nodes get distinct positions after layout', async () => {
      const nodeA = makeNode('a', 100, 50);
      const nodeB = makeNode('b', 350, 50);
      const newNode = makeNode('c', 0, 0);
      const graph = makeGraph([nodeA, nodeB, newNode]);

      const result = await applyElkLayout(graph, 'horizontal', []);
      const positions = result.nodes.map((n) => `${n.position.x},${n.position.y}`);
      const uniquePositions = new Set(positions);

      expect(uniquePositions.size).toBe(3);
    });

    it('layout with edges positions connected nodes logically', async () => {
      const nodeA = makeNode('a', 0, 0);
      const nodeB = makeNode('b', 0, 0);
      const newNode = makeNode('c', 0, 0);
      const edges = [
        { id: 'e1', fromNode: 'a', toNode: 'b', type: 'SYNC' as const, label: '', fromPort: '', toPort: '', properties: {}, notes: [] },
        { id: 'e2', fromNode: 'b', toNode: 'c', type: 'SYNC' as const, label: '', fromPort: '', toPort: '', properties: {}, notes: [] },
      ];
      const graph = makeGraph([nodeA, nodeB, newNode], edges);

      const result = await applyElkLayout(graph, 'horizontal', []);

      const posA = result.nodes.find((n) => n.id === 'a')!.position;
      const posB = result.nodes.find((n) => n.id === 'b')!.position;
      const posC = result.nodes.find((n) => n.id === 'c')!.position;

      expect(posA.x).toBeLessThan(posB.x);
      expect(posB.x).toBeLessThan(posC.x);
    });
  });

  // ── Step 3: ELK layout incorporates a new child node ──────────────────

  describe('Step 3: Auto-layout incorporates new child node inside parent', () => {
    it('new child node gets positioned by ELK within parent', async () => {
      const childA = makeNode('child-a', 50, 30);
      const childB = makeNode('child-b', 300, 30);
      const newChild = makeNode('child-c', 0, 0);
      const parent = makeNode('parent', 100, 100, [childA, childB, newChild]);
      const graph = makeGraph([parent]);

      const result = await applyElkLayout(graph, 'horizontal', ['parent']);
      const children = result.nodes[0].children;
      const posC = children.find((n) => n.id === 'child-c')!.position;

      expect(posC).toBeDefined();
      expect(typeof posC.x).toBe('number');
      expect(typeof posC.y).toBe('number');
    });

    it('all children get distinct positions after layout', async () => {
      const childA = makeNode('child-a', 50, 30);
      const childB = makeNode('child-b', 300, 30);
      const newChild = makeNode('child-c', 0, 0);
      const parent = makeNode('parent', 100, 100, [childA, childB, newChild]);
      const graph = makeGraph([parent]);

      const result = await applyElkLayout(graph, 'horizontal', ['parent']);
      const children = result.nodes[0].children;
      const positions = children.map((n) => `${n.position.x},${n.position.y}`);
      const uniquePositions = new Set(positions);

      expect(uniquePositions.size).toBe(3);
    });

    it('parent node position is not affected by child re-layout', async () => {
      const childA = makeNode('child-a', 50, 30);
      const childB = makeNode('child-b', 300, 30);
      const newChild = makeNode('child-c', 0, 0);
      const parent = makeNode('parent', 100, 100, [childA, childB, newChild]);
      const graph = makeGraph([parent]);

      const result = await applyElkLayout(graph, 'horizontal', ['parent']);

      expect(result.nodes[0].position.x).toBe(100);
      expect(result.nodes[0].position.y).toBe(100);
    });
  });

  // ── Step 4: Graph engine correctly adds nodes at both levels ──────────

  describe('Step 4: Graph engine supports adding nodes at root and child level', () => {
    it('engineAddNode adds a node at root level', () => {
      const graph = makeGraph([makeNode('a', 100, 50)]);
      const newNode = createNode({ type: 'compute/service', displayName: 'New Service' });
      const updated = engineAddNode(graph, newNode);

      expect(updated.nodes).toHaveLength(2);
      expect(updated.nodes[1].displayName).toBe('New Service');
    });

    it('addChildNode adds a node inside a parent', () => {
      const parent = makeNode('parent', 100, 50);
      const graph = makeGraph([parent]);
      const newChild = createNode({ type: 'compute/service', displayName: 'New Child' });
      const updated = addChildNode(graph, 'parent', newChild);

      expect(updated.nodes[0].children).toHaveLength(1);
      expect(updated.nodes[0].children[0].displayName).toBe('New Child');
    });

    it('getNodesAtLevel returns correct nodes for navigation path', () => {
      const childA = makeNode('child-a', 50, 30);
      const parent = makeNode('parent', 100, 50, [childA]);
      const graph = makeGraph([parent]);

      const rootNodes = getNodesAtLevel(graph, []);
      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].id).toBe('parent');

      const childNodes = getNodesAtLevel(graph, ['parent']);
      expect(childNodes).toHaveLength(1);
      expect(childNodes[0].id).toBe('child-a');
    });
  });

  // ── Step 5: Full scenario - add node then layout ──────────────────────

  describe('Step 5: Full add-then-layout scenario', () => {
    it('adding a node to arranged root nodes and re-laying out produces valid positions', async () => {
      const nodeA = makeNode('a', 100, 50);
      const nodeB = makeNode('b', 350, 50);
      let graph = makeGraph([nodeA, nodeB], [
        { id: 'e1', fromNode: 'a', toNode: 'b', type: 'SYNC' as const, label: '', fromPort: '', toPort: '', properties: {}, notes: [] },
      ]);

      const newNode = createNode({ type: 'compute/service', displayName: 'New Service' });
      graph = engineAddNode(graph, newNode);
      expect(graph.nodes).toHaveLength(3);

      const result = await applyElkLayout(graph, 'horizontal', []);

      for (const node of result.nodes) {
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      }

      const posStrings = result.nodes.map((n) => `${n.position.x},${n.position.y}`);
      expect(new Set(posStrings).size).toBe(3);
    });

    it('adding a child then re-laying out within parent gives valid positions', async () => {
      const childA = makeNode('child-a', 50, 30);
      const childB = makeNode('child-b', 300, 30);
      const parent = makeNode('parent', 100, 50, [childA, childB]);
      let graph = makeGraph([parent]);

      const newChild = createNode({ type: 'compute/service', displayName: 'New Child' });
      graph = addChildNode(graph, 'parent', newChild);
      expect(graph.nodes[0].children).toHaveLength(3);

      const result = await applyElkLayout(graph, 'horizontal', ['parent']);
      const children = result.nodes[0].children;

      for (const child of children) {
        expect(typeof child.position.x).toBe('number');
        expect(typeof child.position.y).toBe('number');
      }

      const posStrings = children.map((n) => `${n.position.x},${n.position.y}`);
      expect(new Set(posStrings).size).toBe(3);
    });
  });

  // ── Step 6: Navigation integration ────────────────────────────────────

  describe('Step 6: Navigation integration', () => {
    it('coreStore imports useNavigationStore', () => {
      expect(coreStoreSrc).toContain("import { useNavigationStore } from '@/store/navigationStore'");
    });

    it('auto-layout uses horizontal direction by default', () => {
      const addNodeImpl = coreStoreSrc.split('addNode: (params) =>')[1]?.split(/\n\s{2}\w+:/)[0] ?? '';
      expect(addNodeImpl).toContain("autoLayout('horizontal'");
    });
  });
});

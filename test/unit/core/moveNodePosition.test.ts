/**
 * Feature #22: Graph engine moves node position
 * Verifies moveNode() updates a node's x, y coordinates while preserving
 * other properties (width, height, color, displayName, type, etc).
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  addNode,
  addChildNode,
  moveNode,
  findNode,
} from '@/core/graph/graphEngine';

describe('Feature #22: Graph engine moves node position', () => {
  it('should create node at position {x: 0, y: 0} by default', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Test Service' });
    expect(node.position.x).toBe(0);
    expect(node.position.y).toBe(0);
  });

  it('should move node to new position {x: 100, y: 200}', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Test Service' });
    let graph = createEmptyGraph('Move Test');
    graph = addNode(graph, node);

    graph = moveNode(graph, node.id, 100, 200);

    const moved = findNode(graph, node.id);
    expect(moved).toBeDefined();
    expect(moved!.position.x).toBe(100);
    expect(moved!.position.y).toBe(200);
  });

  it('should preserve width and height after move', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Test Service',
      position: { x: 0, y: 0, width: 300, height: 150 },
    });
    let graph = createEmptyGraph('Move Test');
    graph = addNode(graph, node);

    graph = moveNode(graph, node.id, 50, 75);

    const moved = findNode(graph, node.id);
    expect(moved!.position.x).toBe(50);
    expect(moved!.position.y).toBe(75);
    expect(moved!.position.width).toBe(300);
    expect(moved!.position.height).toBe(150);
  });

  it('should preserve color after move', () => {
    const node = createNode({
      type: 'data/database',
      displayName: 'DB Node',
      position: { x: 10, y: 20, color: '#ff5500' },
    });
    let graph = createEmptyGraph('Color Test');
    graph = addNode(graph, node);

    graph = moveNode(graph, node.id, 100, 200);

    const moved = findNode(graph, node.id);
    expect(moved!.position.color).toBe('#ff5500');
  });

  it('should preserve node type, displayName, args, and other properties', () => {
    const node = createNode({
      type: 'data/database',
      displayName: 'Users DB',
      args: { engine: 'postgresql', port: 5432, ssl: true },
    });
    let graph = createEmptyGraph('Properties Test');
    graph = addNode(graph, node);

    graph = moveNode(graph, node.id, 999, 888);

    const moved = findNode(graph, node.id);
    expect(moved!.type).toBe('data/database');
    expect(moved!.displayName).toBe('Users DB');
    expect(moved!.args).toEqual({ engine: 'postgresql', port: 5432, ssl: true });
    expect(moved!.id).toBe(node.id);
    expect(moved!.codeRefs).toEqual([]);
    expect(moved!.notes).toEqual([]);
    expect(moved!.properties).toEqual({});
    expect(moved!.children).toEqual([]);
  });

  it('should handle moving to same position (no-op)', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      position: { x: 50, y: 50 },
    });
    let graph = createEmptyGraph('Same Position');
    graph = addNode(graph, node);

    graph = moveNode(graph, node.id, 50, 50);

    const moved = findNode(graph, node.id);
    expect(moved!.position.x).toBe(50);
    expect(moved!.position.y).toBe(50);
  });

  it('should handle negative coordinates', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    let graph = createEmptyGraph('Negative Test');
    graph = addNode(graph, node);

    graph = moveNode(graph, node.id, -100, -200);

    const moved = findNode(graph, node.id);
    expect(moved!.position.x).toBe(-100);
    expect(moved!.position.y).toBe(-200);
  });

  it('should handle decimal coordinates', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    let graph = createEmptyGraph('Decimal Test');
    graph = addNode(graph, node);

    graph = moveNode(graph, node.id, 50.5, 75.3);

    const moved = findNode(graph, node.id);
    expect(moved!.position.x).toBe(50.5);
    expect(moved!.position.y).toBe(75.3);
  });

  it('should handle very large coordinates', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    let graph = createEmptyGraph('Large Test');
    graph = addNode(graph, node);

    graph = moveNode(graph, node.id, 99999, 88888);

    const moved = findNode(graph, node.id);
    expect(moved!.position.x).toBe(99999);
    expect(moved!.position.y).toBe(88888);
  });

  it('should produce immutable result (original graph unchanged)', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      position: { x: 10, y: 20 },
    });
    let graph = createEmptyGraph('Immutability Test');
    graph = addNode(graph, node);

    const originalX = graph.nodes[0].position.x;
    const originalY = graph.nodes[0].position.y;

    const newGraph = moveNode(graph, node.id, 100, 200);

    // Original should be unchanged
    expect(graph.nodes[0].position.x).toBe(originalX);
    expect(graph.nodes[0].position.y).toBe(originalY);

    // New graph should have updated position
    expect(newGraph.nodes[0].position.x).toBe(100);
    expect(newGraph.nodes[0].position.y).toBe(200);
  });

  it('should not affect other nodes when moving one node', () => {
    const nodeA = createNode({
      type: 'compute/service',
      displayName: 'Node A',
      position: { x: 0, y: 0 },
    });
    const nodeB = createNode({
      type: 'data/database',
      displayName: 'Node B',
      position: { x: 100, y: 100 },
    });
    let graph = createEmptyGraph('Multi-node Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);

    graph = moveNode(graph, nodeA.id, 500, 600);

    const movedA = findNode(graph, nodeA.id);
    const unchangedB = findNode(graph, nodeB.id);
    expect(movedA!.position.x).toBe(500);
    expect(movedA!.position.y).toBe(600);
    expect(unchangedB!.position.x).toBe(100);
    expect(unchangedB!.position.y).toBe(100);
  });

  it('should move child node recursively', () => {
    const parent = createNode({
      type: 'compute/service',
      displayName: 'Parent',
      position: { x: 0, y: 0 },
    });
    const child = createNode({
      type: 'data/database',
      displayName: 'Child',
      position: { x: 50, y: 50 },
    });

    let graph = createEmptyGraph('Recursive Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child);

    graph = moveNode(graph, child.id, 200, 300);

    const movedChild = findNode(graph, child.id);
    expect(movedChild!.position.x).toBe(200);
    expect(movedChild!.position.y).toBe(300);

    // Parent position should be unchanged
    const parentNode = findNode(graph, parent.id);
    expect(parentNode!.position.x).toBe(0);
    expect(parentNode!.position.y).toBe(0);
  });

  it('should move grandchild node recursively', () => {
    const root = createNode({ type: 'compute/service', displayName: 'Root' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const grandchild = createNode({
      type: 'data/database',
      displayName: 'Grandchild',
      position: { x: 10, y: 20 },
    });

    let graph = createEmptyGraph('Deep Recursive Test');
    graph = addNode(graph, root);
    graph = addChildNode(graph, root.id, child);
    graph = addChildNode(graph, child.id, grandchild);

    graph = moveNode(graph, grandchild.id, 777, 888);

    const movedGrandchild = findNode(graph, grandchild.id);
    expect(movedGrandchild!.position.x).toBe(777);
    expect(movedGrandchild!.position.y).toBe(888);
  });

  it('should handle nonexistent node ID gracefully', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    let graph = createEmptyGraph('Nonexistent Test');
    graph = addNode(graph, node);

    // Should not throw - just return unchanged graph
    const newGraph = moveNode(graph, 'nonexistent-id', 100, 200);

    // Original node should be unchanged
    const found = findNode(newGraph, node.id);
    expect(found!.position.x).toBe(0);
    expect(found!.position.y).toBe(0);
  });

  it('should support multiple sequential moves', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    let graph = createEmptyGraph('Sequential Test');
    graph = addNode(graph, node);

    graph = moveNode(graph, node.id, 10, 20);
    graph = moveNode(graph, node.id, 30, 40);
    graph = moveNode(graph, node.id, 50, 60);

    const moved = findNode(graph, node.id);
    expect(moved!.position.x).toBe(50);
    expect(moved!.position.y).toBe(60);
  });
});

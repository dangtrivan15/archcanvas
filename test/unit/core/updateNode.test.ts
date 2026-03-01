/**
 * Feature #13: Graph engine updates node display name
 *
 * updateNode() correctly modifies a node's displayName while preserving other properties.
 *
 * Steps verified:
 * 1. Create architecture with a node named 'Old Name'
 * 2. Call updateNode with new displayName 'New Name'
 * 3. Verify node.displayName is now 'New Name'
 * 4. Verify node.type is unchanged
 * 5. Verify node.args is unchanged
 * 6. Verify node.notes is unchanged
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createNote,
  addNode,
  addChildNode,
  addCodeRef,
  updateNode,
  findNode,
  addNoteToNode,
} from '@/core/graph/graphEngine';

describe('Feature #13: updateNode modifies displayName while preserving properties', () => {
  it('should update displayName from Old Name to New Name', () => {
    // Step 1: Create architecture with a node named 'Old Name'
    const node = createNode({
      type: 'compute/service',
      displayName: 'Old Name',
      args: { language: 'TypeScript', framework: 'Express' },
    });
    let graph = createEmptyGraph('Test Architecture');
    graph = addNode(graph, node);

    // Add a note to verify it's preserved
    const note = createNote({ author: 'alice', content: 'Important design note' });
    graph = addNoteToNode(graph, node.id, note);

    // Step 2: Call updateNode with new displayName 'New Name'
    const updatedGraph = updateNode(graph, node.id, { displayName: 'New Name' });

    const updatedNode = findNode(updatedGraph, node.id);
    expect(updatedNode).toBeDefined();

    // Step 3: Verify node.displayName is now 'New Name'
    expect(updatedNode!.displayName).toBe('New Name');

    // Step 4: Verify node.type is unchanged
    expect(updatedNode!.type).toBe('compute/service');

    // Step 5: Verify node.args is unchanged
    expect(updatedNode!.args).toEqual({ language: 'TypeScript', framework: 'Express' });

    // Step 6: Verify node.notes is unchanged
    expect(updatedNode!.notes).toHaveLength(1);
    expect(updatedNode!.notes[0].content).toBe('Important design note');
    expect(updatedNode!.notes[0].author).toBe('alice');
  });

  it('should preserve node ID after displayName update', () => {
    const node = createNode({
      type: 'data/database',
      displayName: 'Old DB',
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, { displayName: 'New DB' });
    const updatedNode = findNode(updatedGraph, node.id);

    expect(updatedNode).toBeDefined();
    expect(updatedNode!.id).toBe(node.id);
    expect(updatedNode!.displayName).toBe('New DB');
  });

  it('should preserve position after displayName update', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      position: { x: 150, y: 250 },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, { displayName: 'Renamed Service' });
    const updatedNode = findNode(updatedGraph, node.id);

    expect(updatedNode!.position.x).toBe(150);
    expect(updatedNode!.position.y).toBe(250);
  });

  it('should preserve children after displayName update', () => {
    const parent = createNode({
      type: 'compute/service',
      displayName: 'Parent Old',
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);

    const child = createNode({
      type: 'compute/function',
      displayName: 'Child Component',
    });
    graph = addChildNode(graph, parent.id, child);

    const updatedGraph = updateNode(graph, parent.id, { displayName: 'Parent New' });
    const updatedParent = findNode(updatedGraph, parent.id);

    expect(updatedParent!.displayName).toBe('Parent New');
    expect(updatedParent!.children).toHaveLength(1);
    expect(updatedParent!.children[0].displayName).toBe('Child Component');
  });

  it('should preserve codeRefs after displayName update', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Original',
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    // Add a code ref
    graph = addCodeRef(graph, node.id, { path: 'src/services/auth.ts', role: 'source' });

    const updatedGraph = updateNode(graph, node.id, { displayName: 'Renamed' });
    const updatedNode = findNode(updatedGraph, node.id);

    expect(updatedNode!.displayName).toBe('Renamed');
    expect(updatedNode!.codeRefs).toHaveLength(1);
    expect(updatedNode!.codeRefs[0].path).toBe('src/services/auth.ts');
    expect(updatedNode!.codeRefs[0].role).toBe('source');
  });

  it('should preserve properties map after displayName update', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Old Name',
    });
    // Manually set properties
    const nodeWithProps = {
      ...node,
      properties: { region: 'us-east-1', tier: 'premium' } as Record<string, string | number | boolean>,
    };
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeWithProps);

    const updatedGraph = updateNode(graph, nodeWithProps.id, { displayName: 'New Name' });
    const updatedNode = findNode(updatedGraph, nodeWithProps.id);

    expect(updatedNode!.displayName).toBe('New Name');
    expect(updatedNode!.properties).toEqual({ region: 'us-east-1', tier: 'premium' });
  });

  it('should be immutable (original graph unchanged)', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Original Name',
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, { displayName: 'Updated Name' });

    // Original should be unchanged
    const originalNode = findNode(graph, node.id);
    expect(originalNode!.displayName).toBe('Original Name');

    // Updated graph should reflect change
    const updatedNode = findNode(updatedGraph, node.id);
    expect(updatedNode!.displayName).toBe('Updated Name');
  });

  it('should update displayName of nested child node', () => {
    const parent = createNode({
      type: 'compute/service',
      displayName: 'Parent Service',
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);

    const child = createNode({
      type: 'compute/function',
      displayName: 'Old Child Name',
      args: { handler: 'processOrder' },
    });
    graph = addChildNode(graph, parent.id, child);

    // Update the child's displayName
    const updatedGraph = updateNode(graph, child.id, { displayName: 'New Child Name' });
    const updatedChild = findNode(updatedGraph, child.id);

    expect(updatedChild!.displayName).toBe('New Child Name');
    expect(updatedChild!.type).toBe('compute/function');
    expect(updatedChild!.args).toEqual({ handler: 'processOrder' });
  });

  it('should handle updating non-existent node gracefully', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Existing',
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    // Updating a non-existent node should not throw or modify existing nodes
    const updatedGraph = updateNode(graph, 'non-existent', { displayName: 'Ghost' });
    expect(updatedGraph.nodes).toHaveLength(1);
    expect(findNode(updatedGraph, node.id)!.displayName).toBe('Existing');
  });
});

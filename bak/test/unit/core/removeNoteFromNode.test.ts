/**
 * Unit tests for Feature #19: Graph engine removes note from node.
 * Verifies removeNoteFromNode() deletes a note from a node by note ID.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createNote,
  addNode,
  addChildNode,
  addNoteToNode,
  removeNoteFromNode,
  findNode,
} from '@/core/graph/graphEngine';

describe('removeNoteFromNode - deletes note by ID', () => {
  it('should remove a note from a node that has 2 notes, leaving 1', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Order Service' });
    const note1 = createNote({ author: 'architect', content: 'First note' });
    const note2 = createNote({ author: 'developer', content: 'Second note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note1);
    graph = addNoteToNode(graph, node.id, note2);

    // Verify 2 notes before removal
    const beforeNode = findNode(graph, node.id);
    expect(beforeNode!.notes).toHaveLength(2);

    // Remove first note
    graph = removeNoteFromNode(graph, node.id, note1.id);

    const afterNode = findNode(graph, node.id);
    expect(afterNode!.notes).toHaveLength(1);
  });

  it('should keep the second note when the first is removed', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Order Service' });
    const note1 = createNote({ author: 'architect', content: 'First note' });
    const note2 = createNote({ author: 'developer', content: 'Second note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note1);
    graph = addNoteToNode(graph, node.id, note2);

    // Remove first note
    graph = removeNoteFromNode(graph, node.id, note1.id);

    const afterNode = findNode(graph, node.id);
    expect(afterNode!.notes[0].id).toBe(note2.id);
    expect(afterNode!.notes[0].content).toBe('Second note');
    expect(afterNode!.notes[0].author).toBe('developer');
  });

  it('should keep the first note when the second is removed', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Order Service' });
    const note1 = createNote({ author: 'architect', content: 'First note' });
    const note2 = createNote({ author: 'developer', content: 'Second note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note1);
    graph = addNoteToNode(graph, node.id, note2);

    // Remove second note
    graph = removeNoteFromNode(graph, node.id, note2.id);

    const afterNode = findNode(graph, node.id);
    expect(afterNode!.notes).toHaveLength(1);
    expect(afterNode!.notes[0].id).toBe(note1.id);
    expect(afterNode!.notes[0].content).toBe('First note');
  });

  it('should remove the only note from a node, resulting in empty notes', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Lonely Service' });
    const note = createNote({ author: 'architect', content: 'Only note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = removeNoteFromNode(graph, node.id, note.id);

    const afterNode = findNode(graph, node.id);
    expect(afterNode!.notes).toHaveLength(0);
  });

  it('should not modify the original graph (immutability)', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note1 = createNote({ author: 'architect', content: 'Note 1' });
    const note2 = createNote({ author: 'developer', content: 'Note 2' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note1);
    graph = addNoteToNode(graph, node.id, note2);

    const newGraph = removeNoteFromNode(graph, node.id, note1.id);

    // Original graph should still have 2 notes
    const originalNode = findNode(graph, node.id);
    expect(originalNode!.notes).toHaveLength(2);

    // New graph should have 1 note
    const updatedNode = findNode(newGraph, node.id);
    expect(updatedNode!.notes).toHaveLength(1);
  });

  it('should remove note from a child node (recursive search)', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const note1 = createNote({ author: 'architect', content: 'Child note 1' });
    const note2 = createNote({ author: 'developer', content: 'Child note 2' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child);
    graph = addNoteToNode(graph, child.id, note1);
    graph = addNoteToNode(graph, child.id, note2);

    // Remove first note from child
    graph = removeNoteFromNode(graph, child.id, note1.id);

    const updatedChild = findNode(graph, child.id);
    expect(updatedChild!.notes).toHaveLength(1);
    expect(updatedChild!.notes[0].id).toBe(note2.id);
  });

  it('should remove note from a deeply nested node (grandchild)', () => {
    const root = createNode({ type: 'compute/service', displayName: 'Root' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const grandchild = createNode({ type: 'compute/worker', displayName: 'Grandchild' });
    const note = createNote({ author: 'architect', content: 'Deep note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, root);
    graph = addChildNode(graph, root.id, child);
    graph = addChildNode(graph, child.id, grandchild);
    graph = addNoteToNode(graph, grandchild.id, note);

    graph = removeNoteFromNode(graph, grandchild.id, note.id);

    const updatedGrandchild = findNode(graph, grandchild.id);
    expect(updatedGrandchild!.notes).toHaveLength(0);
  });

  it('should not affect notes on other nodes', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'Service A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'Service B' });
    const noteA = createNote({ author: 'architect', content: 'Note on A' });
    const noteB = createNote({ author: 'developer', content: 'Note on B' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNoteToNode(graph, nodeA.id, noteA);
    graph = addNoteToNode(graph, nodeB.id, noteB);

    // Remove note from A
    graph = removeNoteFromNode(graph, nodeA.id, noteA.id);

    // A should have 0 notes
    const updatedA = findNode(graph, nodeA.id);
    expect(updatedA!.notes).toHaveLength(0);

    // B should still have 1 note
    const updatedB = findNode(graph, nodeB.id);
    expect(updatedB!.notes).toHaveLength(1);
    expect(updatedB!.notes[0].content).toBe('Note on B');
  });

  it('should handle removing non-existent note ID gracefully', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note = createNote({ author: 'architect', content: 'Existing note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    // Try to remove a non-existent note
    const newGraph = removeNoteFromNode(graph, node.id, 'non-existent-note-id');

    // Note should still be there
    const updatedNode = findNode(newGraph, node.id);
    expect(updatedNode!.notes).toHaveLength(1);
    expect(updatedNode!.notes[0].id).toBe(note.id);
  });

  it('should handle removing from non-existent node gracefully', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note = createNote({ author: 'architect', content: 'Note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    // Try removing from a non-existent node
    const newGraph = removeNoteFromNode(graph, 'non-existent-node', note.id);

    // Original node should still have its note
    const updatedNode = findNode(newGraph, node.id);
    expect(updatedNode!.notes).toHaveLength(1);
  });

  it('should remove middle note from node with 3 notes', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note1 = createNote({ author: 'architect', content: 'First' });
    const note2 = createNote({ author: 'developer', content: 'Second' });
    const note3 = createNote({ author: 'reviewer', content: 'Third' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note1);
    graph = addNoteToNode(graph, node.id, note2);
    graph = addNoteToNode(graph, node.id, note3);

    // Remove middle note
    graph = removeNoteFromNode(graph, node.id, note2.id);

    const afterNode = findNode(graph, node.id);
    expect(afterNode!.notes).toHaveLength(2);
    expect(afterNode!.notes[0].id).toBe(note1.id);
    expect(afterNode!.notes[1].id).toBe(note3.id);
  });

  it('should preserve node properties after removing a note', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Order Service',
      args: { port: 3000 },
    });
    const note = createNote({ author: 'architect', content: 'Remove me' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = removeNoteFromNode(graph, node.id, note.id);

    const afterNode = findNode(graph, node.id);
    expect(afterNode!.displayName).toBe('Order Service');
    expect(afterNode!.type).toBe('compute/service');
    expect(afterNode!.args).toEqual({ port: 3000 });
    expect(afterNode!.notes).toHaveLength(0);
  });
});

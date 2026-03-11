/**
 * Unit tests for Feature #20: Graph engine updates note content.
 * Verifies updateNoteContent() modifies a note's content while preserving author and timestamp.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createNote,
  addNode,
  addChildNode,
  addNoteToNode,
  updateNoteContent,
  findNode,
} from '@/core/graph/graphEngine';

describe('updateNoteContent - modifies content preserving author and timestamp', () => {
  it('should update note content from "Original content" to "Updated content"', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Order Service' });
    const note = createNote({ author: 'architect', content: 'Original content' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = updateNoteContent(graph, node.id, note.id, 'Updated content');

    const updatedNode = findNode(graph, node.id);
    expect(updatedNode!.notes[0].content).toBe('Updated content');
  });

  it('should preserve note.author after content update', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Order Service' });
    const note = createNote({ author: 'architect', content: 'Original content' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = updateNoteContent(graph, node.id, note.id, 'Updated content');

    const updatedNode = findNode(graph, node.id);
    expect(updatedNode!.notes[0].author).toBe('architect');
  });

  it('should preserve note.id after content update', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Order Service' });
    const note = createNote({ author: 'architect', content: 'Original content' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = updateNoteContent(graph, node.id, note.id, 'Updated content');

    const updatedNode = findNode(graph, node.id);
    expect(updatedNode!.notes[0].id).toBe(note.id);
  });

  it('should preserve note.timestampMs after content update', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Order Service' });
    const note = createNote({ author: 'architect', content: 'Original content' });
    const originalTimestamp = note.timestampMs;

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = updateNoteContent(graph, node.id, note.id, 'Updated content');

    const updatedNode = findNode(graph, node.id);
    expect(updatedNode!.notes[0].timestampMs).toBe(originalTimestamp);
  });

  it('should preserve note.tags after content update', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note = createNote({
      author: 'architect',
      content: 'Original content',
      tags: ['important', 'review'],
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = updateNoteContent(graph, node.id, note.id, 'Updated content');

    const updatedNode = findNode(graph, node.id);
    expect(updatedNode!.notes[0].tags).toEqual(['important', 'review']);
  });

  it('should preserve note.status after content update', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note = createNote({
      author: 'ai',
      content: 'AI suggestion',
      status: 'pending',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = updateNoteContent(graph, node.id, note.id, 'Modified AI suggestion');

    const updatedNode = findNode(graph, node.id);
    expect(updatedNode!.notes[0].status).toBe('pending');
    expect(updatedNode!.notes[0].content).toBe('Modified AI suggestion');
  });

  it('should not modify the original graph (immutability)', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note = createNote({ author: 'architect', content: 'Original content' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    const newGraph = updateNoteContent(graph, node.id, note.id, 'Updated content');

    // Original should be unchanged
    const originalNode = findNode(graph, node.id);
    expect(originalNode!.notes[0].content).toBe('Original content');

    // New graph should have updated content
    const updatedNode = findNode(newGraph, node.id);
    expect(updatedNode!.notes[0].content).toBe('Updated content');
  });

  it('should update only the targeted note among multiple notes', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note1 = createNote({ author: 'architect', content: 'First note' });
    const note2 = createNote({ author: 'developer', content: 'Second note' });
    const note3 = createNote({ author: 'reviewer', content: 'Third note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note1);
    graph = addNoteToNode(graph, node.id, note2);
    graph = addNoteToNode(graph, node.id, note3);

    // Update only note2
    graph = updateNoteContent(graph, node.id, note2.id, 'Modified second note');

    const updatedNode = findNode(graph, node.id);
    expect(updatedNode!.notes).toHaveLength(3);
    expect(updatedNode!.notes[0].content).toBe('First note');
    expect(updatedNode!.notes[1].content).toBe('Modified second note');
    expect(updatedNode!.notes[2].content).toBe('Third note');
  });

  it('should update note on a child node (recursive search)', () => {
    const parent = createNode({ type: 'compute/service', displayName: 'Parent' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const note = createNote({ author: 'architect', content: 'Child note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child);
    graph = addNoteToNode(graph, child.id, note);

    graph = updateNoteContent(graph, child.id, note.id, 'Updated child note');

    const updatedChild = findNode(graph, child.id);
    expect(updatedChild!.notes[0].content).toBe('Updated child note');
    expect(updatedChild!.notes[0].author).toBe('architect');
    expect(updatedChild!.notes[0].id).toBe(note.id);
  });

  it('should update note on a deeply nested node (grandchild)', () => {
    const root = createNode({ type: 'compute/service', displayName: 'Root' });
    const child = createNode({ type: 'compute/function', displayName: 'Child' });
    const grandchild = createNode({ type: 'compute/worker', displayName: 'Grandchild' });
    const note = createNote({ author: 'architect', content: 'Deep note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, root);
    graph = addChildNode(graph, root.id, child);
    graph = addChildNode(graph, child.id, grandchild);
    graph = addNoteToNode(graph, grandchild.id, note);

    graph = updateNoteContent(graph, grandchild.id, note.id, 'Updated deep note');

    const updatedGrandchild = findNode(graph, grandchild.id);
    expect(updatedGrandchild!.notes[0].content).toBe('Updated deep note');
    expect(updatedGrandchild!.notes[0].id).toBe(note.id);
  });

  it('should handle updating non-existent note ID gracefully', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note = createNote({ author: 'architect', content: 'Existing note' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    const newGraph = updateNoteContent(graph, node.id, 'non-existent-note-id', 'New content');

    // Original note should be unchanged
    const updatedNode = findNode(newGraph, node.id);
    expect(updatedNode!.notes).toHaveLength(1);
    expect(updatedNode!.notes[0].content).toBe('Existing note');
  });

  it('should not affect notes on other nodes', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'Service A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'Service B' });
    const noteA = createNote({ author: 'architect', content: 'Note A' });
    const noteB = createNote({ author: 'developer', content: 'Note B' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNoteToNode(graph, nodeA.id, noteA);
    graph = addNoteToNode(graph, nodeB.id, noteB);

    // Update note on A
    graph = updateNoteContent(graph, nodeA.id, noteA.id, 'Updated A');

    const updatedA = findNode(graph, nodeA.id);
    expect(updatedA!.notes[0].content).toBe('Updated A');

    const updatedB = findNode(graph, nodeB.id);
    expect(updatedB!.notes[0].content).toBe('Note B'); // Unchanged
  });

  it('should allow updating content to empty string', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Service' });
    const note = createNote({ author: 'architect', content: 'Non-empty content' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = updateNoteContent(graph, node.id, note.id, '');

    const updatedNode = findNode(graph, node.id);
    expect(updatedNode!.notes[0].content).toBe('');
    expect(updatedNode!.notes[0].author).toBe('architect');
  });

  it('should preserve node properties after updating note content', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Order Service',
      args: { port: 8080 },
    });
    const note = createNote({ author: 'architect', content: 'Original' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    graph = updateNoteContent(graph, node.id, note.id, 'Updated');

    const updatedNode = findNode(graph, node.id);
    expect(updatedNode!.displayName).toBe('Order Service');
    expect(updatedNode!.type).toBe('compute/service');
    expect(updatedNode!.args).toEqual({ port: 8080 });
    expect(updatedNode!.notes[0].content).toBe('Updated');
  });
});

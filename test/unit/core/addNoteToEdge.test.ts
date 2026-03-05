/**
 * Unit tests for Feature #18: Graph engine adds note to edge.
 * Verifies addNoteToEdge() attaches a note to a specified edge with correct fields.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  createNote,
  addNode,
  addEdge,
  addNoteToEdge,
  findEdge,
} from '@/core/graph/graphEngine';

describe('addNoteToEdge - attaches note to edge', () => {
  // Helper to create a basic graph with 2 nodes and 1 edge
  function createTestGraph() {
    const nodeA = createNode({ type: 'compute/service', displayName: 'Service A' });
    const nodeB = createNode({ type: 'data/database', displayName: 'Database B' });
    const edge = createEdge({
      fromNode: nodeA.id,
      toNode: nodeB.id,
      type: 'sync',
      label: 'queries',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addEdge(graph, edge);

    return { graph, nodeA, nodeB, edge };
  }

  it('should add a note to an edge', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Edge note' });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge).toBeDefined();
    expect(updatedEdge!.notes).toHaveLength(1);
  });

  it('should set note.author to the provided author', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Edge note' });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes[0].author).toBe('architect');
  });

  it('should set note.content to the provided content', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Edge note' });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes[0].content).toBe('Edge note');
  });

  it('should generate a unique note ID', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Edge note' });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes[0].id).toBeDefined();
    expect(updatedEdge!.notes[0].id.length).toBeGreaterThan(0);
  });

  it('should set timestampMs on the note', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Edge note' });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes[0].timestampMs).toBeDefined();
    expect(typeof updatedEdge!.notes[0].timestampMs).toBe('number');
    expect(updatedEdge!.notes[0].timestampMs).toBeGreaterThan(0);
  });

  it('should default note status to "none"', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Edge note' });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes[0].status).toBe('none');
  });

  it('should default note tags to empty array', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Edge note' });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes[0].tags).toEqual([]);
  });

  it('should add multiple notes to the same edge', () => {
    const { graph, edge } = createTestGraph();
    const note1 = createNote({ author: 'architect', content: 'First edge note' });
    const note2 = createNote({ author: 'developer', content: 'Second edge note' });

    let newGraph = addNoteToEdge(graph, edge.id, note1);
    newGraph = addNoteToEdge(newGraph, edge.id, note2);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes).toHaveLength(2);
    expect(updatedEdge!.notes[0].content).toBe('First edge note');
    expect(updatedEdge!.notes[1].content).toBe('Second edge note');
  });

  it('should not modify the original graph (immutability)', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Edge note' });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    // Original graph edge should still have no notes
    const originalEdge = findEdge(graph, edge.id);
    expect(originalEdge!.notes).toHaveLength(0);

    // New graph edge should have the note
    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes).toHaveLength(1);
  });

  it('should not affect other edges', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    const nodeC = createNode({ type: 'compute/service', displayName: 'C' });
    const edge1 = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
    const edge2 = createEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'async' });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNode(graph, nodeC);
    graph = addEdge(graph, edge1);
    graph = addEdge(graph, edge2);

    const note = createNote({ author: 'architect', content: 'Only for edge1' });
    const newGraph = addNoteToEdge(graph, edge1.id, note);

    // Edge1 should have the note
    const updatedEdge1 = findEdge(newGraph, edge1.id);
    expect(updatedEdge1!.notes).toHaveLength(1);

    // Edge2 should be unaffected
    const updatedEdge2 = findEdge(newGraph, edge2.id);
    expect(updatedEdge2!.notes).toHaveLength(0);
  });

  it('should handle adding note to non-existent edge gracefully', () => {
    const { graph } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Orphan note' });

    // Should not crash
    const newGraph = addNoteToEdge(graph, 'non-existent-id', note);
    // Edges should remain unchanged
    expect(newGraph.edges).toHaveLength(1);
    expect(newGraph.edges[0].notes).toHaveLength(0);
  });

  it('should preserve note with custom tags', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({
      author: 'architect',
      content: 'Tagged edge note',
      tags: ['performance', 'review'],
    });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes[0].tags).toEqual(['performance', 'review']);
  });

  it('should preserve note with pending status', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({
      author: 'ai',
      content: 'AI suggestion for this edge',
      status: 'pending',
      suggestionType: 'optimization',
    });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.notes[0].status).toBe('pending');
    expect(updatedEdge!.notes[0].suggestionType).toBe('optimization');
  });

  it('should preserve edge properties when adding note', () => {
    const { graph, edge } = createTestGraph();
    const note = createNote({ author: 'architect', content: 'Edge note' });

    const newGraph = addNoteToEdge(graph, edge.id, note);

    const updatedEdge = findEdge(newGraph, edge.id);
    expect(updatedEdge!.fromNode).toBe(edge.fromNode);
    expect(updatedEdge!.toNode).toBe(edge.toNode);
    expect(updatedEdge!.type).toBe('sync');
    expect(updatedEdge!.label).toBe('queries');
  });
});

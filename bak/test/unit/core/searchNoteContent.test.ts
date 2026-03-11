/**
 * Feature #32: Full-text search finds matches in note content
 *
 * Search matches against note content attached to nodes and edges.
 *
 * Steps verified:
 * 1. Create node with note content 'Consider adding rate limiting'
 * 2. Search for 'rate limiting' and verify match found
 * 3. Search for 'rate' and verify match found
 * 4. Verify search result indicates it matched in a note
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createNote,
  createEdge,
  addNode,
  addEdge,
  addNoteToNode,
  addNoteToEdge,
} from '@/core/graph/graphEngine';
import { searchGraph } from '@/core/graph/graphQuery';

describe('Feature #32: Full-text search finds matches in note content', () => {
  /** Helper: create a graph with a node that has a note */
  function createGraphWithNoteOnNode() {
    const node = createNode({
      type: 'compute/service',
      displayName: 'API Gateway',
    });

    const note = createNote({
      author: 'developer',
      content: 'Consider adding rate limiting',
    });

    let graph = createEmptyGraph('Test Architecture');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note);

    return { graph, node, note };
  }

  /** Helper: create a graph with a note on an edge */
  function createGraphWithNoteOnEdge() {
    const nodeA = createNode({
      type: 'compute/service',
      displayName: 'Frontend App',
    });
    const nodeB = createNode({
      type: 'compute/service',
      displayName: 'Backend Service',
    });
    const edge = createEdge({
      fromNode: nodeA.id,
      toNode: nodeB.id,
      type: 'sync',
      label: 'API calls',
    });
    const note = createNote({
      author: 'architect',
      content: 'This connection needs circuit breaker pattern',
    });

    let graph = createEmptyGraph('Test Architecture');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addEdge(graph, edge);
    graph = addNoteToEdge(graph, edge.id, note);

    return { graph, nodeA, nodeB, edge, note };
  }

  // --- Step 1 & 2: Search for 'rate limiting' in note content ---

  it('should find match when searching for "rate limiting" in node note content', () => {
    const { graph, node } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'rate limiting');
    expect(results.length).toBeGreaterThan(0);

    // Should find a 'note' type result
    const noteMatch = results.find((r) => r.type === 'note');
    expect(noteMatch).toBeDefined();
    expect(noteMatch!.parentId).toBe(node.id);
  });

  // --- Step 3: Search for 'rate' partial match ---

  it('should find match when searching for "rate" (partial match in note content)', () => {
    const { graph, node } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'rate');
    expect(results.length).toBeGreaterThan(0);

    const noteMatch = results.find((r) => r.type === 'note');
    expect(noteMatch).toBeDefined();
    expect(noteMatch!.parentId).toBe(node.id);
  });

  // --- Step 4: Verify result indicates it matched in a note ---

  it('should return result with type "note" for note content matches', () => {
    const { graph } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'rate limiting');
    const noteResult = results.find((r) => r.type === 'note');
    expect(noteResult).toBeDefined();
    expect(noteResult!.type).toBe('note');
  });

  it('should include note content excerpt in matchContext', () => {
    const { graph } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'rate limiting');
    const noteResult = results.find((r) => r.type === 'note');
    expect(noteResult).toBeDefined();
    expect(noteResult!.matchContext).toContain('Consider adding rate limiting');
  });

  it('should include parent node name in displayName for note results', () => {
    const { graph } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'rate limiting');
    const noteResult = results.find((r) => r.type === 'note');
    expect(noteResult).toBeDefined();
    expect(noteResult!.displayName).toContain('API Gateway');
  });

  // --- Case sensitivity ---

  it('should be case-insensitive when searching note content', () => {
    const { graph } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'RATE LIMITING');
    const noteMatch = results.find((r) => r.type === 'note');
    expect(noteMatch).toBeDefined();
  });

  it('should match mixed-case queries against note content', () => {
    const { graph } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'RaTe LiMiTiNg');
    const noteMatch = results.find((r) => r.type === 'note');
    expect(noteMatch).toBeDefined();
  });

  // --- Edge note search ---

  it('should find match in edge note content', () => {
    const { graph } = createGraphWithNoteOnEdge();

    const results = searchGraph(graph, 'circuit breaker');
    expect(results.length).toBeGreaterThan(0);

    // Edge notes contribute to edge results (not separate 'note' results)
    const edgeResult = results.find((r) => r.type === 'edge');
    expect(edgeResult).toBeDefined();
  });

  it('should include edge note content in matchContext for edge results', () => {
    const { graph } = createGraphWithNoteOnEdge();

    // Search for something only in the edge note (not in the label)
    const results = searchGraph(graph, 'circuit breaker');
    const edgeResult = results.find((r) => r.type === 'edge');
    expect(edgeResult).toBeDefined();
    expect(edgeResult!.matchContext).toContain('Note:');
    expect(edgeResult!.matchContext).toContain('circuit breaker');
  });

  // --- Score verification ---

  it('should give note matches a score of 5', () => {
    const { graph } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'rate limiting');
    const noteResult = results.find((r) => r.type === 'note');
    expect(noteResult).toBeDefined();
    expect(noteResult!.score).toBe(5);
  });

  // --- Multiple notes ---

  it('should find matches across multiple notes on the same node', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Order Service',
    });
    const note1 = createNote({
      author: 'dev',
      content: 'Needs performance optimization for heavy loads',
    });
    const note2 = createNote({
      author: 'architect',
      content: 'Consider caching for frequently accessed data',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);
    graph = addNoteToNode(graph, node.id, note1);
    graph = addNoteToNode(graph, node.id, note2);

    // Search for something in note1
    const results1 = searchGraph(graph, 'performance optimization');
    const match1 = results1.find((r) => r.type === 'note' && r.id === note1.id);
    expect(match1).toBeDefined();

    // Search for something in note2
    const results2 = searchGraph(graph, 'caching');
    const match2 = results2.find((r) => r.type === 'note' && r.id === note2.id);
    expect(match2).toBeDefined();
  });

  // --- Note on child node ---

  it('should find note matches on child nodes (recursive search)', () => {
    const parent = createNode({
      type: 'compute/service',
      displayName: 'Parent Service',
    });
    const child = createNode({
      type: 'compute/function',
      displayName: 'Child Handler',
    });
    const note = createNote({
      author: 'dev',
      content: 'This handler needs input validation',
    });

    const childWithNote = {
      ...child,
      notes: [note],
    };
    const parentWithChild = {
      ...parent,
      children: [childWithNote],
    };

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parentWithChild);

    const results = searchGraph(graph, 'input validation');
    const noteMatch = results.find((r) => r.type === 'note' && r.id === note.id);
    expect(noteMatch).toBeDefined();
    expect(noteMatch!.parentId).toBe(child.id);
  });

  // --- No false positives ---

  it('should not match note content that does not contain query', () => {
    const { graph } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'authentication');
    const noteMatch = results.find((r) => r.type === 'note');
    expect(noteMatch).toBeUndefined();
  });

  // --- Note result has correct ID ---

  it('should use note ID (not node ID) for note search results', () => {
    const { graph, note } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'rate limiting');
    const noteResult = results.find((r) => r.type === 'note');
    expect(noteResult).toBeDefined();
    expect(noteResult!.id).toBe(note.id);
  });

  // --- ParentId is set correctly ---

  it('should set parentId to the owning node ID for note results', () => {
    const { graph, node } = createGraphWithNoteOnNode();

    const results = searchGraph(graph, 'rate');
    const noteResult = results.find((r) => r.type === 'note');
    expect(noteResult).toBeDefined();
    expect(noteResult!.parentId).toBe(node.id);
  });
});

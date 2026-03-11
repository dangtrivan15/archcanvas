/**
 * Feature #45: Text API addNote() creates note on node or edge
 *
 * TextAPI.addNote() attaches a note through the API layer.
 *
 * Steps verified:
 * 1. Create a node via Text API
 * 2. Call textApi.addNote({nodeId: id, author: 'dev', content: 'Test note'})
 * 3. Call textApi.getNode(id) and verify note appears
 * 4. Verify note content, author, and timestamp are correct
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('Feature #45: TextApi.addNote() creates note on node or edge', () => {
  let registry: RegistryManager;

  beforeEach(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  function createEmptyGraph(): ArchGraph {
    return {
      name: 'Test Architecture',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
  }

  it('should create a note on a node with author and content', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    // Step 1: Create a node
    const node = textApi.addNode({
      type: 'data/database',
      displayName: 'Users DB',
    });

    // Step 2: Add a note
    const note = textApi.addNote({
      nodeId: node.id,
      author: 'dev',
      content: 'Test note',
    });

    // Verify note is returned
    expect(note).toBeDefined();
    expect(note.id).toBeDefined();
    expect(note.id.length).toBeGreaterThan(0);
    expect(note.author).toBe('dev');
    expect(note.content).toBe('Test note');
  });

  it('should show the note when getNode is called', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Auth Service',
    });

    textApi.addNote({
      nodeId: node.id,
      author: 'dev',
      content: 'Needs load testing',
    });

    // Step 3: Verify note appears in getNode
    const detail = textApi.getNode(node.id);
    expect(detail).toBeDefined();
    expect(detail!.notes).toHaveLength(1);
    expect(detail!.notes[0].content).toBe('Needs load testing');
    expect(detail!.notes[0].author).toBe('dev');
  });

  it('should have a valid timestamp on the note', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'data/database',
      displayName: 'DB',
    });

    const beforeMs = Date.now();
    const note = textApi.addNote({
      nodeId: node.id,
      author: 'developer',
      content: 'Test timestamp',
    });
    const afterMs = Date.now();

    // Step 4: Verify timestamp is correct
    expect(note.timestampMs).toBeGreaterThanOrEqual(beforeMs);
    expect(note.timestampMs).toBeLessThanOrEqual(afterMs);

    // Also check via getNode
    const detail = textApi.getNode(node.id);
    expect(detail!.notes[0].timestampMs).toBe(note.timestampMs);
  });

  it('should support adding tags to a note', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'API',
    });

    const note = textApi.addNote({
      nodeId: node.id,
      author: 'dev',
      content: 'Add rate limiting',
      tags: ['performance', 'security'],
    });

    expect(note.tags).toEqual(['performance', 'security']);
  });

  it('should default note status to none', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'data/database',
      displayName: 'DB',
    });

    const note = textApi.addNote({
      nodeId: node.id,
      author: 'dev',
      content: 'Note with default status',
    });

    expect(note.status).toBe('none');
  });

  it('should add multiple notes to the same node', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service',
    });

    textApi.addNote({ nodeId: node.id, author: 'alice', content: 'First note' });
    textApi.addNote({ nodeId: node.id, author: 'bob', content: 'Second note' });
    textApi.addNote({ nodeId: node.id, author: 'charlie', content: 'Third note' });

    const detail = textApi.getNode(node.id);
    expect(detail!.notes).toHaveLength(3);
    expect(detail!.notes[0].content).toBe('First note');
    expect(detail!.notes[1].content).toBe('Second note');
    expect(detail!.notes[2].content).toBe('Third note');
  });

  it('should generate unique note IDs', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'data/database',
      displayName: 'DB',
    });

    const note1 = textApi.addNote({ nodeId: node.id, author: 'dev', content: 'Note 1' });
    const note2 = textApi.addNote({ nodeId: node.id, author: 'dev', content: 'Note 2' });

    expect(note1.id).not.toBe(note2.id);
  });

  it('should increase noteCount in listNodes after adding note', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service',
    });

    const beforeList = textApi.listNodes();
    expect(beforeList[0].noteCount).toBe(0);

    textApi.addNote({ nodeId: node.id, author: 'dev', content: 'A note' });

    const afterList = textApi.listNodes();
    expect(afterList[0].noteCount).toBe(1);
  });

  it('should add note to an edge', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node1 = textApi.addNode({ type: 'compute/service', displayName: 'Service A' });
    const node2 = textApi.addNode({ type: 'data/database', displayName: 'Database' });
    const edge = textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
    });

    const note = textApi.addNote({
      edgeId: edge.id,
      author: 'dev',
      content: 'Edge note about data flow',
    });

    expect(note).toBeDefined();
    expect(note.author).toBe('dev');
    expect(note.content).toBe('Edge note about data flow');

    // Verify edge has the note
    const edges = textApi.getEdges();
    const updatedEdge = edges.find((e) => e.id === edge.id);
    expect(updatedEdge!.noteCount).toBe(1);
  });

  it('should return note with empty tags by default', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service',
    });

    const note = textApi.addNote({
      nodeId: node.id,
      author: 'dev',
      content: 'No tags',
    });

    expect(note.tags).toEqual([]);
  });

  it('should not affect other nodes when adding a note', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node1 = textApi.addNode({ type: 'compute/service', displayName: 'Service A' });
    const node2 = textApi.addNode({ type: 'data/database', displayName: 'DB B' });

    textApi.addNote({ nodeId: node1.id, author: 'dev', content: 'Note for node1' });

    const detail1 = textApi.getNode(node1.id);
    const detail2 = textApi.getNode(node2.id);

    expect(detail1!.notes).toHaveLength(1);
    expect(detail2!.notes).toHaveLength(0);
  });

  it('note appears in getNode detail with all fields', () => {
    const textApi = new TextApi(createEmptyGraph(), registry);

    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Service',
    });

    const note = textApi.addNote({
      nodeId: node.id,
      author: 'architect',
      content: 'Review this service before deployment',
      tags: ['review'],
    });

    const detail = textApi.getNode(node.id);
    const detailNote = detail!.notes[0];

    expect(detailNote.id).toBe(note.id);
    expect(detailNote.author).toBe('architect');
    expect(detailNote.content).toBe('Review this service before deployment');
    expect(detailNote.timestampMs).toBe(note.timestampMs);
    expect(detailNote.status).toBe('none');
  });
});

/**
 * Feature #181: MCP add_note tool creates note.
 * Verifies that the MCP add_note tool adds a note to a node,
 * returns a success response with noteId,
 * and the note appears on the node in the describe output.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleAddNote, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP add_note tool - Feature #181', () => {
  let ctx: ToolHandlerContext;
  let nodeId: string;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing MCP add_note',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };

    // Step 1: Create a node via MCP
    const nodeResult = JSON.parse(dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Auth Service',
    }));
    nodeId = nodeResult.nodeId;
  });

  // Step 2: Call MCP add_note with nodeId and content
  it('creates a note on a node', () => {
    const result = dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'developer',
      content: 'This service handles authentication and authorization.',
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.noteId).toBeDefined();
    expect(typeof parsed.noteId).toBe('string');
    expect(parsed.noteId.length).toBeGreaterThan(0);
  });

  // Step 3: Verify success response
  it('returns success true with valid noteId', () => {
    const result = handleAddNote(ctx, {
      nodeId,
      author: 'architect',
      content: 'Consider rate limiting for this service.',
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.noteId).toBeTruthy();
  });

  // Step 4: Call describe and verify note appears on node
  it('note appears in describe output on the node', () => {
    // Add a note
    const addResult = dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'tester',
      content: 'Needs load testing before production.',
    });
    const addParsed = JSON.parse(addResult);
    expect(addParsed.success).toBe(true);

    // Call describe and verify note is on the node
    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.nodeCount).toBe(1);
    expect(descParsed.nodes[0].noteCount).toBe(1);
    expect(descParsed.nodes[0].id).toBe(nodeId);
  });

  // Verify note content in AI format
  it('note content appears in AI describe format', () => {
    dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'reviewer',
      content: 'Consider using JWT tokens.',
    });

    const aiResult = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(aiResult).toContain('Consider using JWT tokens.');
    expect(aiResult).toContain('reviewer');
    expect(aiResult).toContain('notes');
  });

  // Verify note content in human format
  it('note count appears in human describe format', () => {
    dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'dev',
      content: 'Important design note.',
    });

    const humanResult = dispatchToolCall(ctx, 'describe', { format: 'human' });
    expect(humanResult).toContain('1 notes');
    expect(humanResult).toContain('Auth Service');
  });

  // Additional: Note with tags
  it('creates a note with tags', () => {
    const result = JSON.parse(dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'architect',
      content: 'Security review needed.',
      tags: ['security', 'review'],
    }));

    expect(result.success).toBe(true);
    expect(result.noteId).toBeTruthy();
  });

  // Additional: Multiple notes on same node
  it('creates multiple notes on the same node', () => {
    dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'dev1',
      content: 'First note',
    });
    dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'dev2',
      content: 'Second note',
    });
    dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'dev3',
      content: 'Third note',
    });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.nodes[0].noteCount).toBe(3);
  });

  // Verify note ID uniqueness
  it('generates unique note IDs', () => {
    const result1 = JSON.parse(dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'dev',
      content: 'Note 1',
    }));
    const result2 = JSON.parse(dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'dev',
      content: 'Note 2',
    }));

    expect(result1.noteId).not.toBe(result2.noteId);
  });

  // Verify dispatch route
  it('dispatchToolCall correctly routes to add_note handler', () => {
    const result = dispatchToolCall(ctx, 'add_note', {
      nodeId,
      author: 'agent',
      content: 'Dispatched note content.',
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.noteId).toBeTruthy();
  });

  // Verify note on edge (add_note supports edges too)
  it('creates a note on an edge', () => {
    // Create second node and edge first
    const nodeB = JSON.parse(dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'Users DB',
    }));
    const edge = JSON.parse(dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeId,
      toNode: nodeB.nodeId,
      type: 'sync',
    }));

    // Add note to the edge
    const result = JSON.parse(dispatchToolCall(ctx, 'add_note', {
      edgeId: edge.edgeId,
      author: 'architect',
      content: 'Consider caching this connection.',
    }));

    expect(result.success).toBe(true);
    expect(result.noteId).toBeTruthy();
  });
});

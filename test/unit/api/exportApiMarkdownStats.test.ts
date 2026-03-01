/**
 * Feature #61: Markdown summary includes architecture statistics.
 * Verifies that the markdown summary includes counts of nodes, edges, and other metrics.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ExportApi } from '@/api/exportApi';
import type { ArchGraph, ArchNode, ArchEdge, Note } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

function makeNote(content: string): Note {
  return {
    id: generateId(),
    author: 'user',
    timestampMs: Date.now(),
    content,
    tags: [],
    status: 'none',
  };
}

function makeNode(overrides: Partial<ArchNode> & { type: string; displayName: string }): ArchNode {
  return {
    id: overrides.id ?? generateId(),
    type: overrides.type,
    displayName: overrides.displayName,
    args: overrides.args ?? {},
    codeRefs: overrides.codeRefs ?? [],
    notes: overrides.notes ?? [],
    properties: overrides.properties ?? {},
    position: overrides.position ?? { x: 0, y: 0, width: 200, height: 100 },
    children: overrides.children ?? [],
    refSource: overrides.refSource,
  };
}

function makeEdge(overrides: Partial<ArchEdge> & { fromNode: string; toNode: string }): ArchEdge {
  return {
    id: overrides.id ?? generateId(),
    fromNode: overrides.fromNode,
    toNode: overrides.toNode,
    type: overrides.type ?? 'sync',
    label: overrides.label,
    properties: overrides.properties ?? {},
    notes: overrides.notes ?? [],
  };
}

describe('ExportApi markdown statistics - Feature #61', () => {
  let exportApi: ExportApi;
  let graph: ArchGraph;
  let node1: ArchNode;
  let node2: ArchNode;
  let node3: ArchNode;
  let node4: ArchNode;
  let node5: ArchNode;

  beforeAll(() => {
    exportApi = new ExportApi();

    // Step 1: Create architecture with 5 nodes, 4 edges, 3 notes
    node1 = makeNode({
      type: 'compute/api-gateway',
      displayName: 'API Gateway',
      notes: [makeNote('Entry point for all requests')],
    });
    node2 = makeNode({
      type: 'compute/service',
      displayName: 'User Service',
      notes: [makeNote('Handles user authentication and profiles')],
    });
    node3 = makeNode({
      type: 'compute/service',
      displayName: 'Order Service',
    });
    node4 = makeNode({
      type: 'data/database',
      displayName: 'Users DB',
      args: { engine: 'PostgreSQL', version: '15' },
      notes: [makeNote('Primary user data store')],
    });
    node5 = makeNode({
      type: 'messaging/message-queue',
      displayName: 'Event Bus',
    });

    const edge1 = makeEdge({ fromNode: node1.id, toNode: node2.id, type: 'sync', label: 'REST' });
    const edge2 = makeEdge({ fromNode: node1.id, toNode: node3.id, type: 'sync', label: 'REST' });
    const edge3 = makeEdge({ fromNode: node2.id, toNode: node4.id, type: 'data-flow', label: 'SQL' });
    const edge4 = makeEdge({ fromNode: node3.id, toNode: node5.id, type: 'async', label: 'Events' });

    graph = {
      name: 'Microservices Platform',
      description: 'A microservices architecture with gateway, services, and event-driven messaging',
      owners: ['platform-team', 'backend-team'],
      nodes: [node1, node2, node3, node4, node5],
      edges: [edge1, edge2, edge3, edge4],
    };
  });

  // Step 2: Generate markdown summary (done in each test via exportApi.generateMarkdownSummary())

  // Step 3: Verify summary includes total node count
  it('includes total node count of 5 in statistics table', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('| Nodes  | 5 |');
  });

  // Step 4: Verify summary includes total edge count
  it('includes total edge count of 4 in statistics table', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('| Edges  | 4 |');
  });

  it('includes owner count in statistics table', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('| Owners | 2 |');
  });

  // Step 5: Verify summary section headers are correct
  it('contains Overview section header', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('## Overview');
  });

  it('contains Components section header', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('## Components');
  });

  it('contains Connections section header', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('## Connections');
  });

  it('contains Owners section header', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('## Owners');
  });

  // Statistics table is well-formed markdown table
  it('statistics table has proper markdown table format', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('| Metric | Count |');
    expect(result).toContain('|--------|-------|');
  });

  // All 5 nodes listed
  it('lists all 5 nodes in Components section', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('API Gateway');
    expect(result).toContain('User Service');
    expect(result).toContain('Order Service');
    expect(result).toContain('Users DB');
    expect(result).toContain('Event Bus');
  });

  // All 4 edges listed with types
  it('lists all 4 edges with connection types', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    const syncMatches = (result.match(/\[sync\]/g) || []).length;
    const asyncMatches = (result.match(/\[async\]/g) || []).length;
    const dataFlowMatches = (result.match(/\[data-flow\]/g) || []).length;
    expect(syncMatches).toBe(2); // 2 sync edges
    expect(asyncMatches).toBe(1); // 1 async edge
    expect(dataFlowMatches).toBe(1); // 1 data-flow edge
  });

  // Node types shown
  it('includes node type information for each node', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('compute/api-gateway');
    expect(result).toContain('compute/service');
    expect(result).toContain('data/database');
    expect(result).toContain('messaging/message-queue');
  });

  // Node args shown
  it('includes node arguments in the summary', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('engine');
    expect(result).toContain('PostgreSQL');
    expect(result).toContain('version');
    expect(result).toContain('15');
  });

  // Notes are counted
  it('includes notes count for nodes with notes', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    // Nodes with notes should show "Notes: N"
    const notesMatches = (result.match(/\*\*Notes:\*\*/g) || []).length;
    // 3 nodes have notes: API Gateway (1), User Service (1), Users DB (1)
    expect(notesMatches).toBe(3);
  });

  // Owners listed
  it('lists all owners', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('platform-team');
    expect(result).toContain('backend-team');
  });

  // Edge labels
  it('includes edge labels', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('REST');
    expect(result).toContain('SQL');
    expect(result).toContain('Events');
  });

  // Architecture name as heading
  it('starts with architecture name as H1 heading', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result.startsWith('# Microservices Platform')).toBe(true);
  });

  // Architecture description
  it('includes architecture description', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('A microservices architecture with gateway');
  });

  // Nested children included in count
  it('counts nested child nodes in total statistics', () => {
    const childNode = makeNode({ type: 'compute/function', displayName: 'Handler' });
    const parentNode = makeNode({
      type: 'compute/service',
      displayName: 'Parent',
      children: [childNode],
    });
    const nestedGraph: ArchGraph = {
      name: 'Nested Test',
      description: '',
      owners: [],
      nodes: [parentNode],
      edges: [],
    };
    const result = exportApi.generateMarkdownSummary(nestedGraph);
    // Should count both parent and child node (2 total)
    expect(result).toContain('| Nodes  | 2 |');
  });
});

/**
 * Feature #58: Export API generates markdown summary.
 * Verifies that ExportAPI generates a complete markdown summary of the architecture.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ExportApi } from '@/api/exportApi';
import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

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

describe('ExportApi.generateMarkdownSummary() - Feature #58', () => {
  let exportApi: ExportApi;
  let graph: ArchGraph;
  let node1: ArchNode;
  let node2: ArchNode;
  let node3: ArchNode;
  let node4: ArchNode;
  let edge1: ArchEdge;
  let edge2: ArchEdge;
  let edge3: ArchEdge;

  beforeAll(() => {
    exportApi = new ExportApi();

    // Step 1: Create architecture 'E-Commerce' with 4 nodes and 3 edges
    node1 = makeNode({ type: 'compute/api-gateway', displayName: 'API Gateway' });
    node2 = makeNode({ type: 'compute/service', displayName: 'Order Service' });
    node3 = makeNode({ type: 'data/database', displayName: 'Orders DB', args: { engine: 'PostgreSQL' } });
    node4 = makeNode({ type: 'messaging/message-queue', displayName: 'Event Queue' });

    edge1 = makeEdge({ fromNode: node1.id, toNode: node2.id, type: 'sync', label: 'REST API' });
    edge2 = makeEdge({ fromNode: node2.id, toNode: node3.id, type: 'data-flow', label: 'SQL Queries' });
    edge3 = makeEdge({ fromNode: node2.id, toNode: node4.id, type: 'async', label: 'Order Events' });

    graph = {
      name: 'E-Commerce',
      description: 'An e-commerce platform architecture',
      owners: ['platform-team'],
      nodes: [node1, node2, node3, node4],
      edges: [edge1, edge2, edge3],
    };
  });

  // Step 2: Call exportApi.generateMarkdownSummary()
  it('returns a non-empty string', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  // Step 3: Verify output starts with architecture name as heading
  it('starts with architecture name as H1 heading', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result.startsWith('# E-Commerce')).toBe(true);
  });

  it('includes the architecture description', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('An e-commerce platform architecture');
  });

  // Step 4: Verify output lists all nodes
  it('lists all 4 nodes', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('API Gateway');
    expect(result).toContain('Order Service');
    expect(result).toContain('Orders DB');
    expect(result).toContain('Event Queue');
  });

  it('includes a Components section', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('## Components');
  });

  // Step 5: Verify output lists all edges with connection info
  it('lists all 3 edges with connection types', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('[sync]');
    expect(result).toContain('[data-flow]');
    expect(result).toContain('[async]');
  });

  it('includes edge labels', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('REST API');
    expect(result).toContain('SQL Queries');
    expect(result).toContain('Order Events');
  });

  it('includes a Connections section', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('## Connections');
  });

  // Step 6: Verify output includes node types and descriptions
  it('includes node types', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('compute/api-gateway');
    expect(result).toContain('compute/service');
    expect(result).toContain('data/database');
    expect(result).toContain('messaging/message-queue');
  });

  it('includes node args/properties as descriptions', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('engine');
    expect(result).toContain('PostgreSQL');
  });

  // Additional verifications
  it('includes overview statistics table', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('## Overview');
    expect(result).toContain('| Nodes  | 4 |');
    expect(result).toContain('| Edges  | 3 |');
  });

  it('includes auto-generated notice', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('Auto-generated by ArchCanvas');
  });

  it('includes owners section', () => {
    const result = exportApi.generateMarkdownSummary(graph);
    expect(result).toContain('## Owners');
    expect(result).toContain('platform-team');
  });

  // Edge case: empty graph
  it('handles empty graph gracefully', () => {
    const emptyGraph: ArchGraph = {
      name: 'Empty',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const result = exportApi.generateMarkdownSummary(emptyGraph);
    expect(result.startsWith('# Empty')).toBe(true);
    expect(result).toContain('| Nodes  | 0 |');
    expect(result).toContain('| Edges  | 0 |');
    expect(result).not.toContain('## Components');
    expect(result).not.toContain('## Connections');
  });
});

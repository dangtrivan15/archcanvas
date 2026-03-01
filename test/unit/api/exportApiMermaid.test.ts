/**
 * Feature #59: Export API generates valid Mermaid diagram.
 * Verifies that ExportAPI generates a Mermaid diagram that follows Mermaid syntax.
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

describe('ExportApi.generateMermaid() - Feature #59', () => {
  let exportApi: ExportApi;
  let node1: ArchNode;
  let node2: ArchNode;
  let node3: ArchNode;
  let edge1: ArchEdge;
  let edge2: ArchEdge;
  let graph: ArchGraph;

  beforeAll(() => {
    exportApi = new ExportApi();

    // Step 1: Create architecture with 3 nodes and 2 edges
    node1 = makeNode({ type: 'compute/service', displayName: 'Order Service' });
    node2 = makeNode({ type: 'data/database', displayName: 'Orders DB' });
    node3 = makeNode({ type: 'messaging/message-queue', displayName: 'Event Queue' });

    edge1 = makeEdge({ fromNode: node1.id, toNode: node2.id, type: 'sync', label: 'SQL Queries' });
    edge2 = makeEdge({ fromNode: node1.id, toNode: node3.id, type: 'async', label: 'Order Events' });

    graph = {
      name: 'E-Commerce',
      description: 'E-commerce architecture',
      owners: ['team-a'],
      nodes: [node1, node2, node3],
      edges: [edge1, edge2],
    };
  });

  // Step 2: Call exportApi.generateMermaid()
  it('returns a non-empty string', () => {
    const result = exportApi.generateMermaid(graph);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  // Step 3: Verify output starts with 'graph' or 'flowchart' directive
  it('starts with graph or flowchart directive', () => {
    const result = exportApi.generateMermaid(graph);
    const firstLine = result.split('\n')[0].trim();
    expect(
      firstLine.startsWith('graph') || firstLine.startsWith('flowchart')
    ).toBe(true);
  });

  it('uses left-to-right direction (LR)', () => {
    const result = exportApi.generateMermaid(graph);
    expect(result).toContain('graph LR');
  });

  // Step 4: Verify each node appears with correct label
  it('includes all 3 nodes with correct labels', () => {
    const result = exportApi.generateMermaid(graph);
    expect(result).toContain('Order Service');
    expect(result).toContain('Orders DB');
    expect(result).toContain('Event Queue');
  });

  it('each node has a sanitized ID followed by its label', () => {
    const result = exportApi.generateMermaid(graph);
    const lines = result.split('\n');
    // Each node line should contain a sanitized id and a label in quotes
    const nodeLines = lines.filter(l => l.includes('"Order Service"') || l.includes('"Orders DB"') || l.includes('"Event Queue"'));
    expect(nodeLines.length).toBe(3);
  });

  // Step 5: Verify edges appear with correct connections
  it('includes edges connecting correct node IDs', () => {
    const result = exportApi.generateMermaid(graph);
    const safeNode1Id = node1.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const safeNode2Id = node2.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const safeNode3Id = node3.id.replace(/[^a-zA-Z0-9_]/g, '_');

    // Edge from node1 to node2 (sync)
    expect(result).toContain(`${safeNode1Id} -->`);
    // Edge from node1 to node3 (async)
    expect(result).toContain(`${safeNode1Id} -.->`);
  });

  it('includes edge labels', () => {
    const result = exportApi.generateMermaid(graph);
    expect(result).toContain('SQL Queries');
    expect(result).toContain('Order Events');
  });

  // Step 6: Verify Mermaid syntax is valid (arrows, brackets)
  it('uses correct arrow syntax for sync edges (-->)', () => {
    const result = exportApi.generateMermaid(graph);
    expect(result).toContain('-->');
  });

  it('uses correct arrow syntax for async edges (-.->)', () => {
    const result = exportApi.generateMermaid(graph);
    expect(result).toContain('-.->');
  });

  it('uses correct shape for database nodes (cylinder: [( )])', () => {
    const result = exportApi.generateMermaid(graph);
    // Database node should use cylinder shape [(label)]
    const nodeLines = result.split('\n');
    const dbLine = nodeLines.find(l => l.includes('Orders DB'));
    expect(dbLine).toBeTruthy();
    expect(dbLine).toContain('[(');
    expect(dbLine).toContain(')]');
  });

  it('uses correct shape for service nodes (rectangle: [label])', () => {
    const result = exportApi.generateMermaid(graph);
    const nodeLines = result.split('\n');
    const serviceLine = nodeLines.find(l => l.includes('Order Service'));
    expect(serviceLine).toBeTruthy();
    // Service (compute) should use [label]
    expect(serviceLine).toMatch(/\["Order Service"\]/);
  });

  it('uses correct shape for queue nodes (stadium: ([label]))', () => {
    const result = exportApi.generateMermaid(graph);
    const nodeLines = result.split('\n');
    const queueLine = nodeLines.find(l => l.includes('Event Queue'));
    expect(queueLine).toBeTruthy();
    expect(queueLine).toContain('([');
    expect(queueLine).toContain('])');
  });

  // Additional edge type: data-flow
  it('uses correct arrow syntax for data-flow edges (==>)', () => {
    const dataFlowEdge = makeEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'data-flow',
      label: 'Data Sync',
    });
    const dataFlowGraph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [node1, node2],
      edges: [dataFlowEdge],
    };
    const result = exportApi.generateMermaid(dataFlowGraph);
    expect(result).toContain('==>');
  });

  // Edge without label
  it('handles edges without labels correctly', () => {
    const noLabelEdge = makeEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
    });
    const noLabelGraph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [node1, node2],
      edges: [noLabelEdge],
    };
    const result = exportApi.generateMermaid(noLabelGraph);
    const safeNode1Id = node1.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const safeNode2Id = node2.id.replace(/[^a-zA-Z0-9_]/g, '_');
    expect(result).toContain(`${safeNode1Id} --> ${safeNode2Id}`);
  });

  // Empty graph
  it('handles empty graph with just the directive', () => {
    const emptyGraph: ArchGraph = {
      name: 'Empty',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const result = exportApi.generateMermaid(emptyGraph);
    expect(result.trim()).toBe('graph LR');
  });

  // Gateway (hexagon) shape
  it('uses correct shape for gateway nodes (hexagon: {{label}})', () => {
    const gatewayNode = makeNode({ type: 'compute/api-gateway', displayName: 'API Gateway' });
    const gw: ArchGraph = {
      name: 'GW Test',
      description: '',
      owners: [],
      nodes: [gatewayNode],
      edges: [],
    };
    const result = exportApi.generateMermaid(gw);
    const gwLine = result.split('\n').find(l => l.includes('API Gateway'));
    expect(gwLine).toBeTruthy();
    expect(gwLine).toContain('{{');
    expect(gwLine).toContain('}}');
  });

  // Node with special characters in display name
  it('escapes double quotes in node display names', () => {
    const specialNode = makeNode({ type: 'compute/service', displayName: 'My "Service"' });
    const specialGraph: ArchGraph = {
      name: 'Special',
      description: '',
      owners: [],
      nodes: [specialNode],
      edges: [],
    };
    const result = exportApi.generateMermaid(specialGraph);
    // Double quotes should be escaped (using #quot;)
    expect(result).not.toContain('"My "Service""');
    expect(result).toContain('#quot;');
  });

  // Nested children are flattened
  it('includes child nodes (flattened) in the diagram', () => {
    const childNode = makeNode({ type: 'compute/function', displayName: 'Handler Fn' });
    const parentNode = makeNode({
      type: 'compute/service',
      displayName: 'Parent Service',
      children: [childNode],
    });
    const nestedGraph: ArchGraph = {
      name: 'Nested',
      description: '',
      owners: [],
      nodes: [parentNode],
      edges: [],
    };
    const result = exportApi.generateMermaid(nestedGraph);
    expect(result).toContain('Parent Service');
    expect(result).toContain('Handler Fn');
  });
});

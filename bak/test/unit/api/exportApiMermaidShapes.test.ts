/**
 * Feature #60: Mermaid export maps node types to correct shapes.
 * Verifies that different node types use different Mermaid shapes
 * (rectangles, cylinders, stadium, hexagon, etc.).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ExportApi } from '@/api/exportApi';
import type { ArchGraph, ArchNode } from '@/types/graph';
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

function getMermaidLine(output: string, displayName: string): string | undefined {
  return output.split('\n').find((l) => l.includes(`"${displayName}"`));
}

describe('ExportApi Mermaid shape mapping - Feature #60', () => {
  let exportApi: ExportApi;

  beforeAll(() => {
    exportApi = new ExportApi();
  });

  function generateSingleNode(type: string, displayName: string): string {
    const node = makeNode({ type, displayName });
    const graph: ArchGraph = {
      name: 'Shape Test',
      description: '',
      owners: [],
      nodes: [node],
      edges: [],
    };
    return exportApi.generateMermaid(graph);
  }

  // Step 1 & 2: Create architecture with service, database, queue, gateway nodes and generate Mermaid

  // Step 3: Verify service uses rectangle shape [label]
  it('service node uses rectangle shape [label]', () => {
    const result = generateSingleNode('compute/service', 'Order Service');
    const line = getMermaidLine(result, 'Order Service');
    expect(line).toBeTruthy();
    // Rectangle: ID["label"]
    expect(line).toMatch(/\["Order Service"\]/);
  });

  it('function node uses rectangle shape [label]', () => {
    const result = generateSingleNode('compute/function', 'Lambda Fn');
    const line = getMermaidLine(result, 'Lambda Fn');
    expect(line).toBeTruthy();
    expect(line).toMatch(/\["Lambda Fn"\]/);
  });

  it('worker node uses rectangle shape [label]', () => {
    const result = generateSingleNode('compute/worker', 'Background Worker');
    const line = getMermaidLine(result, 'Background Worker');
    expect(line).toBeTruthy();
    expect(line).toMatch(/\["Background Worker"\]/);
  });

  // Step 4: Verify database uses cylinder shape [(label)]
  it('database node uses cylinder shape [(label)]', () => {
    const result = generateSingleNode('data/database', 'Users DB');
    const line = getMermaidLine(result, 'Users DB');
    expect(line).toBeTruthy();
    expect(line).toContain('[(');
    expect(line).toContain(')]');
  });

  it('cache node uses cylinder shape [(label)]', () => {
    const result = generateSingleNode('data/cache', 'Redis Cache');
    const line = getMermaidLine(result, 'Redis Cache');
    expect(line).toBeTruthy();
    expect(line).toContain('[(');
    expect(line).toContain(')]');
  });

  // Queue uses stadium/rounded shape ([label])
  it('message-queue node uses stadium shape ([label])', () => {
    const result = generateSingleNode('messaging/message-queue', 'Task Queue');
    const line = getMermaidLine(result, 'Task Queue');
    expect(line).toBeTruthy();
    expect(line).toContain('([');
    expect(line).toContain('])');
  });

  it('event-bus node uses stadium shape ([label])', () => {
    const result = generateSingleNode('messaging/event-bus', 'Domain Events');
    const line = getMermaidLine(result, 'Domain Events');
    expect(line).toBeTruthy();
    expect(line).toContain('([');
    expect(line).toContain('])');
  });

  // Gateway uses hexagon shape {{label}}
  it('api-gateway node uses hexagon shape {{label}}', () => {
    const result = generateSingleNode('compute/api-gateway', 'API Gateway');
    const line = getMermaidLine(result, 'API Gateway');
    expect(line).toBeTruthy();
    expect(line).toContain('{{');
    expect(line).toContain('}}');
  });

  it('load-balancer node uses hexagon shape {{label}}', () => {
    const result = generateSingleNode('network/load-balancer', 'Load Balancer');
    const line = getMermaidLine(result, 'Load Balancer');
    expect(line).toBeTruthy();
    expect(line).toContain('{{');
    expect(line).toContain('}}');
  });

  // Observability uses rounded rectangle (label)
  it('logging node uses rounded rectangle shape (label)', () => {
    const result = generateSingleNode('observability/logging', 'ELK Stack');
    const line = getMermaidLine(result, 'ELK Stack');
    expect(line).toBeTruthy();
    expect(line).toContain('("ELK Stack")');
  });

  it('monitoring node uses rounded rectangle shape (label)', () => {
    const result = generateSingleNode('observability/monitoring', 'Prometheus');
    const line = getMermaidLine(result, 'Prometheus');
    expect(line).toBeTruthy();
    expect(line).toContain('("Prometheus")');
  });

  // Step 5: Verify shapes differ by node type
  it('different node types produce different shapes in same diagram', () => {
    const serviceNode = makeNode({ type: 'compute/service', displayName: 'My Service' });
    const dbNode = makeNode({ type: 'data/database', displayName: 'My Database' });
    const queueNode = makeNode({ type: 'messaging/message-queue', displayName: 'My Queue' });
    const gatewayNode = makeNode({ type: 'compute/api-gateway', displayName: 'My Gateway' });

    const graph: ArchGraph = {
      name: 'Multi-shape',
      description: '',
      owners: [],
      nodes: [serviceNode, dbNode, queueNode, gatewayNode],
      edges: [],
    };
    const result = exportApi.generateMermaid(graph);

    const serviceLine = getMermaidLine(result, 'My Service')!;
    const dbLine = getMermaidLine(result, 'My Database')!;
    const queueLine = getMermaidLine(result, 'My Queue')!;
    const gatewayLine = getMermaidLine(result, 'My Gateway')!;

    // Service uses [label] - rectangle
    expect(serviceLine).toMatch(/\["My Service"\]/);
    // Database uses [(label)] - cylinder
    expect(dbLine).toContain('[("My Database")]');
    // Queue uses ([label]) - stadium
    expect(queueLine).toContain('(["My Queue"])');
    // Gateway uses {{label}} - hexagon
    expect(gatewayLine).toContain('{{"My Gateway"}}');
  });

  it('all 4 shape types are visually distinguishable', () => {
    const serviceNode = makeNode({ type: 'compute/service', displayName: 'SVC' });
    const dbNode = makeNode({ type: 'data/database', displayName: 'DB' });
    const queueNode = makeNode({ type: 'messaging/message-queue', displayName: 'Q' });
    const gatewayNode = makeNode({ type: 'compute/api-gateway', displayName: 'GW' });

    const graph: ArchGraph = {
      name: 'Shapes',
      description: '',
      owners: [],
      nodes: [serviceNode, dbNode, queueNode, gatewayNode],
      edges: [],
    };
    const result = exportApi.generateMermaid(graph);

    // Extract the shape delimiters for each node
    const lines = result.split('\n').filter((l) => l.trim() && !l.startsWith('graph'));

    // Each line uses different opening/closing shapes
    const shapes = lines.map((l) => {
      const idEnd =
        l.trimStart().indexOf(']') > -1 ||
        l.trimStart().indexOf('(') > -1 ||
        l.trimStart().indexOf('{') > -1;
      return l.trim();
    });

    // We just verify they're all different by checking unique shape patterns
    const serviceShape = getMermaidLine(result, 'SVC')!;
    const dbShape = getMermaidLine(result, 'DB')!;
    const queueShape = getMermaidLine(result, 'Q')!;
    const gwShape = getMermaidLine(result, 'GW')!;

    // Collect the shape syntax (everything after the ID, before/after the label)
    const getShapeSyntax = (line: string, label: string) => {
      const idx = line.indexOf(`"${label}"`);
      const before = line.substring(idx - 2, idx);
      const after = line.substring(idx + label.length + 2, idx + label.length + 4);
      return before + after;
    };

    const svcSyntax = getShapeSyntax(serviceShape, 'SVC');
    const dbSyntax = getShapeSyntax(dbShape, 'DB');
    const qSyntax = getShapeSyntax(queueShape, 'Q');
    const gwSyntax = getShapeSyntax(gwShape, 'GW');

    // All 4 shapes should be distinct
    const uniqueShapes = new Set([svcSyntax, dbSyntax, qSyntax, gwSyntax]);
    expect(uniqueShapes.size).toBe(4);
  });

  // Default/unknown types fallback to rectangle
  it('unknown node type falls back to rectangle shape', () => {
    const result = generateSingleNode('custom/unknown-thing', 'Custom Node');
    const line = getMermaidLine(result, 'Custom Node');
    expect(line).toBeTruthy();
    expect(line).toMatch(/\["Custom Node"\]/);
  });
});

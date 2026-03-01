/**
 * Unit tests for Feature #54: AI formatter produces valid XML output.
 *
 * Verifies that describe({format:'ai'}) produces well-formed XML
 * optimized for LLM token efficiency with proper elements and attributes.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode, ArchEdge, Note } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: generateId(),
    author: overrides.author ?? 'user',
    timestampMs: overrides.timestampMs ?? Date.now(),
    content: overrides.content ?? 'A note',
    tags: overrides.tags ?? [],
    status: overrides.status ?? 'none',
    suggestionType: overrides.suggestionType,
  };
}

function makeNode(overrides: Partial<ArchNode> & { type: string; displayName: string }): ArchNode {
  return {
    id: generateId(),
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
    id: generateId(),
    fromNode: overrides.fromNode,
    toNode: overrides.toNode,
    type: overrides.type ?? 'sync',
    label: overrides.label,
    properties: overrides.properties ?? {},
    notes: overrides.notes ?? [],
  };
}

// ============================================================
// Feature #54: AI formatter produces valid XML output
// ============================================================
describe('Feature #54: AI formatter produces valid XML output', () => {
  let textApi: TextApi;
  let node1: ArchNode;
  let node2: ArchNode;
  let edge1: ArchEdge;
  let aiOutput: string;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();

    // Step 1: Create architecture with 2 nodes, 1 edge, and notes
    const note1 = makeNote({ content: 'Performance concern', author: 'alice' });
    const note2 = makeNote({ content: 'AI suggestion: add caching', author: 'ai', status: 'pending' });

    node1 = makeNode({
      type: 'compute/service',
      displayName: 'Auth Service',
      args: { port: 8080, protocol: 'gRPC' },
      notes: [note1],
    });
    node2 = makeNode({
      type: 'data/database',
      displayName: 'User DB',
      notes: [note2],
    });

    edge1 = makeEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'data-flow',
      label: 'User Queries',
    });

    const graph: ArchGraph = {
      name: 'Auth System',
      description: 'Authentication microservice architecture',
      owners: ['security-team'],
      nodes: [node1, node2],
      edges: [edge1],
    };

    textApi = new TextApi(graph, registry);

    // Step 2: Call describe with format='ai'
    aiOutput = textApi.describe({ format: 'ai' });
  });

  // Step 3: Verify output is valid XML (well-formed)
  it('should produce non-empty output', () => {
    expect(aiOutput).toBeTruthy();
    expect(aiOutput.length).toBeGreaterThan(0);
  });

  it('should have matching opening and closing tags (well-formed XML)', () => {
    // Check that <architecture> has a closing </architecture>
    expect(aiOutput).toContain('<architecture');
    expect(aiOutput).toContain('</architecture>');

    // Every <node ...> should have </node>
    const nodeOpenCount = (aiOutput.match(/<node /g) || []).length;
    const nodeCloseCount = (aiOutput.match(/<\/node>/g) || []).length;
    expect(nodeOpenCount).toBe(nodeCloseCount);
  });

  it('should not contain unclosed or malformed tags', () => {
    // Self-closing tags should be proper: end with " />"
    const selfClosingTags = aiOutput.match(/<[^/][^>]*\/>/g) || [];
    for (const tag of selfClosingTags) {
      expect(tag).toMatch(/\/>$/);
    }
  });

  // Step 4: Verify output contains <architecture> root element
  it('should start with <architecture> root element', () => {
    const trimmed = aiOutput.trim();
    expect(trimmed.startsWith('<architecture')).toBe(true);
  });

  it('should end with </architecture>', () => {
    const trimmed = aiOutput.trim();
    expect(trimmed.endsWith('</architecture>')).toBe(true);
  });

  it('should have architecture name attribute', () => {
    expect(aiOutput).toContain('name="Auth System"');
  });

  it('should include summary element with node and edge counts', () => {
    expect(aiOutput).toContain('<summary');
    expect(aiOutput).toContain('nodes="2"');
    expect(aiOutput).toContain('edges="1"');
  });

  // Step 5: Verify output contains <node> elements with attributes
  it('should contain <node> elements for each node', () => {
    const nodeOpenCount = (aiOutput.match(/<node /g) || []).length;
    expect(nodeOpenCount).toBe(2);
  });

  it('should have node elements with id attribute', () => {
    expect(aiOutput).toContain(`id="${node1.id}"`);
    expect(aiOutput).toContain(`id="${node2.id}"`);
  });

  it('should have node elements with type attribute', () => {
    expect(aiOutput).toContain('type="compute/service"');
    expect(aiOutput).toContain('type="data/database"');
  });

  it('should have node elements with name attribute', () => {
    expect(aiOutput).toContain('name="Auth Service"');
    expect(aiOutput).toContain('name="User DB"');
  });

  it('should include args for nodes that have them', () => {
    expect(aiOutput).toContain('<args>');
    expect(aiOutput).toContain('port');
    expect(aiOutput).toContain('8080');
    expect(aiOutput).toContain('gRPC');
  });

  it('should include notes count for nodes that have notes', () => {
    // Both nodes have 1 note
    expect(aiOutput).toContain('<notes count="1"');
  });

  // Step 6: Verify output contains <edge> elements
  it('should contain <edge> element', () => {
    expect(aiOutput).toContain('<edge');
  });

  it('should have edge with from and to attributes', () => {
    expect(aiOutput).toContain(`from="${node1.id}"`);
    expect(aiOutput).toContain(`to="${node2.id}"`);
  });

  it('should have edge with type attribute', () => {
    expect(aiOutput).toContain('type="data-flow"');
  });

  it('should have edge with label attribute', () => {
    expect(aiOutput).toContain('label="User Queries"');
  });

  // Additional: edge without label should not include label attribute
  it('should omit label attribute when edge has no label', () => {
    const registry = new RegistryManager();
    registry.initialize();

    const n1 = makeNode({ type: 'compute/service', displayName: 'S1' });
    const n2 = makeNode({ type: 'compute/service', displayName: 'S2' });
    const e = makeEdge({ fromNode: n1.id, toNode: n2.id, type: 'async' });

    const graph: ArchGraph = {
      name: 'No Label Test',
      description: '',
      owners: [],
      nodes: [n1, n2],
      edges: [e],
    };

    const api = new TextApi(graph, registry);
    const output = api.describe({ format: 'ai' });

    // The edge line should have type="async" but no label attribute
    const edgeLine = output.split('\n').find((l) => l.includes('<edge'));
    expect(edgeLine).toBeDefined();
    expect(edgeLine).toContain('type="async"');
    expect(edgeLine).not.toContain('label=');
  });

  // Empty graph produces valid minimal XML
  it('should produce valid XML for empty graph', () => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Empty',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };

    const api = new TextApi(graph, registry);
    const output = api.describe({ format: 'ai' });

    expect(output).toContain('<architecture name="Empty">');
    expect(output).toContain('</architecture>');
    expect(output).toContain('nodes="0"');
    expect(output).toContain('edges="0"');
  });
});

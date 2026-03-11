/**
 * Unit tests for Feature #57: AI formatter includes all node details in output.
 *
 * Verifies that describe({format:'ai'}) includes args, properties, code refs,
 * and note content for each node in the XML output.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode, ArchEdge, Note, CodeRef } from '@/types/graph';
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

function makeCodeRef(overrides: Partial<CodeRef> = {}): CodeRef {
  return {
    path: overrides.path ?? 'src/main.ts',
    role: overrides.role ?? 'source',
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
// Feature #57: AI formatter includes all node details in output
// ============================================================
describe('Feature #57: AI formatter includes all node details in output', () => {
  let textApi: TextApi;
  let aiOutput: string;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();

    // Step 1: Create node with args, properties, code ref, and note
    const note1 = makeNote({
      content: 'This service handles user authentication',
      author: 'alice',
      status: 'accepted',
    });
    const note2 = makeNote({
      content: 'Consider adding rate limiting',
      author: 'bob',
      status: 'pending',
    });
    const codeRef1 = makeCodeRef({ path: 'src/auth/service.ts', role: 'source' });
    const codeRef2 = makeCodeRef({ path: 'api/auth.yaml', role: 'api-spec' });

    const node1 = makeNode({
      type: 'compute/service',
      displayName: 'Auth Service',
      args: { port: 8080, protocol: 'gRPC' },
      properties: { version: '2.1.0', region: 'us-east-1', replicas: 3 },
      codeRefs: [codeRef1, codeRef2],
      notes: [note1, note2],
    });

    const node2 = makeNode({
      type: 'data/database',
      displayName: 'User DB',
      args: { engine: 'postgres' },
      properties: { tier: 'production' },
      codeRefs: [makeCodeRef({ path: 'schema/users.sql', role: 'schema' })],
      notes: [makeNote({ content: 'Needs index on email column', author: 'dba' })],
    });

    const edge1 = makeEdge({
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

    // Step 2: Generate AI format output
    aiOutput = textApi.describe({ format: 'ai' });
  });

  // Step 3: Verify node args appear in output
  it('should include args JSON for nodes with args', () => {
    expect(aiOutput).toContain('<args>');
    expect(aiOutput).toContain('port');
    expect(aiOutput).toContain('8080');
    expect(aiOutput).toContain('gRPC');
  });

  it('should include database node args', () => {
    expect(aiOutput).toContain('engine');
    expect(aiOutput).toContain('postgres');
  });

  // Step 4: Verify properties appear in output
  it('should include properties JSON for nodes with properties', () => {
    expect(aiOutput).toContain('<properties>');
    expect(aiOutput).toContain('</properties>');
  });

  it('should contain version property value', () => {
    expect(aiOutput).toContain('version');
    expect(aiOutput).toContain('2.1.0');
  });

  it('should contain region property value', () => {
    expect(aiOutput).toContain('region');
    expect(aiOutput).toContain('us-east-1');
  });

  it('should contain replicas property value', () => {
    expect(aiOutput).toContain('replicas');
    expect(aiOutput).toContain('3');
  });

  it('should contain production tier property', () => {
    expect(aiOutput).toContain('tier');
    expect(aiOutput).toContain('production');
  });

  // Step 5: Verify code ref appears in output
  it('should include coderefs section for nodes with code refs', () => {
    expect(aiOutput).toContain('<coderefs>');
    expect(aiOutput).toContain('</coderefs>');
  });

  it('should include auth service source code ref path', () => {
    expect(aiOutput).toContain('path="src/auth/service.ts"');
  });

  it('should include auth service source code ref role', () => {
    expect(aiOutput).toContain('role="source"');
  });

  it('should include api-spec code ref', () => {
    expect(aiOutput).toContain('path="api/auth.yaml"');
    expect(aiOutput).toContain('role="api-spec"');
  });

  it('should include schema code ref for database node', () => {
    expect(aiOutput).toContain('path="schema/users.sql"');
    expect(aiOutput).toContain('role="schema"');
  });

  it('should format code refs as self-closing <ref> elements', () => {
    const refElements = aiOutput.match(/<ref path="[^"]*" role="[^"]*" \/>/g) || [];
    expect(refElements.length).toBe(3); // 2 for Auth Service + 1 for User DB
  });

  // Step 6: Verify note content appears in output
  it('should include notes section with count', () => {
    expect(aiOutput).toContain('<notes count="2">');
    expect(aiOutput).toContain('<notes count="1">');
  });

  it('should include actual note content (not just count)', () => {
    expect(aiOutput).toContain('This service handles user authentication');
    expect(aiOutput).toContain('Consider adding rate limiting');
    expect(aiOutput).toContain('Needs index on email column');
  });

  it('should include note author attribute', () => {
    expect(aiOutput).toContain('author="alice"');
    expect(aiOutput).toContain('author="bob"');
    expect(aiOutput).toContain('author="dba"');
  });

  it('should include note status attribute', () => {
    expect(aiOutput).toContain('status="accepted"');
    expect(aiOutput).toContain('status="pending"');
    expect(aiOutput).toContain('status="none"');
  });

  it('should format notes as <note> elements with content', () => {
    const noteElements = aiOutput.match(/<note author="[^"]*" status="[^"]*">[^<]+<\/note>/g) || [];
    expect(noteElements.length).toBe(3); // 2 notes on Auth Service + 1 on User DB
  });

  // Additional: node with no properties/coderefs/notes should omit those sections
  it('should omit properties section for nodes without properties', () => {
    const registry = new RegistryManager();
    registry.initialize();

    const node = makeNode({
      type: 'compute/service',
      displayName: 'Simple Service',
      args: {},
      properties: {},
      codeRefs: [],
      notes: [],
    });

    const graph: ArchGraph = {
      name: 'Minimal',
      description: '',
      owners: [],
      nodes: [node],
      edges: [],
    };

    const api = new TextApi(graph, registry);
    const output = api.describe({ format: 'ai' });

    expect(output).not.toContain('<properties>');
    expect(output).not.toContain('<coderefs>');
    expect(output).not.toContain('<notes');
  });

  // Verify well-formedness with all sections
  it('should produce well-formed XML with all sections present', () => {
    expect(aiOutput).toContain('<architecture');
    expect(aiOutput).toContain('</architecture>');

    // Every <node> has a closing </node>
    const nodeOpenCount = (aiOutput.match(/<node /g) || []).length;
    const nodeCloseCount = (aiOutput.match(/<\/node>/g) || []).length;
    expect(nodeOpenCount).toBe(nodeCloseCount);

    // Every <coderefs> has a closing </coderefs>
    const coderefsOpenCount = (aiOutput.match(/<coderefs>/g) || []).length;
    const coderefsCloseCount = (aiOutput.match(/<\/coderefs>/g) || []).length;
    expect(coderefsOpenCount).toBe(coderefsCloseCount);

    // Every <notes count=...> has a closing </notes>
    const notesOpenCount = (aiOutput.match(/<notes count=/g) || []).length;
    const notesCloseCount = (aiOutput.match(/<\/notes>/g) || []).length;
    expect(notesOpenCount).toBe(notesCloseCount);
  });
});

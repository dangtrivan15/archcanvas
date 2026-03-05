/**
 * Feature #41: Text API getNode() returns detailed node information.
 * Verifies that TextAPI.getNode() returns full NodeDetail including
 * args, properties, connections, and notes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode, ArchEdge, Note, CodeRef } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

function makeNote(overrides: Partial<Note> & { author: string; content: string }): Note {
  return {
    id: overrides.id ?? generateId(),
    author: overrides.author,
    timestampMs: overrides.timestampMs ?? Date.now(),
    content: overrides.content,
    tags: overrides.tags ?? [],
    status: overrides.status ?? 'none',
    suggestionType: overrides.suggestionType,
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

describe('TextApi.getNode() - Feature #41', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  describe('full NodeDetail with all fields populated', () => {
    it('should return complete node detail with args, properties, notes, codeRefs, and edges', () => {
      // Step 1: Create node with args, properties, 2 notes, 1 code ref, and 2 connected edges
      const note1 = makeNote({ author: 'human', content: 'This service handles auth' });
      const note2 = makeNote({
        author: 'ai',
        content: 'Consider adding rate limiting',
        status: 'pending',
      });

      const codeRef: CodeRef = { path: 'src/services/auth.ts', role: 'source' };

      const targetNode = makeNode({
        type: 'compute/service',
        displayName: 'Auth Service',
        args: { runtime: 'node', port: 3000, secure: true },
        properties: { team: 'platform', priority: 'high' },
        notes: [note1, note2],
        codeRefs: [codeRef],
      });

      const otherNode1 = makeNode({ type: 'data/database', displayName: 'User DB' });
      const otherNode2 = makeNode({ type: 'compute/api-gateway', displayName: 'API Gateway' });

      const inboundEdge = makeEdge({
        fromNode: otherNode2.id,
        toNode: targetNode.id,
        type: 'sync',
        label: 'REST calls',
      });

      const outboundEdge = makeEdge({
        fromNode: targetNode.id,
        toNode: otherNode1.id,
        type: 'async',
        label: 'DB queries',
      });

      const graph: ArchGraph = {
        name: 'Test Architecture',
        description: 'Test',
        owners: [],
        nodes: [targetNode, otherNode1, otherNode2],
        edges: [inboundEdge, outboundEdge],
      };

      const textApi = new TextApi(graph, registry);

      // Step 2: Call textApi.getNode(nodeId)
      const detail = textApi.getNode(targetNode.id);

      expect(detail).toBeDefined();

      // Step 3: Verify response includes all args
      expect(detail!.args).toEqual({ runtime: 'node', port: 3000, secure: true });

      // Step 4: Verify response includes all properties
      expect(detail!.properties).toEqual({ team: 'platform', priority: 'high' });

      // Step 5: Verify response includes 2 notes
      expect(detail!.notes.length).toBe(2);
      expect(detail!.notes[0].author).toBe('human');
      expect(detail!.notes[0].content).toBe('This service handles auth');
      expect(detail!.notes[1].author).toBe('ai');
      expect(detail!.notes[1].content).toBe('Consider adding rate limiting');
      expect(detail!.notes[1].status).toBe('pending');

      // Step 6: Verify response includes 1 code ref
      expect(detail!.codeRefs.length).toBe(1);
      expect(detail!.codeRefs[0].path).toBe('src/services/auth.ts');
      expect(detail!.codeRefs[0].role).toBe('source');

      // Step 7: Verify response includes inbound and outbound edge lists
      expect(detail!.inboundEdges.length).toBe(1);
      expect(detail!.inboundEdges[0].fromNode).toBe(otherNode2.id);
      expect(detail!.inboundEdges[0].toNode).toBe(targetNode.id);
      expect(detail!.inboundEdges[0].type).toBe('sync');
      expect(detail!.inboundEdges[0].label).toBe('REST calls');

      expect(detail!.outboundEdges.length).toBe(1);
      expect(detail!.outboundEdges[0].fromNode).toBe(targetNode.id);
      expect(detail!.outboundEdges[0].toNode).toBe(otherNode1.id);
      expect(detail!.outboundEdges[0].type).toBe('async');
      expect(detail!.outboundEdges[0].label).toBe('DB queries');
    });
  });

  describe('basic identity fields', () => {
    it('should return id, type, and displayName', () => {
      const node = makeNode({ type: 'data/database', displayName: 'My DB' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(node.id);
      expect(detail!.id).toBe(node.id);
      expect(detail!.type).toBe('data/database');
      expect(detail!.displayName).toBe('My DB');
    });

    it('should return undefined for non-existent node', () => {
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode('non-existent-id');
      expect(detail).toBeUndefined();
    });
  });

  describe('args verification', () => {
    it('should return all args with correct types', () => {
      const node = makeNode({
        type: 'compute/service',
        displayName: 'Svc',
        args: { runtime: 'python', replicas: 3, autoscale: false },
      });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(node.id);
      expect(detail!.args.runtime).toBe('python');
      expect(detail!.args.replicas).toBe(3);
      expect(detail!.args.autoscale).toBe(false);
    });

    it('should return empty args object when node has no args', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'Svc' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(node.id);
      expect(detail!.args).toEqual({});
    });
  });

  describe('properties verification', () => {
    it('should return all properties', () => {
      const node = makeNode({
        type: 'compute/service',
        displayName: 'Svc',
        properties: { environment: 'production', version: 2, deprecated: false },
      });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(node.id);
      expect(detail!.properties.environment).toBe('production');
      expect(detail!.properties.version).toBe(2);
      expect(detail!.properties.deprecated).toBe(false);
    });
  });

  describe('notes verification', () => {
    it('should return notes with id, author, content, timestampMs, and status', () => {
      const ts = Date.now();
      const note = makeNote({
        author: 'engineer',
        content: 'Needs refactoring',
        timestampMs: ts,
        status: 'none',
      });
      const node = makeNode({
        type: 'compute/service',
        displayName: 'Svc',
        notes: [note],
      });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(node.id);
      expect(detail!.notes.length).toBe(1);
      expect(detail!.notes[0].id).toBe(note.id);
      expect(detail!.notes[0].author).toBe('engineer');
      expect(detail!.notes[0].content).toBe('Needs refactoring');
      expect(detail!.notes[0].timestampMs).toBe(ts);
      expect(detail!.notes[0].status).toBe('none');
    });

    it('should return empty notes array when node has no notes', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'Svc' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(node.id);
      expect(detail!.notes).toEqual([]);
    });
  });

  describe('codeRefs verification', () => {
    it('should return all code refs with path and role', () => {
      const node = makeNode({
        type: 'compute/service',
        displayName: 'Svc',
        codeRefs: [
          { path: 'src/auth/handler.ts', role: 'source' },
          { path: 'proto/auth.proto', role: 'schema' },
          { path: 'deploy/auth.yaml', role: 'deployment' },
        ],
      });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(node.id);
      expect(detail!.codeRefs.length).toBe(3);
      expect(detail!.codeRefs[0]).toEqual({ path: 'src/auth/handler.ts', role: 'source' });
      expect(detail!.codeRefs[1]).toEqual({ path: 'proto/auth.proto', role: 'schema' });
      expect(detail!.codeRefs[2]).toEqual({ path: 'deploy/auth.yaml', role: 'deployment' });
    });

    it('should return empty codeRefs array when node has none', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'Svc' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(node.id);
      expect(detail!.codeRefs).toEqual([]);
    });
  });

  describe('edges verification', () => {
    it('should separate edges into inbound and outbound lists', () => {
      const nodeA = makeNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = makeNode({ type: 'compute/service', displayName: 'B' });
      const nodeC = makeNode({ type: 'data/database', displayName: 'C' });

      // A → B (inbound to B)
      const edge1 = makeEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
      // B → C (outbound from B)
      const edge2 = makeEdge({ fromNode: nodeB.id, toNode: nodeC.id, type: 'async' });

      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [nodeA, nodeB, nodeC],
        edges: [edge1, edge2],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(nodeB.id);
      expect(detail!.inboundEdges.length).toBe(1);
      expect(detail!.inboundEdges[0].fromNode).toBe(nodeA.id);
      expect(detail!.outboundEdges.length).toBe(1);
      expect(detail!.outboundEdges[0].toNode).toBe(nodeC.id);
    });

    it('should return empty edge lists when node has no connections', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'Isolated' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(node.id);
      expect(detail!.inboundEdges).toEqual([]);
      expect(detail!.outboundEdges).toEqual([]);
    });

    it('should handle node with multiple inbound and outbound edges', () => {
      const center = makeNode({ type: 'compute/service', displayName: 'Center' });
      const source1 = makeNode({ type: 'compute/service', displayName: 'Source1' });
      const source2 = makeNode({ type: 'compute/service', displayName: 'Source2' });
      const target1 = makeNode({ type: 'data/database', displayName: 'Target1' });
      const target2 = makeNode({ type: 'data/cache', displayName: 'Target2' });

      const edges = [
        makeEdge({ fromNode: source1.id, toNode: center.id, type: 'sync' }),
        makeEdge({ fromNode: source2.id, toNode: center.id, type: 'async' }),
        makeEdge({ fromNode: center.id, toNode: target1.id, type: 'data-flow' }),
        makeEdge({ fromNode: center.id, toNode: target2.id, type: 'sync' }),
      ];

      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [center, source1, source2, target1, target2],
        edges,
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(center.id);
      expect(detail!.inboundEdges.length).toBe(2);
      expect(detail!.outboundEdges.length).toBe(2);
    });
  });

  describe('children verification', () => {
    it('should return children as NodeSummary list', () => {
      const child1 = makeNode({ type: 'compute/function', displayName: 'Handler A' });
      const child2 = makeNode({ type: 'compute/function', displayName: 'Handler B' });
      const parent = makeNode({
        type: 'compute/service',
        displayName: 'Parent Service',
        children: [child1, child2],
      });

      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [parent],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const detail = textApi.getNode(parent.id);
      expect(detail!.children.length).toBe(2);
      expect(detail!.children[0].id).toBe(child1.id);
      expect(detail!.children[0].displayName).toBe('Handler A');
      expect(detail!.children[1].id).toBe(child2.id);
      expect(detail!.children[1].displayName).toBe('Handler B');
    });
  });
});

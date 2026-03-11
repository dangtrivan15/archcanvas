/**
 * Feature #167: AI context builder includes selected node details.
 * Verifies that when building AI context, the selected node's full details
 * (displayName, type, args, notes, codeRefs) are properly included.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode, ArchEdge, Note, CodeRef } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

// ── helpers ──────────────────────────────────────────────────────────

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

function makeGraph(
  nodes: ArchNode[],
  edges: ArchEdge[] = [],
  name: string = 'Test Architecture',
): ArchGraph {
  return {
    name,
    description: '',
    owners: [],
    nodes,
    edges,
  };
}

// ── tests ────────────────────────────────────────────────────────────

describe('AI context builder selected node details - Feature #167', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  describe('node with args, notes, and code refs', () => {
    let node: ArchNode;
    let api: TextApi;

    beforeAll(() => {
      const note1 = makeNote({
        author: 'human',
        content: 'Primary API service handling all inbound traffic',
      });
      const note2 = makeNote({
        author: 'ai',
        content: 'Consider adding rate limiting',
        status: 'pending',
        suggestionType: 'improvement',
      });
      const note3 = makeNote({
        author: 'human',
        content: 'Deployed on Kubernetes',
        tags: ['infra'],
      });

      node = makeNode({
        type: 'compute/service',
        displayName: 'API Service',
        args: {
          port: '8080',
          host: 'api.example.com',
          replicas: '3',
          timeout: '30s',
        },
        notes: [note1, note2, note3],
        codeRefs: [
          { path: 'src/api/server.ts', role: 'source' },
          { path: 'api/openapi.yaml', role: 'api_spec' },
          { path: 'k8s/deployment.yaml', role: 'deployment' },
        ],
      });

      const graph = makeGraph([node]);
      api = new TextApi(graph, registry);
    });

    // Step 3: Verify context has node displayName and type
    it('should have selectedNode with correct displayName', () => {
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode).toBeDefined();
      expect(ctx.selectedNode!.displayName).toBe('API Service');
    });

    it('should have selectedNode with correct type', () => {
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.type).toBe('compute/service');
    });

    it('should have selectedNode with correct id', () => {
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.id).toBe(node.id);
    });

    // Step 4: Verify context has node args
    it('should have selectedNode with all args as key-value pairs', () => {
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.args).toEqual({
        port: '8080',
        host: 'api.example.com',
        replicas: '3',
        timeout: '30s',
      });
    });

    it('should preserve individual arg values exactly', () => {
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.args.port).toBe('8080');
      expect(ctx.selectedNode!.args.host).toBe('api.example.com');
      expect(ctx.selectedNode!.args.replicas).toBe('3');
      expect(ctx.selectedNode!.args.timeout).toBe('30s');
    });

    // Step 5: Verify context has node notes
    it('should have selectedNode with all 3 notes', () => {
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.notes).toHaveLength(3);
    });

    it('should have notes with author and content fields', () => {
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.notes[0]).toEqual({
        author: 'human',
        content: 'Primary API service handling all inbound traffic',
      });
      expect(ctx.selectedNode!.notes[1]).toEqual({
        author: 'ai',
        content: 'Consider adding rate limiting',
      });
      expect(ctx.selectedNode!.notes[2]).toEqual({
        author: 'human',
        content: 'Deployed on Kubernetes',
      });
    });

    it('should strip extra note fields (tags, status) for AI context', () => {
      const ctx = api.getAIContext(node.id, 1);

      // AI context notes only have author + content, not tags/status/id/etc.
      const note = ctx.selectedNode!.notes[0];
      expect(Object.keys(note).sort()).toEqual(['author', 'content']);
    });

    // Step 6: Verify context has code refs
    it('should have selectedNode with all 3 code refs', () => {
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.codeRefs).toHaveLength(3);
    });

    it('should have code refs with path and role fields', () => {
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.codeRefs[0]).toEqual({ path: 'src/api/server.ts', role: 'source' });
      expect(ctx.selectedNode!.codeRefs[1]).toEqual({ path: 'api/openapi.yaml', role: 'api_spec' });
      expect(ctx.selectedNode!.codeRefs[2]).toEqual({
        path: 'k8s/deployment.yaml',
        role: 'deployment',
      });
    });
  });

  describe('node with empty args, notes, and codeRefs', () => {
    it('should handle node with no args', () => {
      const node = makeNode({ type: 'data/database', displayName: 'Empty DB', args: {} });
      const graph = makeGraph([node]);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.args).toEqual({});
    });

    it('should handle node with no notes', () => {
      const node = makeNode({ type: 'data/database', displayName: 'Silent DB', notes: [] });
      const graph = makeGraph([node]);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.notes).toEqual([]);
    });

    it('should handle node with no code refs', () => {
      const node = makeNode({ type: 'data/database', displayName: 'No Refs DB', codeRefs: [] });
      const graph = makeGraph([node]);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.codeRefs).toEqual([]);
    });
  });

  describe('different node types', () => {
    it('should correctly reflect database node type', () => {
      const node = makeNode({
        type: 'data/database',
        displayName: 'Analytics DB',
        args: { engine: 'clickhouse', shards: '4' },
      });
      const graph = makeGraph([node]);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.type).toBe('data/database');
      expect(ctx.selectedNode!.displayName).toBe('Analytics DB');
      expect(ctx.selectedNode!.args.engine).toBe('clickhouse');
    });

    it('should correctly reflect message queue node type', () => {
      const node = makeNode({
        type: 'messaging/message-queue',
        displayName: 'Event Queue',
        args: { broker: 'kafka', partitions: '12' },
        notes: [makeNote({ author: 'human', content: 'High throughput queue' })],
      });
      const graph = makeGraph([node]);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.type).toBe('messaging/message-queue');
      expect(ctx.selectedNode!.args.broker).toBe('kafka');
      expect(ctx.selectedNode!.notes).toHaveLength(1);
    });

    it('should correctly reflect cache node type with code refs', () => {
      const node = makeNode({
        type: 'data/cache',
        displayName: 'Session Store',
        args: { engine: 'redis', ttl: '3600' },
        codeRefs: [{ path: 'src/cache/redis.ts', role: 'source' }],
      });
      const graph = makeGraph([node]);
      const api = new TextApi(graph, registry);
      const ctx = api.getAIContext(node.id, 1);

      expect(ctx.selectedNode!.type).toBe('data/cache');
      expect(ctx.selectedNode!.codeRefs[0].path).toBe('src/cache/redis.ts');
    });
  });

  describe('args are a shallow copy (not a reference)', () => {
    it('should not be affected by mutations to original node args', () => {
      const node = makeNode({
        type: 'compute/service',
        displayName: 'Mutable Test',
        args: { key: 'original' },
      });
      const graph = makeGraph([node]);
      const api = new TextApi(graph, registry);

      const ctx = api.getAIContext(node.id, 1);
      expect(ctx.selectedNode!.args.key).toBe('original');

      // The args in selectedNode should be a copy, not a reference
      // Modifying the context should not affect the original
      ctx.selectedNode!.args.key = 'modified';
      const ctx2 = api.getAIContext(node.id, 1);
      expect(ctx2.selectedNode!.args.key).toBe('original');
    });
  });
});

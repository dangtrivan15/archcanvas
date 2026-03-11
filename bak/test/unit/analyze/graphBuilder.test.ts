/**
 * Feature #344: Inference Result to ArchCanvas Graph Builder
 *
 * Tests that buildGraph() correctly converts AI inference results into
 * ArchCanvas graph operations via the Text API.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';
import type { InferenceResult } from '@/analyze/inferEngine';
import { buildGraph, resolveNodeType, type BuildResult } from '@/analyze/graphBuilder';

describe('Feature #344: Inference Result to ArchCanvas Graph Builder', () => {
  let registry: RegistryManager;

  beforeEach(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  function createEmptyGraph(): ArchGraph {
    return {
      name: '',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
      annotations: [],
    };
  }

  function createBasicInferenceResult(): InferenceResult {
    return {
      architectureName: 'Test Architecture',
      architectureDescription: 'A test system with a service and database',
      nodes: [
        {
          id: 'api-service',
          type: 'service',
          displayName: 'API Service',
          description: 'The main REST API service',
          codeRefs: [
            { path: 'src/api/server.ts', role: 'SOURCE' },
            { path: 'src/api/openapi.yaml', role: 'API_SPEC' },
          ],
          children: [],
        },
        {
          id: 'users-db',
          type: 'database',
          displayName: 'Users Database',
          description: 'PostgreSQL database for user data',
          codeRefs: [{ path: 'src/db/schema.sql', role: 'SCHEMA' }],
          children: [],
        },
        {
          id: 'redis-cache',
          type: 'cache',
          displayName: 'Redis Cache',
          description: 'In-memory cache for session data',
          codeRefs: [],
          children: [],
        },
      ],
      edges: [
        {
          from: 'api-service',
          to: 'users-db',
          type: 'SYNC',
          label: 'queries user data',
        },
        {
          from: 'api-service',
          to: 'redis-cache',
          type: 'SYNC',
          label: 'caches sessions',
        },
      ],
    };
  }

  // ── resolveNodeType tests ──────────────────────────────────────────────────

  describe('resolveNodeType', () => {
    it('resolves exact namespace/name types', () => {
      const result = resolveNodeType('compute/service', registry);
      expect(result.resolvedType).toBe('compute/service');
      expect(result.warning).toBeUndefined();
    });

    it('resolves short names by searching namespaces', () => {
      const result = resolveNodeType('service', registry);
      expect(result.resolvedType).toBe('compute/service');
      expect(result.warning).toBeUndefined();
    });

    it('resolves database short name', () => {
      const result = resolveNodeType('database', registry);
      expect(result.resolvedType).toBe('data/database');
      expect(result.warning).toBeUndefined();
    });

    it('resolves cache short name', () => {
      const result = resolveNodeType('cache', registry);
      expect(result.resolvedType).toBe('data/cache');
      expect(result.warning).toBeUndefined();
    });

    it('uses fallback map for synonyms like "microservice"', () => {
      const result = resolveNodeType('microservice', registry);
      expect(result.resolvedType).toBe('compute/service');
    });

    it('uses fallback map for synonyms like "lambda"', () => {
      const result = resolveNodeType('lambda', registry);
      expect(result.resolvedType).toBe('compute/function');
    });

    it('uses fallback map for synonyms like "postgres"', () => {
      const result = resolveNodeType('postgres', registry);
      expect(result.resolvedType).toBe('data/database');
    });

    it('uses fallback map for synonyms like "redis"', () => {
      const result = resolveNodeType('redis', registry);
      expect(result.resolvedType).toBe('data/cache');
    });

    it('uses fallback map for synonyms like "kafka"', () => {
      const result = resolveNodeType('kafka', registry);
      expect(result.resolvedType).toBe('messaging/event-bus');
    });

    it('uses fallback map for synonyms like "elasticsearch"', () => {
      const result = resolveNodeType('elasticsearch', registry);
      expect(result.resolvedType).toBe('data/search-index');
    });

    it('defaults unknown types to compute/service with warning', () => {
      const result = resolveNodeType('totally-unknown-type', registry);
      expect(result.resolvedType).toBe('compute/service');
      expect(result.warning).toContain('totally-unknown-type');
      expect(result.warning).toContain('compute/service');
    });

    it('is case-insensitive', () => {
      const result = resolveNodeType('DATABASE', registry);
      expect(result.resolvedType).toBe('data/database');
    });
  });

  // ── buildGraph basic tests ─────────────────────────────────────────────────

  describe('buildGraph - basic', () => {
    it('creates nodes from inference result', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.nodesCreated).toBe(3);
      expect(result.nodeIdMap.size).toBe(3);

      // Verify nodes exist in the graph
      const nodes = textApi.listNodes();
      expect(nodes.length).toBe(3);

      const nodeNames = nodes.map((n) => n.displayName);
      expect(nodeNames).toContain('API Service');
      expect(nodeNames).toContain('Users Database');
      expect(nodeNames).toContain('Redis Cache');
    });

    it('maps node types to correct registry types', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      await buildGraph(inference, textApi, registry, { autoLayout: false });

      const nodes = textApi.listNodes();
      const typeMap = new Map(nodes.map((n) => [n.displayName, n.type]));

      expect(typeMap.get('API Service')).toBe('compute/service');
      expect(typeMap.get('Users Database')).toBe('data/database');
      expect(typeMap.get('Redis Cache')).toBe('data/cache');
    });

    it('creates edges between nodes', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.edgesCreated).toBe(2);

      const edges = textApi.getEdges();
      expect(edges.length).toBe(2);

      // Check edge labels
      const labels = edges.map((e) => e.label);
      expect(labels).toContain('queries user data');
      expect(labels).toContain('caches sessions');
    });

    it('maps edge types correctly (SYNC -> sync)', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference: InferenceResult = {
        architectureName: 'Test',
        architectureDescription: 'Test system',
        nodes: [
          {
            id: 'a',
            type: 'service',
            displayName: 'A',
            description: '',
            codeRefs: [],
            children: [],
          },
          {
            id: 'b',
            type: 'database',
            displayName: 'B',
            description: '',
            codeRefs: [],
            children: [],
          },
          { id: 'c', type: 'cache', displayName: 'C', description: '', codeRefs: [], children: [] },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'SYNC', label: 'sync edge' },
          { from: 'a', to: 'c', type: 'ASYNC', label: 'async edge' },
          { from: 'b', to: 'c', type: 'DATA_FLOW', label: 'data flow edge' },
        ],
      };

      await buildGraph(inference, textApi, registry, { autoLayout: false });

      const edges = textApi.getEdges();
      const edgeTypes = new Map(edges.map((e) => [e.label, e.type]));

      expect(edgeTypes.get('sync edge')).toBe('sync');
      expect(edgeTypes.get('async edge')).toBe('async');
      expect(edgeTypes.get('data flow edge')).toBe('data-flow');
    });

    it('attaches code references to nodes', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.codeRefsAttached).toBe(3); // 2 for api-service + 1 for users-db

      // Get the API service node
      const nodes = textApi.listNodes();
      const apiNode = nodes.find((n) => n.displayName === 'API Service');
      expect(apiNode).toBeDefined();

      const detail = textApi.getNode(apiNode!.id);
      expect(detail).toBeDefined();
      expect(detail!.codeRefs.length).toBe(2);
      expect(detail!.codeRefs[0].path).toBe('src/api/server.ts');
      expect(detail!.codeRefs[0].role).toBe('source');
      expect(detail!.codeRefs[1].path).toBe('src/api/openapi.yaml');
      expect(detail!.codeRefs[1].role).toBe('api-spec');
    });

    it('maps code ref roles correctly', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference: InferenceResult = {
        architectureName: 'Test',
        architectureDescription: 'Test',
        nodes: [
          {
            id: 'svc',
            type: 'service',
            displayName: 'Service',
            description: '',
            codeRefs: [
              { path: 'src/main.ts', role: 'SOURCE' },
              { path: 'api.yaml', role: 'API_SPEC' },
              { path: 'schema.prisma', role: 'SCHEMA' },
              { path: 'Dockerfile', role: 'DEPLOYMENT' },
              { path: '.env', role: 'CONFIG' },
              { path: 'test/main.test.ts', role: 'TEST' },
            ],
            children: [],
          },
        ],
        edges: [],
      };

      await buildGraph(inference, textApi, registry, { autoLayout: false });

      const nodes = textApi.listNodes();
      const detail = textApi.getNode(nodes[0].id);
      expect(detail!.codeRefs.length).toBe(6);

      const roles = detail!.codeRefs.map((cr) => cr.role);
      expect(roles).toEqual(['source', 'api-spec', 'schema', 'deployment', 'config', 'test']);
    });
  });

  // ── buildGraph notes ──────────────────────────────────────────────────────

  describe('buildGraph - notes', () => {
    it('adds description notes to nodes by default', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      await buildGraph(inference, textApi, registry, { autoLayout: false });

      const nodes = textApi.listNodes();
      const apiNode = nodes.find((n) => n.displayName === 'API Service');
      const detail = textApi.getNode(apiNode!.id);

      expect(detail!.notes.length).toBeGreaterThan(0);
      expect(detail!.notes[0].content).toBe('The main REST API service');
      expect(detail!.notes[0].author).toBe('ai-analyzer');
    });

    it('skips description notes when addDescriptionNotes is false', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      await buildGraph(inference, textApi, registry, {
        autoLayout: false,
        addDescriptionNotes: false,
      });

      const nodes = textApi.listNodes();
      for (const node of nodes) {
        const detail = textApi.getNode(node.id);
        expect(detail!.notes.length).toBe(0);
      }
    });

    it('uses custom noteAuthor', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      await buildGraph(inference, textApi, registry, {
        autoLayout: false,
        noteAuthor: 'custom-agent',
      });

      const nodes = textApi.listNodes();
      const apiNode = nodes.find((n) => n.displayName === 'API Service');
      const detail = textApi.getNode(apiNode!.id);
      expect(detail!.notes[0].author).toBe('custom-agent');
    });
  });

  // ── buildGraph hierarchy ──────────────────────────────────────────────────

  describe('buildGraph - hierarchy', () => {
    it('creates child nodes for hierarchical structures', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference: InferenceResult = {
        architectureName: 'Hierarchical System',
        architectureDescription: 'A system with nested components',
        nodes: [
          {
            id: 'backend',
            type: 'service',
            displayName: 'Backend',
            description: 'Backend service group',
            codeRefs: [],
            children: [
              {
                id: 'api-handler',
                type: 'function',
                displayName: 'API Handler',
                description: 'Handles API requests',
                codeRefs: [{ path: 'src/handler.ts', role: 'SOURCE' }],
                children: [],
              },
              {
                id: 'db-client',
                type: 'database',
                displayName: 'DB Client',
                description: 'Database client module',
                codeRefs: [],
                children: [],
              },
            ],
          },
        ],
        edges: [],
      };

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.nodesCreated).toBe(3); // parent + 2 children
      expect(result.codeRefsAttached).toBe(1);

      // Verify parent has children
      const nodes = textApi.listNodes();
      const backend = nodes.find((n) => n.displayName === 'Backend');
      expect(backend).toBeDefined();

      const detail = textApi.getNode(backend!.id);
      expect(detail!.children.length).toBe(2);

      const childNames = detail!.children.map((c) => c.displayName);
      expect(childNames).toContain('API Handler');
      expect(childNames).toContain('DB Client');
    });
  });

  // ── buildGraph edge warnings ───────────────────────────────────────────────

  describe('buildGraph - edge warnings', () => {
    it('warns when edge references non-existent source node', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference: InferenceResult = {
        architectureName: 'Test',
        architectureDescription: 'Test',
        nodes: [
          {
            id: 'a',
            type: 'service',
            displayName: 'A',
            description: '',
            codeRefs: [],
            children: [],
          },
        ],
        edges: [{ from: 'nonexistent', to: 'a', type: 'SYNC', label: 'bad edge' }],
      };

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.edgesCreated).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('nonexistent'))).toBe(true);
    });

    it('warns when edge references non-existent target node', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference: InferenceResult = {
        architectureName: 'Test',
        architectureDescription: 'Test',
        nodes: [
          {
            id: 'a',
            type: 'service',
            displayName: 'A',
            description: '',
            codeRefs: [],
            children: [],
          },
        ],
        edges: [{ from: 'a', to: 'nonexistent', type: 'SYNC', label: 'bad edge' }],
      };

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.edgesCreated).toBe(0);
      expect(result.warnings.some((w) => w.includes('nonexistent'))).toBe(true);
    });
  });

  // ── buildGraph architecture metadata ───────────────────────────────────────

  describe('buildGraph - architecture metadata', () => {
    it('sets architecture name and description', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      await buildGraph(inference, textApi, registry, { autoLayout: false });

      const graph = textApi.getGraph();
      expect(graph.name).toBe('Test Architecture');
      expect(graph.description).toBe('A test system with a service and database');
    });
  });

  // ── buildGraph auto-layout ─────────────────────────────────────────────────

  describe('buildGraph - auto-layout', () => {
    it('applies auto-layout by default', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      await buildGraph(inference, textApi, registry);

      // After layout, nodes should have non-zero positions (ELK assigns positions)
      const graph = textApi.getGraph();
      const positions = graph.nodes.map((n) => ({ x: n.position.x, y: n.position.y }));

      // At least some nodes should be at non-zero positions after layout
      const hasNonZero = positions.some((p) => p.x !== 0 || p.y !== 0);
      expect(hasNonZero).toBe(true);
    });

    it('skips auto-layout when autoLayout is false', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      await buildGraph(inference, textApi, registry, { autoLayout: false });

      // Without layout, positions should remain at default (0,0)
      const graph = textApi.getGraph();
      for (const node of graph.nodes) {
        expect(node.position.x).toBe(0);
        expect(node.position.y).toBe(0);
      }
    });
  });

  // ── buildGraph fallback type mapping ──────────────────────────────────────

  describe('buildGraph - fallback type mapping', () => {
    it('handles unknown types with warning and fallback', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference: InferenceResult = {
        architectureName: 'Test',
        architectureDescription: 'Test',
        nodes: [
          {
            id: 'custom',
            type: 'weird-custom-component',
            displayName: 'Custom Thing',
            description: 'Something unusual',
            codeRefs: [],
            children: [],
          },
        ],
        edges: [],
      };

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.nodesCreated).toBe(1);
      expect(result.warnings.some((w) => w.includes('weird-custom-component'))).toBe(true);

      // Should have fallen back to compute/service
      const nodes = textApi.listNodes();
      expect(nodes[0].type).toBe('compute/service');
    });

    it('maps synonym types without warnings', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference: InferenceResult = {
        architectureName: 'Test',
        architectureDescription: 'Test',
        nodes: [
          {
            id: 'a',
            type: 'microservice',
            displayName: 'A',
            description: '',
            codeRefs: [],
            children: [],
          },
          {
            id: 'b',
            type: 'lambda',
            displayName: 'B',
            description: '',
            codeRefs: [],
            children: [],
          },
          {
            id: 'c',
            type: 'postgres',
            displayName: 'C',
            description: '',
            codeRefs: [],
            children: [],
          },
        ],
        edges: [],
      };

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.nodesCreated).toBe(3);

      const nodes = textApi.listNodes();
      const typeMap = new Map(nodes.map((n) => [n.displayName, n.type]));
      expect(typeMap.get('A')).toBe('compute/service');
      expect(typeMap.get('B')).toBe('compute/function');
      expect(typeMap.get('C')).toBe('data/database');
    });
  });

  // ── buildGraph return value ────────────────────────────────────────────────

  describe('buildGraph - return value', () => {
    it('returns correct BuildResult with all counts', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference = createBasicInferenceResult();

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.nodesCreated).toBe(3);
      expect(result.edgesCreated).toBe(2);
      expect(result.codeRefsAttached).toBe(3);
      expect(result.nodeIdMap.size).toBe(3);
      expect(result.nodeIdMap.has('api-service')).toBe(true);
      expect(result.nodeIdMap.has('users-db')).toBe(true);
      expect(result.nodeIdMap.has('redis-cache')).toBe(true);
    });

    it('returns empty results for empty inference', async () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const inference: InferenceResult = {
        architectureName: 'Empty',
        architectureDescription: 'Nothing',
        nodes: [],
        edges: [],
      };

      const result = await buildGraph(inference, textApi, registry, { autoLayout: false });

      expect(result.nodesCreated).toBe(0);
      expect(result.edgesCreated).toBe(0);
      expect(result.codeRefsAttached).toBe(0);
      expect(result.warnings).toEqual([]);
    });
  });
});

/**
 * Tests for the file save pipeline.
 * Verifies: graphToProto → encode → decode → protoToGraph roundtrip,
 * saveArchcFile (binary write), and saveArchcFileAs (file picker + fallback).
 */

import { describe, it, expect } from 'vitest';
import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';
import { graphToProto, protoToGraph } from '@/core/storage/fileIO';
import { encode, decode, isArchcFile } from '@/core/storage/codec';

// ─── Test Data Factory ──────────────────────────────────────────

function createTestGraph(): ArchGraph {
  return {
    name: 'E-Commerce Platform',
    description: 'A sample e-commerce architecture',
    owners: ['alice', 'bob'],
    nodes: [
      {
        id: 'node-api-gw',
        type: 'compute/api-gateway',
        displayName: 'API Gateway',
        args: { port: 8080 },
        codeRefs: [{ path: 'src/gateway/index.ts', role: 'source' }],
        notes: [
          {
            id: 'note-1',
            author: 'alice',
            timestampMs: 1700000000000,
            content: 'Rate limiting needed',
            tags: ['security'],
            status: 'pending',
            suggestionType: undefined,
          },
        ],
        properties: { region: 'us-east-1', autoscale: true },
        position: { x: 100, y: 200, width: 240, height: 120, color: '#3b82f6' },
        children: [],
        refSource: undefined,
      },
      {
        id: 'node-order-svc',
        type: 'compute/service',
        displayName: 'Order Service',
        args: { language: 'TypeScript', framework: 'Express' },
        codeRefs: [
          { path: 'src/orders/index.ts', role: 'source' },
          { path: 'src/orders/api.yaml', role: 'api-spec' },
        ],
        notes: [],
        properties: {},
        position: { x: 400, y: 200, width: 240, height: 120 },
        children: [],
        refSource: undefined,
      },
      {
        id: 'node-orders-db',
        type: 'data/database',
        displayName: 'Orders Database',
        args: { engine: 'PostgreSQL', version: '16' },
        codeRefs: [{ path: 'db/schema.sql', role: 'schema' }],
        notes: [],
        properties: { replicas: 3 },
        position: { x: 400, y: 400, width: 240, height: 120 },
        children: [],
        refSource: undefined,
      },
    ],
    edges: [
      {
        id: 'edge-gw-to-orders',
        fromNode: 'node-api-gw',
        toNode: 'node-order-svc',
        fromPort: 'out',
        toPort: 'in',
        type: 'sync',
        label: 'REST API',
        properties: { protocol: 'HTTP/2' },
        notes: [],
      },
      {
        id: 'edge-orders-to-db',
        fromNode: 'node-order-svc',
        toNode: 'node-orders-db',
        type: 'sync',
        label: 'SQL',
        properties: {},
        notes: [
          {
            id: 'note-2',
            author: 'bob',
            timestampMs: 1700000001000,
            content: 'Connection pooling configured',
            tags: ['performance'],
            status: 'accepted',
          },
        ],
      },
    ],
  };
}

function createGraphWithNestedChildren(): ArchGraph {
  return {
    name: 'Nested Architecture',
    description: 'Architecture with nested child nodes',
    owners: ['charlie'],
    nodes: [
      {
        id: 'node-parent',
        type: 'compute/service',
        displayName: 'Parent Service',
        args: {},
        codeRefs: [],
        notes: [],
        properties: {},
        position: { x: 0, y: 0, width: 240, height: 120 },
        children: [
          {
            id: 'node-child-1',
            type: 'compute/function',
            displayName: 'Child Function',
            args: { runtime: 'nodejs20' },
            codeRefs: [],
            notes: [],
            properties: {},
            position: { x: 50, y: 50, width: 200, height: 100 },
            children: [
              {
                id: 'node-grandchild',
                type: 'compute/worker',
                displayName: 'Grandchild Worker',
                args: {},
                codeRefs: [],
                notes: [],
                properties: {},
                position: { x: 80, y: 80, width: 180, height: 80 },
                children: [],
              },
            ],
          },
        ],
      },
    ],
    edges: [],
  };
}

function createGraphWithAllEdgeTypes(): ArchGraph {
  return {
    name: 'All Edge Types',
    description: 'Tests all 3 edge types',
    owners: [],
    nodes: [
      {
        id: 'node-a',
        type: 'compute/service',
        displayName: 'Service A',
        args: {},
        codeRefs: [],
        notes: [],
        properties: {},
        position: { x: 0, y: 0, width: 240, height: 120 },
        children: [],
      },
      {
        id: 'node-b',
        type: 'compute/service',
        displayName: 'Service B',
        args: {},
        codeRefs: [],
        notes: [],
        properties: {},
        position: { x: 300, y: 0, width: 240, height: 120 },
        children: [],
      },
    ],
    edges: [
      {
        id: 'edge-sync',
        fromNode: 'node-a',
        toNode: 'node-b',
        type: 'sync',
        label: 'Sync Call',
        properties: {},
        notes: [],
      },
      {
        id: 'edge-async',
        fromNode: 'node-a',
        toNode: 'node-b',
        type: 'async',
        label: 'Async Event',
        properties: {},
        notes: [],
      },
      {
        id: 'edge-data',
        fromNode: 'node-b',
        toNode: 'node-a',
        type: 'data-flow',
        label: 'Data Stream',
        properties: {},
        notes: [],
      },
    ],
  };
}

function createGraphWithAllNoteStatuses(): ArchGraph {
  return {
    name: 'Note Statuses Test',
    description: '',
    owners: [],
    nodes: [
      {
        id: 'node-annotated',
        type: 'compute/service',
        displayName: 'Annotated Service',
        args: {},
        codeRefs: [],
        notes: [
          { id: 'n1', author: 'a', timestampMs: 1000, content: 'None status', tags: [], status: 'none' },
          { id: 'n2', author: 'b', timestampMs: 2000, content: 'Pending', tags: ['todo'], status: 'pending' },
          { id: 'n3', author: 'c', timestampMs: 3000, content: 'Accepted', tags: [], status: 'accepted' },
          { id: 'n4', author: 'd', timestampMs: 4000, content: 'Dismissed', tags: ['wontfix'], status: 'dismissed' },
        ],
        properties: {},
        position: { x: 0, y: 0, width: 240, height: 120 },
        children: [],
      },
    ],
    edges: [],
  };
}

function createGraphWithAllCodeRefRoles(): ArchGraph {
  return {
    name: 'CodeRef Roles Test',
    description: '',
    owners: [],
    nodes: [
      {
        id: 'node-refs',
        type: 'compute/service',
        displayName: 'Service with all ref types',
        args: {},
        codeRefs: [
          { path: 'src/main.ts', role: 'source' },
          { path: 'api/spec.yaml', role: 'api-spec' },
          { path: 'db/schema.sql', role: 'schema' },
          { path: 'deploy/k8s.yaml', role: 'deployment' },
          { path: '.env', role: 'config' },
          { path: 'test/main.test.ts', role: 'test' },
        ],
        notes: [],
        properties: {},
        position: { x: 0, y: 0, width: 240, height: 120 },
        children: [],
      },
    ],
    edges: [],
  };
}

// ─── Helper: Normalize graph for comparison ──────────────────────

/**
 * Normalize a graph for comparison by converting undefined values to match
 * what the roundtrip produces (e.g., undefined → '' for optional strings).
 */
function normalizeForComparison(graph: ArchGraph): ArchGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(normalizeNode),
    edges: graph.edges.map((edge) => ({
      ...edge,
      fromPort: edge.fromPort || undefined,
      toPort: edge.toPort || undefined,
      label: edge.label || undefined,
      notes: edge.notes.map(normalizeNote),
    })),
  };
}

function normalizeNode(node: ArchNode): ArchNode {
  return {
    ...node,
    refSource: node.refSource || undefined,
    notes: node.notes.map(normalizeNote),
    children: node.children.map(normalizeNode),
  };
}

function normalizeNote(note: any) {
  return {
    ...note,
    suggestionType: note.suggestionType || undefined,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('File Save Pipeline', () => {
  describe('graphToProto → protoToGraph roundtrip', () => {
    it('preserves a complex graph with nodes, edges, notes, codeRefs', () => {
      const original = createTestGraph();
      const proto = graphToProto(original);
      const restored = protoToGraph(proto);
      const normalized = normalizeForComparison(original);

      // Verify top-level fields
      expect(restored.name).toBe(normalized.name);
      expect(restored.description).toBe(normalized.description);
      expect(restored.owners).toEqual(normalized.owners);
      expect(restored.nodes.length).toBe(normalized.nodes.length);
      expect(restored.edges.length).toBe(normalized.edges.length);

      // Verify nodes
      for (let i = 0; i < normalized.nodes.length; i++) {
        const origNode = normalized.nodes[i];
        const restoredNode = restored.nodes[i];
        expect(restoredNode.id).toBe(origNode.id);
        expect(restoredNode.type).toBe(origNode.type);
        expect(restoredNode.displayName).toBe(origNode.displayName);
        expect(restoredNode.args).toEqual(origNode.args);
        expect(restoredNode.position).toEqual(origNode.position);
        expect(restoredNode.properties).toEqual(origNode.properties);
        expect(restoredNode.codeRefs.length).toBe(origNode.codeRefs.length);
        expect(restoredNode.notes.length).toBe(origNode.notes.length);
      }

      // Verify edges
      for (let i = 0; i < normalized.edges.length; i++) {
        const origEdge = normalized.edges[i];
        const restoredEdge = restored.edges[i];
        expect(restoredEdge.id).toBe(origEdge.id);
        expect(restoredEdge.fromNode).toBe(origEdge.fromNode);
        expect(restoredEdge.toNode).toBe(origEdge.toNode);
        expect(restoredEdge.type).toBe(origEdge.type);
        expect(restoredEdge.label).toBe(origEdge.label);
      }
    });

    it('preserves nested children (3-level hierarchy)', () => {
      const original = createGraphWithNestedChildren();
      const proto = graphToProto(original);
      const restored = protoToGraph(proto);

      expect(restored.nodes.length).toBe(1);
      const parent = restored.nodes[0];
      expect(parent.displayName).toBe('Parent Service');
      expect(parent.children.length).toBe(1);

      const child = parent.children[0];
      expect(child.displayName).toBe('Child Function');
      expect(child.args).toEqual({ runtime: 'nodejs20' });
      expect(child.children.length).toBe(1);

      const grandchild = child.children[0];
      expect(grandchild.displayName).toBe('Grandchild Worker');
      expect(grandchild.position).toEqual({ x: 80, y: 80, width: 180, height: 80 });
    });

    it('preserves all 3 edge types (sync, async, data-flow)', () => {
      const original = createGraphWithAllEdgeTypes();
      const proto = graphToProto(original);
      const restored = protoToGraph(proto);

      expect(restored.edges.length).toBe(3);
      expect(restored.edges[0].type).toBe('sync');
      expect(restored.edges[1].type).toBe('async');
      expect(restored.edges[2].type).toBe('data-flow');
    });

    it('preserves all 4 note statuses (none, pending, accepted, dismissed)', () => {
      const original = createGraphWithAllNoteStatuses();
      const proto = graphToProto(original);
      const restored = protoToGraph(proto);

      const notes = restored.nodes[0].notes;
      expect(notes.length).toBe(4);
      expect(notes[0].status).toBe('none');
      expect(notes[1].status).toBe('pending');
      expect(notes[2].status).toBe('accepted');
      expect(notes[3].status).toBe('dismissed');
    });

    it('preserves all 6 code ref roles', () => {
      const original = createGraphWithAllCodeRefRoles();
      const proto = graphToProto(original);
      const restored = protoToGraph(proto);

      const refs = restored.nodes[0].codeRefs;
      expect(refs.length).toBe(6);
      expect(refs[0].role).toBe('source');
      expect(refs[1].role).toBe('api-spec');
      expect(refs[2].role).toBe('schema');
      expect(refs[3].role).toBe('deployment');
      expect(refs[4].role).toBe('config');
      expect(refs[5].role).toBe('test');
    });
  });

  describe('Full binary roundtrip: graphToProto → encode → decode → protoToGraph', () => {
    it('preserves a complex graph through full binary encoding/decoding', async () => {
      const original = createTestGraph();
      const normalized = normalizeForComparison(original);

      // Forward: graph → proto → binary
      const protoFile = graphToProto(original);
      const binaryData = await encode(protoFile);

      // Verify it's a valid .archc file
      expect(isArchcFile(binaryData)).toBe(true);

      // Reverse: binary → proto → graph
      const decoded = await decode(binaryData);
      const restored = protoToGraph(decoded);

      // Verify top-level fields
      expect(restored.name).toBe(normalized.name);
      expect(restored.description).toBe(normalized.description);
      expect(restored.owners).toEqual(normalized.owners);

      // Verify node count and edge count
      expect(restored.nodes.length).toBe(normalized.nodes.length);
      expect(restored.edges.length).toBe(normalized.edges.length);

      // Verify specific node data
      const apiGw = restored.nodes[0];
      expect(apiGw.id).toBe('node-api-gw');
      expect(apiGw.displayName).toBe('API Gateway');
      expect(apiGw.type).toBe('compute/api-gateway');
      expect(apiGw.args).toEqual({ port: 8080 });
      expect(apiGw.position.x).toBe(100);
      expect(apiGw.position.y).toBe(200);
      expect(apiGw.position.color).toBe('#3b82f6');
      expect(apiGw.properties).toEqual({ region: 'us-east-1', autoscale: true });
      expect(apiGw.codeRefs).toEqual([{ path: 'src/gateway/index.ts', role: 'source' }]);
      expect(apiGw.notes.length).toBe(1);
      expect(apiGw.notes[0].content).toBe('Rate limiting needed');
      expect(apiGw.notes[0].status).toBe('pending');
      expect(apiGw.notes[0].tags).toEqual(['security']);

      // Verify specific edge data
      const edge = restored.edges[0];
      expect(edge.id).toBe('edge-gw-to-orders');
      expect(edge.fromNode).toBe('node-api-gw');
      expect(edge.toNode).toBe('node-order-svc');
      expect(edge.type).toBe('sync');
      expect(edge.label).toBe('REST API');
    });

    it('produces a valid binary format', async () => {
      const graph = createTestGraph();
      const protoFile = graphToProto(graph);
      const binaryData = await encode(protoFile);

      // Check minimum size (6 magic + 2 version + 32 checksum + payload)
      expect(binaryData.length).toBeGreaterThan(40);

      // Check magic bytes "ARCHC\0"
      expect(String.fromCharCode(binaryData[0])).toBe('A');
      expect(String.fromCharCode(binaryData[1])).toBe('R');
      expect(String.fromCharCode(binaryData[2])).toBe('C');
      expect(String.fromCharCode(binaryData[3])).toBe('H');
      expect(String.fromCharCode(binaryData[4])).toBe('C');
      expect(binaryData[5]).toBe(0);
    });

    it('handles empty graph roundtrip', async () => {
      const emptyGraph: ArchGraph = {
        name: 'Empty',
        description: '',
        owners: [],
        nodes: [],
        edges: [],
      };

      const protoFile = graphToProto(emptyGraph);
      const binaryData = await encode(protoFile);
      const decoded = await decode(binaryData);
      const restored = protoToGraph(decoded);

      expect(restored.name).toBe('Empty');
      expect(restored.nodes.length).toBe(0);
      expect(restored.edges.length).toBe(0);
    });

    it('handles graph with nested children through binary roundtrip', async () => {
      const original = createGraphWithNestedChildren();

      const protoFile = graphToProto(original);
      const binaryData = await encode(protoFile);
      const decoded = await decode(binaryData);
      const restored = protoToGraph(decoded);

      expect(restored.nodes[0].children.length).toBe(1);
      expect(restored.nodes[0].children[0].children.length).toBe(1);
      expect(restored.nodes[0].children[0].children[0].displayName).toBe('Grandchild Worker');
    });

    it('preserves all edge types through binary roundtrip', async () => {
      const original = createGraphWithAllEdgeTypes();

      const protoFile = graphToProto(original);
      const binaryData = await encode(protoFile);
      const decoded = await decode(binaryData);
      const restored = protoToGraph(decoded);

      expect(restored.edges[0].type).toBe('sync');
      expect(restored.edges[1].type).toBe('async');
      expect(restored.edges[2].type).toBe('data-flow');
    });

    it('preserves all note statuses through binary roundtrip', async () => {
      const original = createGraphWithAllNoteStatuses();

      const protoFile = graphToProto(original);
      const binaryData = await encode(protoFile);
      const decoded = await decode(binaryData);
      const restored = protoToGraph(decoded);

      const notes = restored.nodes[0].notes;
      expect(notes[0].status).toBe('none');
      expect(notes[1].status).toBe('pending');
      expect(notes[2].status).toBe('accepted');
      expect(notes[3].status).toBe('dismissed');
    });

    it('preserves note tags through binary roundtrip', async () => {
      const original = createGraphWithAllNoteStatuses();

      const protoFile = graphToProto(original);
      const binaryData = await encode(protoFile);
      const decoded = await decode(binaryData);
      const restored = protoToGraph(decoded);

      const notes = restored.nodes[0].notes;
      expect(notes[1].tags).toEqual(['todo']);
      expect(notes[3].tags).toEqual(['wontfix']);
    });

    it('preserves value map types (string, number, boolean) through binary roundtrip', async () => {
      const original = createTestGraph();

      const protoFile = graphToProto(original);
      const binaryData = await encode(protoFile);
      const decoded = await decode(binaryData);
      const restored = protoToGraph(decoded);

      // node-api-gw has port: 8080 (number) and in properties: region (string), autoscale (bool)
      const apiGw = restored.nodes[0];
      expect(typeof apiGw.args['port']).toBe('number');
      expect(apiGw.args['port']).toBe(8080);
      expect(typeof apiGw.properties['region']).toBe('string');
      expect(apiGw.properties['region']).toBe('us-east-1');
      expect(typeof apiGw.properties['autoscale']).toBe('boolean');
      expect(apiGw.properties['autoscale']).toBe(true);
    });
  });

  describe('saveArchcFileAs (Save As) binary output', () => {
    it('graphToProto produces valid proto with suggested filename metadata', () => {
      const graph = createTestGraph();
      const protoFile = graphToProto(graph);

      // The proto file should have an architecture section
      expect(protoFile.architecture).toBeTruthy();
      expect(protoFile.architecture?.name).toBe('E-Commerce Platform');
      expect(protoFile.architecture?.nodes?.length).toBe(3);
      expect(protoFile.architecture?.edges?.length).toBe(2);
    });

    it('encode produces binary that can be loaded as a new file', async () => {
      const graph = createTestGraph();
      const protoFile = graphToProto(graph);
      const binaryData = await encode(protoFile);

      // Simulate what happens when a "saved-as" file is opened:
      // decode the binary → convert to graph → verify it matches
      const decoded = await decode(binaryData);
      const restored = protoToGraph(decoded);

      expect(restored.name).toBe(graph.name);
      expect(restored.description).toBe(graph.description);
      expect(restored.owners).toEqual(graph.owners);
      expect(restored.nodes.length).toBe(graph.nodes.length);
      expect(restored.edges.length).toBe(graph.edges.length);
    });

    it('Save As binary output differs from original file if graph was modified', async () => {
      const original = createTestGraph();
      const originalProto = graphToProto(original);
      const originalBinary = await encode(originalProto);

      // Modify the graph (add a node)
      const modified = {
        ...original,
        nodes: [
          ...original.nodes,
          {
            id: 'node-new',
            type: 'compute/function',
            displayName: 'New Function',
            args: {},
            codeRefs: [],
            notes: [],
            properties: {},
            position: { x: 500, y: 500, width: 240, height: 120 },
            children: [],
          },
        ],
      };

      const modifiedProto = graphToProto(modified);
      const modifiedBinary = await encode(modifiedProto);

      // Binary should be different (different content)
      expect(modifiedBinary.length).not.toBe(originalBinary.length);

      // But both should decode correctly
      const decodedModified = await decode(modifiedBinary);
      const restoredModified = protoToGraph(decodedModified);
      expect(restoredModified.nodes.length).toBe(4); // 3 original + 1 new
      expect(restoredModified.nodes[3].displayName).toBe('New Function');
    });

    it('suggested filename is used with .archc extension', () => {
      // Verify the filename logic used in saveArchcFileAs
      const suggestedName = 'my-architecture';
      const defaultName = (suggestedName ?? 'architecture') + '.archc';
      expect(defaultName).toBe('my-architecture.archc');

      // And the display name removes the extension
      const displayName = defaultName.replace(/\.archc$/, '');
      expect(displayName).toBe('my-architecture');
    });

    it('default filename is "architecture.archc" when no suggestion provided', () => {
      const suggestedName = undefined;
      const defaultName = (suggestedName ?? 'architecture') + '.archc';
      expect(defaultName).toBe('architecture.archc');
    });
  });

  describe('Save → Load file roundtrip using test .archc file', () => {
    it('loads the ecommerce.archc example file and roundtrips it', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(__dirname, '../../../examples/ecommerce/ecommerce.archc');
      const data = new Uint8Array(fs.readFileSync(filePath));

      // Decode the original file
      const decoded = await decode(data);
      const graph = protoToGraph(decoded);

      // Verify it has expected content
      expect(graph.name).toBeTruthy();
      expect(graph.nodes.length).toBeGreaterThan(0);

      // Re-encode and decode again
      const reEncoded = await encode(graphToProto(graph));
      const reDecoded = await decode(reEncoded);
      const reGraph = protoToGraph(reDecoded);

      // Verify roundtrip preserves data
      expect(reGraph.name).toBe(graph.name);
      expect(reGraph.nodes.length).toBe(graph.nodes.length);
      expect(reGraph.edges.length).toBe(graph.edges.length);

      // Verify each node
      for (let i = 0; i < graph.nodes.length; i++) {
        expect(reGraph.nodes[i].id).toBe(graph.nodes[i].id);
        expect(reGraph.nodes[i].displayName).toBe(graph.nodes[i].displayName);
        expect(reGraph.nodes[i].type).toBe(graph.nodes[i].type);
      }

      // Verify each edge
      for (let i = 0; i < graph.edges.length; i++) {
        expect(reGraph.edges[i].id).toBe(graph.edges[i].id);
        expect(reGraph.edges[i].fromNode).toBe(graph.edges[i].fromNode);
        expect(reGraph.edges[i].toNode).toBe(graph.edges[i].toNode);
        expect(reGraph.edges[i].type).toBe(graph.edges[i].type);
      }
    });
  });
});

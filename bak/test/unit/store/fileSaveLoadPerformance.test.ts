/**
 * Tests: File save/load under 2 seconds for medium architecture (Feature #233)
 *
 * Verifies that encoding (saving) and decoding (loading) .archc files
 * with 50 nodes and 40 edges completes within 2 seconds.
 * Tests both the codec layer and the full fileIO pipeline.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addEdge,
  addNoteToNode,
  createNote,
  addCodeRef,
} from '@/core/graph/graphEngine';
import { countAllNodes } from '@/core/graph/graphQuery';
import { encode, decode } from '@/core/storage/codec';
import { graphToProto, protoToGraphFull, decodeArchcData } from '@/core/storage/fileIO';
import type { ArchGraph } from '@/types/graph';

// Node types for variety
const NODE_TYPES = [
  'compute/service',
  'data/database',
  'data/cache',
  'messaging/event-bus',
  'messaging/message-queue',
  'compute/api-gateway',
  'network/load-balancer',
  'observability/logging',
  'observability/monitoring',
  'data/object-storage',
];

const NAMES = [
  'User',
  'Order',
  'Payment',
  'Auth',
  'Notification',
  'Inventory',
  'Shipping',
  'Search',
  'Analytics',
  'Report',
];

/**
 * Create a medium architecture with N nodes and approximately 80% N edges.
 */
function createMediumArchitecture(nodeCount: number, edgeCount: number): ArchGraph {
  let graph = createEmptyGraph('Medium Architecture');
  const nodeIds: string[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const type = NODE_TYPES[i % NODE_TYPES.length];
    const name = NAMES[i % NAMES.length];
    const node = createNode({
      type,
      displayName: `${name} ${type.split('/')[1]} ${i}`,
      position: { x: (i % 10) * 350, y: Math.floor(i / 10) * 180, width: 280, height: 80 },
      args: {
        environment: i % 2 === 0 ? 'production' : 'staging',
        version: `v${i}.0.0`,
        replicas: (i % 3) + 1,
      },
    });
    nodeIds.push(node.id);
    graph = addNode(graph, node);

    // Add notes to some nodes
    if (i % 5 === 0) {
      const note = createNote({
        author: 'architect',
        content: `Architecture review note for ${name} component. This node handles ${type} responsibilities.`,
        tags: ['review', type.split('/')[0]],
      });
      graph = addNoteToNode(graph, node.id, note);
    }

    // Add code refs to some nodes
    if (i % 7 === 0) {
      graph = addCodeRef(graph, node.id, {
        path: `/src/${type.split('/')[1]}/${name.toLowerCase()}.ts`,
        role: 'source',
      });
    }
  }

  // Add edges
  for (let i = 0; i < Math.min(edgeCount, nodeCount - 1); i++) {
    const fromIdx = i % nodeCount;
    const toIdx = (i + 1) % nodeCount;
    const edge = createEdge({
      fromNode: nodeIds[fromIdx],
      toNode: nodeIds[toIdx],
      type: i % 3 === 0 ? 'sync' : i % 3 === 1 ? 'async' : 'data-flow',
      label: `${NAMES[fromIdx % NAMES.length]}-to-${NAMES[toIdx % NAMES.length]}`,
    });
    graph = addEdge(graph, edge);
  }

  return graph;
}

describe('File save/load under 2 seconds for medium architecture', () => {
  let graph50: ArchGraph;

  beforeEach(() => {
    graph50 = createMediumArchitecture(50, 40);
  });

  // ========================================================
  // 1. Architecture setup verification
  // ========================================================

  describe('Medium architecture setup', () => {
    it('creates exactly 50 nodes', () => {
      expect(countAllNodes(graph50)).toBe(50);
    });

    it('creates 40 edges', () => {
      expect(graph50.edges).toHaveLength(40);
    });

    it('nodes have diverse types', () => {
      const types = new Set(graph50.nodes.map((n) => n.type));
      expect(types.size).toBe(NODE_TYPES.length);
    });

    it('some nodes have notes', () => {
      const withNotes = graph50.nodes.filter((n) => n.notes.length > 0);
      expect(withNotes.length).toBeGreaterThan(0);
    });

    it('some nodes have code refs', () => {
      const withRefs = graph50.nodes.filter((n) => n.codeRefs.length > 0);
      expect(withRefs.length).toBeGreaterThan(0);
    });

    it('all edges connect valid nodes', () => {
      const nodeIds = new Set(graph50.nodes.map((n) => n.id));
      for (const edge of graph50.edges) {
        expect(nodeIds.has(edge.fromNode)).toBe(true);
        expect(nodeIds.has(edge.toNode)).toBe(true);
      }
    });
  });

  // ========================================================
  // 2. Save (encode) performance
  // ========================================================

  describe('Save operation under 2 seconds', () => {
    it('encode 50-node graph completes under 2 seconds', async () => {
      const file = graphToProto(graph50);
      const start = performance.now();
      const binary = await encode(file);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(binary).toBeInstanceOf(Uint8Array);
      expect(binary.length).toBeGreaterThan(0);
    });

    it('encode produces valid binary format', async () => {
      const file = graphToProto(graph50);
      const binary = await encode(file);

      // Check magic bytes "ARCHC\0"
      const magic = String.fromCharCode(...binary.slice(0, 6));
      expect(magic).toBe('ARCHC\0');

      // Check format version (uint16 big-endian at offset 6)
      const version = (binary[6] << 8) | binary[7];
      expect(version).toBe(1);

      // Check SHA-256 checksum exists (32 bytes at offset 8)
      const checksum = binary.slice(8, 40);
      expect(checksum.length).toBe(32);
      // Checksum should not be all zeros
      expect(checksum.some((b) => b !== 0)).toBe(true);

      // Remaining bytes are protobuf payload
      expect(binary.length).toBeGreaterThan(40);
    });

    it('encode 50-node graph produces reasonable file size', async () => {
      const file = graphToProto(graph50);
      const binary = await encode(file);

      // 50 nodes with edges, notes, code refs should be > 1KB but < 50KB
      expect(binary.length).toBeGreaterThan(1024);
      expect(binary.length).toBeLessThan(50 * 1024);
    });

    it('graphToProto conversion is fast', () => {
      const start = performance.now();
      graphToProto(graph50);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it('encode 100-node graph still under 2 seconds', async () => {
      const graph100 = createMediumArchitecture(100, 80);
      const file = graphToProto(graph100);
      const start = performance.now();
      const binary = await encode(file);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(binary.length).toBeGreaterThan(0);
    });
  });

  // ========================================================
  // 3. Load (decode) performance
  // ========================================================

  describe('Load operation under 2 seconds', () => {
    let savedBinary: Uint8Array;

    beforeEach(async () => {
      const file = graphToProto(graph50);
      savedBinary = await encode(file);
    });

    it('decode 50-node graph completes under 2 seconds', async () => {
      const start = performance.now();
      const decoded = await decode(savedBinary);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(decoded).toBeDefined();
    });

    it('full load pipeline (decode + proto-to-graph) under 2 seconds', async () => {
      const start = performance.now();
      const { graph } = await decodeArchcData(savedBinary);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(countAllNodes(graph)).toBe(50);
    });

    it('decoded graph has correct node count', async () => {
      const { graph } = await decodeArchcData(savedBinary);
      expect(countAllNodes(graph)).toBe(50);
    });

    it('decoded graph has correct edge count', async () => {
      const { graph } = await decodeArchcData(savedBinary);
      expect(graph.edges).toHaveLength(40);
    });

    it('decoded graph preserves node display names', async () => {
      const { graph } = await decodeArchcData(savedBinary);
      const originalNames = graph50.nodes.map((n) => n.displayName).sort();
      const decodedNames = graph.nodes.map((n) => n.displayName).sort();
      expect(decodedNames).toEqual(originalNames);
    });

    it('decoded graph preserves node positions', async () => {
      const { graph } = await decodeArchcData(savedBinary);
      for (const original of graph50.nodes) {
        const decoded = graph.nodes.find((n) => n.displayName === original.displayName);
        expect(decoded).toBeDefined();
        expect(decoded!.position.x).toBe(original.position.x);
        expect(decoded!.position.y).toBe(original.position.y);
      }
    });

    it('decoded graph preserves node types', async () => {
      const { graph } = await decodeArchcData(savedBinary);
      const originalTypes = graph50.nodes.map((n) => n.type).sort();
      const decodedTypes = graph.nodes.map((n) => n.type).sort();
      expect(decodedTypes).toEqual(originalTypes);
    });

    it('decoded graph preserves edge connections', async () => {
      const { graph } = await decodeArchcData(savedBinary);
      expect(graph.edges.length).toBe(graph50.edges.length);
      for (const edge of graph.edges) {
        expect(edge.fromNode).toBeTruthy();
        expect(edge.toNode).toBeTruthy();
        expect(['sync', 'async', 'data-flow']).toContain(edge.type);
      }
    });

    it('decoded graph preserves notes', async () => {
      const { graph } = await decodeArchcData(savedBinary);
      const originalNoteCount = graph50.nodes.reduce((sum, n) => sum + n.notes.length, 0);
      const decodedNoteCount = graph.nodes.reduce((sum, n) => sum + n.notes.length, 0);
      expect(decodedNoteCount).toBe(originalNoteCount);
    });

    it('decoded graph preserves code refs', async () => {
      const { graph } = await decodeArchcData(savedBinary);
      const originalRefCount = graph50.nodes.reduce((sum, n) => sum + n.codeRefs.length, 0);
      const decodedRefCount = graph.nodes.reduce((sum, n) => sum + n.codeRefs.length, 0);
      expect(decodedRefCount).toBe(originalRefCount);
    });

    it('decoded graph preserves args', async () => {
      const { graph } = await decodeArchcData(savedBinary);
      // Find a node that should have args
      const nodeWithArgs = graph.nodes.find((n) => Object.keys(n.args).length > 0);
      expect(nodeWithArgs).toBeDefined();
      expect(nodeWithArgs!.args).toHaveProperty('environment');
    });
  });

  // ========================================================
  // 4. Round-trip integrity
  // ========================================================

  describe('Round-trip save to load integrity', () => {
    it('round-trip preserves all 50 nodes', async () => {
      const file = graphToProto(graph50);
      const binary = await encode(file);
      const { graph } = await decodeArchcData(binary);
      expect(countAllNodes(graph)).toBe(50);
    });

    it('round-trip preserves all 40 edges', async () => {
      const file = graphToProto(graph50);
      const binary = await encode(file);
      const { graph } = await decodeArchcData(binary);
      expect(graph.edges).toHaveLength(40);
    });

    it('round-trip preserves architecture name', async () => {
      const file = graphToProto(graph50);
      const binary = await encode(file);
      const { graph } = await decodeArchcData(binary);
      expect(graph.name).toBe('Medium Architecture');
    });

    it('complete round-trip under 2 seconds', async () => {
      const file = graphToProto(graph50);

      const start = performance.now();
      const binary = await encode(file);
      const { graph } = await decodeArchcData(binary);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(countAllNodes(graph)).toBe(50);
      expect(graph.edges).toHaveLength(40);
    });

    it('double round-trip preserves data', async () => {
      // Save -> Load -> Save -> Load
      const file1 = graphToProto(graph50);
      const binary1 = await encode(file1);
      const { graph: graph1 } = await decodeArchcData(binary1);

      const file2 = graphToProto(graph1);
      const binary2 = await encode(file2);
      const { graph: graph2 } = await decodeArchcData(binary2);

      expect(countAllNodes(graph2)).toBe(50);
      expect(graph2.edges).toHaveLength(40);
      expect(graph2.name).toBe('Medium Architecture');
    });
  });

  // ========================================================
  // 5. Scaling to larger files
  // ========================================================

  describe('Scaling to larger architectures', () => {
    it('100-node graph round-trip under 2 seconds', async () => {
      const graph100 = createMediumArchitecture(100, 80);
      const file = graphToProto(graph100);

      const start = performance.now();
      const binary = await encode(file);
      const { graph } = await decodeArchcData(binary);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(countAllNodes(graph)).toBe(100);
    });

    it('200-node graph round-trip under 2 seconds', async () => {
      const graph200 = createMediumArchitecture(200, 160);
      const file = graphToProto(graph200);

      const start = performance.now();
      const binary = await encode(file);
      const { graph } = await decodeArchcData(binary);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(countAllNodes(graph)).toBe(200);
    });
  });
});

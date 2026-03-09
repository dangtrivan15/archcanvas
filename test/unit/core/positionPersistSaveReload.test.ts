/**
 * Feature #512: Positions persist through save and reload cycle.
 *
 * Tests the complete roundtrip: graphToProto → encode → decode → protoToGraphFull
 * for both root-level and child-level node positions. Verifies that manually
 * arranged positions survive the full save/reload cycle through the .archc binary format.
 */

import { describe, it, expect } from 'vitest';
import type { ArchGraph, ArchNode } from '@/types/graph';
import { graphToProto, protoToGraphFull } from '@/core/storage/fileIO';
import { encode, decode } from '@/core/storage/codec';

// ─── Helpers ────────────────────────────────────────────────────

function makeNode(
  id: string,
  x: number,
  y: number,
  children: ArchNode[] = [],
  color?: string,
): ArchNode {
  return {
    id,
    type: 'compute/service',
    displayName: `Node ${id}`,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x, y, width: 240, height: 120, color },
    children,
  };
}

function makeGraph(nodes: ArchNode[]): ArchGraph {
  return {
    name: 'Position Persist Test',
    description: 'Tests position roundtrip',
    owners: ['tester'],
    nodes,
    edges: [],
  };
}

/** Full save/reload roundtrip: graph → proto → encode → decode → graph */
async function roundtrip(graph: ArchGraph): Promise<ArchGraph> {
  const protoFile = graphToProto(graph);
  const binary = await encode(protoFile);
  const decoded = await decode(binary);
  const result = protoToGraphFull(decoded);
  return result.graph;
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Feature #512: Positions persist through save and reload cycle', () => {
  describe('Step 1: Root-level nodes preserve positions after save/reload', () => {
    it('root node x/y positions survive a full roundtrip', async () => {
      const graph = makeGraph([
        makeNode('gw', 100, 50),
        makeNode('svc', 400, 200),
        makeNode('db', 700, 350),
      ]);

      const reloaded = await roundtrip(graph);

      expect(reloaded.nodes).toHaveLength(3);
      expect(reloaded.nodes[0]!.position.x).toBe(100);
      expect(reloaded.nodes[0]!.position.y).toBe(50);
      expect(reloaded.nodes[1]!.position.x).toBe(400);
      expect(reloaded.nodes[1]!.position.y).toBe(200);
      expect(reloaded.nodes[2]!.position.x).toBe(700);
      expect(reloaded.nodes[2]!.position.y).toBe(350);
    });

    it('root node width/height/color survive a full roundtrip', async () => {
      const graph = makeGraph([
        makeNode('styled', 150, 75, [], '#ff6600'),
      ]);

      const reloaded = await roundtrip(graph);

      const node = reloaded.nodes[0]!;
      expect(node.position.width).toBe(240);
      expect(node.position.height).toBe(120);
      expect(node.position.color).toBe('#ff6600');
    });

    it('fractional position values are preserved', async () => {
      const graph = makeGraph([
        makeNode('precise', 123.456, 789.012),
      ]);

      const reloaded = await roundtrip(graph);
      const node = reloaded.nodes[0]!;
      expect(node.position.x).toBeCloseTo(123.456, 2);
      expect(node.position.y).toBeCloseTo(789.012, 2);
    });

    it('negative position values are preserved', async () => {
      const graph = makeGraph([
        makeNode('neg', -200, -150),
      ]);

      const reloaded = await roundtrip(graph);
      const node = reloaded.nodes[0]!;
      expect(node.position.x).toBe(-200);
      expect(node.position.y).toBe(-150);
    });
  });

  describe('Step 2: Child-level (nested) nodes preserve positions after save/reload', () => {
    it('children positions survive a full roundtrip', async () => {
      const children: ArchNode[] = [
        makeNode('child-1', 10, 20),
        makeNode('child-2', 300, 20),
        makeNode('child-3', 150, 200),
      ];
      const graph = makeGraph([
        makeNode('parent', 50, 50, children),
      ]);

      const reloaded = await roundtrip(graph);

      const parent = reloaded.nodes[0]!;
      expect(parent.children).toHaveLength(3);
      expect(parent.children[0]!.position.x).toBe(10);
      expect(parent.children[0]!.position.y).toBe(20);
      expect(parent.children[1]!.position.x).toBe(300);
      expect(parent.children[1]!.position.y).toBe(20);
      expect(parent.children[2]!.position.x).toBe(150);
      expect(parent.children[2]!.position.y).toBe(200);
    });

    it('deeply nested children positions survive a full roundtrip', async () => {
      const grandchildren: ArchNode[] = [
        makeNode('gc-1', 5, 10),
        makeNode('gc-2', 250, 10),
      ];
      const children: ArchNode[] = [
        makeNode('child-a', 30, 40, grandchildren),
        makeNode('child-b', 400, 40),
      ];
      const graph = makeGraph([
        makeNode('root', 0, 0, children),
      ]);

      const reloaded = await roundtrip(graph);

      const root = reloaded.nodes[0]!;
      const childA = root.children[0]!;
      expect(childA.position.x).toBe(30);
      expect(childA.position.y).toBe(40);
      expect(childA.children).toHaveLength(2);
      expect(childA.children[0]!.position.x).toBe(5);
      expect(childA.children[0]!.position.y).toBe(10);
      expect(childA.children[1]!.position.x).toBe(250);
      expect(childA.children[1]!.position.y).toBe(10);
    });
  });

  describe('Step 3: Binary integrity is maintained across save/reload', () => {
    it('encoded binary is valid .archc format', async () => {
      const graph = makeGraph([
        makeNode('n1', 100, 200),
      ]);
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);

      // Check magic bytes "ARCHC\0"
      expect(binary[0]).toBe(0x41); // 'A'
      expect(binary[1]).toBe(0x52); // 'R'
      expect(binary[2]).toBe(0x43); // 'C'
      expect(binary[3]).toBe(0x48); // 'H'
      expect(binary[4]).toBe(0x43); // 'C'
      expect(binary[5]).toBe(0x00); // '\0'
    });

    it('double roundtrip preserves positions identically', async () => {
      const graph = makeGraph([
        makeNode('parent', 500, 300, [
          makeNode('child', 50, 80),
        ]),
      ]);

      const round1 = await roundtrip(graph);
      const round2 = await roundtrip(round1);

      // Root position
      expect(round2.nodes[0]!.position.x).toBe(500);
      expect(round2.nodes[0]!.position.y).toBe(300);
      // Child position
      expect(round2.nodes[0]!.children[0]!.position.x).toBe(50);
      expect(round2.nodes[0]!.children[0]!.position.y).toBe(80);
    });
  });

  describe('Step 4: Position persistence works with complex graphs', () => {
    it('multiple root nodes with children all preserve positions', async () => {
      const graph = makeGraph([
        makeNode('frontend', 0, 0, [
          makeNode('react-app', 10, 20),
          makeNode('cdn', 300, 20),
        ]),
        makeNode('backend', 600, 0, [
          makeNode('api-server', 10, 20),
          makeNode('worker', 300, 20),
          makeNode('cache', 150, 200),
        ]),
        makeNode('infra', 300, 400, [
          makeNode('k8s', 10, 20),
          makeNode('monitoring', 300, 20),
        ]),
      ]);

      const reloaded = await roundtrip(graph);

      // Root positions
      expect(reloaded.nodes[0]!.position.x).toBe(0);
      expect(reloaded.nodes[0]!.position.y).toBe(0);
      expect(reloaded.nodes[1]!.position.x).toBe(600);
      expect(reloaded.nodes[1]!.position.y).toBe(0);
      expect(reloaded.nodes[2]!.position.x).toBe(300);
      expect(reloaded.nodes[2]!.position.y).toBe(400);

      // Children of backend
      const backend = reloaded.nodes[1]!;
      expect(backend.children).toHaveLength(3);
      expect(backend.children[0]!.position.x).toBe(10);
      expect(backend.children[0]!.position.y).toBe(20);
      expect(backend.children[1]!.position.x).toBe(300);
      expect(backend.children[1]!.position.y).toBe(20);
      expect(backend.children[2]!.position.x).toBe(150);
      expect(backend.children[2]!.position.y).toBe(200);

      // Children of infra
      const infra = reloaded.nodes[2]!;
      expect(infra.children).toHaveLength(2);
      expect(infra.children[0]!.position.x).toBe(10);
      expect(infra.children[1]!.position.x).toBe(300);
    });

    it('node display names and types survive alongside positions', async () => {
      const graph = makeGraph([
        makeNode('api-gw', 100, 200),
      ]);

      const reloaded = await roundtrip(graph);
      const node = reloaded.nodes[0]!;
      expect(node.id).toBe('api-gw');
      expect(node.displayName).toBe('Node api-gw');
      expect(node.type).toBe('compute/service');
      expect(node.position.x).toBe(100);
      expect(node.position.y).toBe(200);
    });
  });

  describe('Step 5: Source code serialization/deserialization handles positions', () => {
    it('nodeToProtoNode serializes position fields', async () => {
      // Verify through the full pipeline that position fields are present in proto
      const graph = makeGraph([
        makeNode('test-node', 42, 99, [], '#abcdef'),
      ]);
      const protoFile = graphToProto(graph);
      const arch = protoFile.architecture!;
      const protoNode = arch.nodes![0]!;

      expect(protoNode.position).toBeDefined();
      expect(protoNode.position!.x).toBe(42);
      expect(protoNode.position!.y).toBe(99);
      expect(protoNode.position!.width).toBe(240);
      expect(protoNode.position!.height).toBe(120);
      expect(protoNode.position!.color).toBe('#abcdef');
    });

    it('protoNodeToNode deserializes position fields', async () => {
      const graph = makeGraph([
        makeNode('deser-test', 77, 88),
      ]);
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      const decoded = await decode(binary);
      const result = protoToGraphFull(decoded);
      const node = result.graph.nodes[0]!;

      expect(node.position.x).toBe(77);
      expect(node.position.y).toBe(88);
      expect(node.position.width).toBe(240);
      expect(node.position.height).toBe(120);
    });
  });

  describe('Step 6: Zero position (0,0) nodes also persist correctly', () => {
    it('nodes at origin (0,0) preserve their positions', async () => {
      const graph = makeGraph([
        makeNode('at-origin', 0, 0),
      ]);

      const reloaded = await roundtrip(graph);
      const node = reloaded.nodes[0]!;
      expect(node.position.x).toBe(0);
      expect(node.position.y).toBe(0);
    });

    it('mix of positioned and origin nodes all survive roundtrip', async () => {
      const graph = makeGraph([
        makeNode('origin', 0, 0),
        makeNode('positioned', 500, 300),
      ]);

      const reloaded = await roundtrip(graph);
      expect(reloaded.nodes[0]!.position.x).toBe(0);
      expect(reloaded.nodes[0]!.position.y).toBe(0);
      expect(reloaded.nodes[1]!.position.x).toBe(500);
      expect(reloaded.nodes[1]!.position.y).toBe(300);
    });
  });
});

/**
 * Tests for StringList value support in proto-to-graph conversion.
 * Verifies that string[] values in node args/properties survive roundtrip
 * through the binary codec (graphToProto → encode → decode → protoToGraph).
 */
import { describe, it, expect } from 'vitest';
import { graphToProto, protoToGraphFull } from '@/core/storage/fileIO';
import { encode, decode } from '@/core/storage/codec';
import type { ArchGraph } from '@/types/graph';
import { ArchCanvasFile } from '@/proto/archcanvas';

function createGraphWithStringList(): ArchGraph {
  return {
    name: 'StringList Test',
    description: 'Tests string list value roundtrip',
    owners: ['test-user'],
    nodes: [
      {
        id: 'node-1',
        type: 'compute/service',
        displayName: 'Service with Tags',
        args: {
          runtime: 'node',
          replicas: 3,
          enabled: true,
          tags: ['production', 'critical', 'us-east'],
        },
        codeRefs: [],
        notes: [],
        properties: {
          team: 'platform',
          environments: ['staging', 'production'],
        },
        position: { x: 100, y: 200, width: 240, height: 120 },
        children: [],
      },
    ],
    edges: [
      {
        id: 'edge-1',
        fromNode: 'node-1',
        toNode: 'node-1',
        type: 'sync',
        properties: {
          protocols: ['http', 'grpc'],
        },
        notes: [],
      },
    ],
    annotations: [],
  };
}

describe('StringList proto value roundtrip', () => {
  it('graphToProto encodes string[] args as StringList', () => {
    const graph = createGraphWithStringList();
    const proto = graphToProto(graph);

    const nodeArgs = proto.architecture?.nodes?.[0]?.args;
    expect(nodeArgs).toBeDefined();
    expect(nodeArgs!['tags']).toEqual({
      stringListValue: { values: ['production', 'critical', 'us-east'] },
    });
    expect(nodeArgs!['runtime']).toEqual({ stringValue: 'node' });
    expect(nodeArgs!['replicas']).toEqual({ numberValue: 3 });
    expect(nodeArgs!['enabled']).toEqual({ boolValue: true });
  });

  it('protoToGraphFull decodes StringList back to string[]', () => {
    const graph = createGraphWithStringList();
    const proto = graphToProto(graph);
    const archFile = ArchCanvasFile.create(proto);
    const result = protoToGraphFull(archFile);

    const node = result.graph.nodes[0]!;
    expect(node.args['tags']).toEqual(['production', 'critical', 'us-east']);
    expect(node.args['runtime']).toBe('node');
    expect(node.args['replicas']).toBe(3);
    expect(node.args['enabled']).toBe(true);
  });

  it('full binary roundtrip preserves string[] values', async () => {
    const graph = createGraphWithStringList();
    const proto = graphToProto(graph);

    // Encode to binary .archc format
    const binary = await encode(proto);

    // Decode back from binary
    const decoded = await decode(binary);
    const result = protoToGraphFull(decoded);

    // Verify node args
    const node = result.graph.nodes[0]!;
    expect(node.args['tags']).toEqual(['production', 'critical', 'us-east']);
    expect(node.args['runtime']).toBe('node');
    expect(node.args['replicas']).toBe(3);
    expect(node.args['enabled']).toBe(true);

    // Verify node properties
    expect(node.properties['team']).toBe('platform');
    expect(node.properties['environments']).toEqual(['staging', 'production']);

    // Verify edge properties
    const edge = result.graph.edges[0]!;
    expect(edge.properties['protocols']).toEqual(['http', 'grpc']);
  });

  it('handles empty string[] values', async () => {
    const graph: ArchGraph = {
      name: 'Empty List Test',
      description: '',
      owners: [],
      nodes: [
        {
          id: 'node-1',
          type: 'compute/service',
          displayName: 'Test',
          args: { emptyList: [] },
          codeRefs: [],
          notes: [],
          properties: {},
          position: { x: 0, y: 0, width: 240, height: 120 },
          children: [],
        },
      ],
      edges: [],
      annotations: [],
    };

    const proto = graphToProto(graph);
    const binary = await encode(proto);
    const decoded = await decode(binary);
    const result = protoToGraphFull(decoded);

    // Empty string list should roundtrip as empty array
    expect(result.graph.nodes[0]!.args['emptyList']).toEqual([]);
  });
});

describe('codec edge cases', () => {
  it('rejects files with header-only (no payload)', async () => {
    // Create a 40-byte file with valid magic + version but no payload
    const headerOnly = new Uint8Array(40);
    // ARCHC\0
    headerOnly[0] = 0x41;
    headerOnly[1] = 0x52;
    headerOnly[2] = 0x43;
    headerOnly[3] = 0x48;
    headerOnly[4] = 0x43;
    headerOnly[5] = 0x00;
    // version 1 as uint16 BE
    headerOnly[6] = 0x00;
    headerOnly[7] = 0x01;

    await expect(decode(headerOnly)).rejects.toThrow('empty after header');
  });

  it('roundtrip preserves all value types together', async () => {
    const graph: ArchGraph = {
      name: 'All Types',
      description: 'Graph with all Value types',
      owners: [],
      nodes: [
        {
          id: 'n1',
          type: 'compute/service',
          displayName: 'Mixed Args',
          args: {
            str: 'hello',
            num: 42.5,
            flag: false,
            list: ['a', 'b', 'c'],
          },
          codeRefs: [],
          notes: [],
          properties: {},
          position: { x: 0, y: 0, width: 240, height: 120 },
          children: [],
        },
      ],
      edges: [],
      annotations: [],
    };

    const proto = graphToProto(graph);
    const binary = await encode(proto);
    const decoded = await decode(binary);
    const result = protoToGraphFull(decoded);

    const args = result.graph.nodes[0]!.args;
    expect(args['str']).toBe('hello');
    expect(args['num']).toBe(42.5);
    expect(args['flag']).toBe(false);
    expect(args['list']).toEqual(['a', 'b', 'c']);
  });
});

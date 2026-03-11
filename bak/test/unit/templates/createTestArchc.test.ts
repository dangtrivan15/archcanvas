/**
 * Helper test that creates a valid .archc file for import testing.
 */
import { describe, it, expect } from 'vitest';
import { encode } from '@/core/storage/codec';
import { graphToProto } from '@/core/storage/fileIO';
import type { ArchGraph } from '@/types/graph';
import { writeFileSync } from 'fs';

describe('Create test .archc file', () => {
  it('creates a valid .archc file at /tmp/test-import.archc', async () => {
    const graph: ArchGraph = {
      name: 'Test Import Architecture',
      description: 'A test architecture for template import',
      owners: ['test-user'],
      nodes: [
        {
          id: 'n1',
          type: 'compute/service',
          displayName: 'API Server',
          args: { runtime: 'Node.js' },
          codeRefs: [],
          notes: [],
          properties: {},
          position: { x: 100, y: 100, width: 200, height: 100 },
          children: [],
        },
        {
          id: 'n2',
          type: 'data/database',
          displayName: 'PostgreSQL',
          args: { engine: 'PostgreSQL' },
          codeRefs: [],
          notes: [],
          properties: {},
          position: { x: 400, y: 100, width: 200, height: 100 },
          children: [],
        },
      ],
      edges: [
        {
          id: 'e1',
          fromNode: 'n1',
          toNode: 'n2',
          type: 'sync',
          label: 'queries',
          properties: {},
          notes: [],
        },
      ],
      annotations: [],
    };

    const protoFile = graphToProto(graph);
    const binaryData = await encode(protoFile);

    writeFileSync('/tmp/test-import.archc', binaryData);
    expect(binaryData.length).toBeGreaterThan(40);
    console.log('Created /tmp/test-import.archc (' + binaryData.length + ' bytes)');
  });
});

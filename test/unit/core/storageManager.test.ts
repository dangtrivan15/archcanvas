/**
 * Tests for StorageManager + InMemoryBackend.
 *
 * Verifies the full roundtrip: graph → proto → encode → backend write → backend read → decode → graph.
 * Also tests InMemoryBackend in isolation and StorageManager edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryBackend } from '@/core/storage/backends/inMemory';
import { StorageManager } from '@/core/storage/storageManager';
import { encode } from '@/core/storage/codec';
import { graphToProto, protoToGraphFull } from '@/core/storage/fileIO';
import type { ArchGraph } from '@/types/graph';
import type { StorageHandle } from '@/core/storage/types';

// ─── Test Data Factory ──────────────────────────────────────────

function createTestGraph(name = 'Test Architecture'): ArchGraph {
  return {
    name,
    description: 'A test architecture for roundtrip verification',
    owners: ['alice', 'bob'],
    nodes: [
      {
        id: 'svc-api',
        type: 'compute/service',
        displayName: 'API Gateway',
        args: { runtime: 'node' },
        codeRefs: [{ path: 'src/api/index.ts', role: 'source' }],
        notes: [
          {
            id: 'note-1',
            author: 'alice',
            timestampMs: 1700000000000,
            content: 'Main entry point',
            tags: ['core'],
            status: 'none',
          },
        ],
        properties: { version: '1.0.0' },
        position: { x: 100, y: 200, width: 240, height: 120 },
        children: [],
      },
      {
        id: 'db-main',
        type: 'data/database',
        displayName: 'Main DB',
        args: { engine: 'postgres' },
        codeRefs: [],
        notes: [],
        properties: {},
        position: { x: 400, y: 200, width: 240, height: 120 },
        children: [],
      },
    ],
    edges: [
      {
        id: 'e-1',
        fromNode: 'svc-api',
        toNode: 'db-main',
        type: 'sync',
        label: 'SQL queries',
        properties: {},
        notes: [],
      },
    ],
    annotations: [],
  };
}

/**
 * Encode a graph to .archc binary bytes for test seeding.
 */
async function graphToBytes(graph: ArchGraph): Promise<Uint8Array> {
  const protoFile = graphToProto(graph);
  return encode(protoFile);
}

// ─── InMemoryBackend Tests ───────────────────────────────────────

describe('InMemoryBackend', () => {
  let backend: InMemoryBackend;

  beforeEach(() => {
    backend = new InMemoryBackend();
  });

  it('has type "in-memory"', () => {
    expect(backend.type).toBe('in-memory');
  });

  it('reports correct capabilities', () => {
    expect(backend.capabilities.supportsDirectWrite).toBe(true);
    expect(backend.capabilities.supportsLastModified).toBe(false);
  });

  it('starts with zero files', () => {
    expect(backend.fileCount).toBe(0);
  });

  describe('seedFile + read', () => {
    it('stores and reads back data', async () => {
      const data = new Uint8Array([10, 20, 30]);
      const handle = backend.seedFile('test.archc', data);

      expect(handle.backend).toBe('in-memory');
      expect(handle.name).toBe('test.archc');
      expect(backend.fileCount).toBe(1);

      const readBack = await backend.read(handle);
      expect(Array.from(readBack)).toEqual([10, 20, 30]);
    });

    it('returns a copy (not a reference to internal storage)', async () => {
      const data = new Uint8Array([1, 2, 3]);
      const handle = backend.seedFile('test.archc', data);

      const read1 = await backend.read(handle);
      read1[0] = 99;

      const read2 = await backend.read(handle);
      expect(read2[0]).toBe(1); // not mutated
    });
  });

  describe('write', () => {
    it('overwrites existing file data', async () => {
      const handle = backend.seedFile('test.archc', new Uint8Array([1, 2, 3]));

      const updatedHandle = await backend.write(handle, new Uint8Array([4, 5, 6]));
      expect(updatedHandle).toBe(handle);

      const readBack = await backend.read(handle);
      expect(Array.from(readBack)).toEqual([4, 5, 6]);
    });

    it('creates a new file if handle key does not exist', async () => {
      const handle: StorageHandle = {
        backend: 'in-memory',
        name: 'new.archc',
        _internal: 'new.archc',
      };

      await backend.write(handle, new Uint8Array([7, 8, 9]));
      expect(backend.fileCount).toBe(1);

      const readBack = await backend.read(handle);
      expect(Array.from(readBack)).toEqual([7, 8, 9]);
    });
  });

  describe('read errors', () => {
    it('throws for non-existent file', async () => {
      const handle: StorageHandle = {
        backend: 'in-memory',
        name: 'missing.archc',
        _internal: 'missing.archc',
      };

      await expect(backend.read(handle)).rejects.toThrow('file not found');
    });
  });

  describe('openFilePicker', () => {
    it('returns null when nextPickFileName is not set', async () => {
      const result = await backend.openFilePicker();
      expect(result).toBeNull();
    });

    it('returns null when nextPickFileName references a non-existent file', async () => {
      backend.nextPickFileName = 'missing.archc';
      const result = await backend.openFilePicker();
      expect(result).toBeNull();
    });

    it('returns a handle when file exists and nextPickFileName is set', async () => {
      backend.seedFile('test.archc', new Uint8Array([1, 2, 3]));
      backend.nextPickFileName = 'test.archc';

      const handle = await backend.openFilePicker();
      expect(handle).not.toBeNull();
      expect(handle!.name).toBe('test.archc');
      expect(handle!.backend).toBe('in-memory');
    });

    it('resets nextPickFileName after pick', async () => {
      backend.seedFile('test.archc', new Uint8Array([1]));
      backend.nextPickFileName = 'test.archc';

      await backend.openFilePicker();
      expect(backend.nextPickFileName).toBeNull();

      // Second call should return null
      const result = await backend.openFilePicker();
      expect(result).toBeNull();
    });
  });

  describe('saveFilePicker', () => {
    it('returns null when no name is provided', async () => {
      const result = await backend.saveFilePicker(new Uint8Array([1]));
      expect(result).toBeNull();
    });

    it('uses nextSaveFileName when set', async () => {
      backend.nextSaveFileName = 'output.archc';
      const data = new Uint8Array([1, 2, 3]);

      const handle = await backend.saveFilePicker(data);
      expect(handle).not.toBeNull();
      expect(handle!.name).toBe('output.archc');

      const readBack = backend.getFile('output.archc');
      expect(readBack).toBeDefined();
      expect(Array.from(readBack!)).toEqual([1, 2, 3]);
    });

    it('ignores suggestedName in options (only nextSaveFileName matters)', async () => {
      // suggestedName is just a hint for a real dialog UI; in-memory backend
      // requires nextSaveFileName to be set to simulate the user confirming.
      const data = new Uint8Array([4, 5, 6]);
      const handle = await backend.saveFilePicker(data, { suggestedName: 'suggested.archc' });

      expect(handle).toBeNull(); // no nextSaveFileName → simulates cancel
    });

    it('resets nextSaveFileName after pick', async () => {
      backend.nextSaveFileName = 'output.archc';
      await backend.saveFilePicker(new Uint8Array([1]));
      expect(backend.nextSaveFileName).toBeNull();
    });
  });

  describe('getFile', () => {
    it('returns undefined for non-existent files', () => {
      expect(backend.getFile('missing.archc')).toBeUndefined();
    });

    it('returns a copy of the stored data', () => {
      backend.seedFile('test.archc', new Uint8Array([1, 2, 3]));
      const data = backend.getFile('test.archc');
      expect(data).toBeDefined();
      expect(Array.from(data!)).toEqual([1, 2, 3]);

      // Mutating the returned copy should not affect internal state
      data![0] = 99;
      const data2 = backend.getFile('test.archc');
      expect(data2![0]).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all files and resets picker state', () => {
      backend.seedFile('a.archc', new Uint8Array([1]));
      backend.seedFile('b.archc', new Uint8Array([2]));
      backend.nextPickFileName = 'a.archc';
      backend.nextSaveFileName = 'c.archc';

      backend.clear();

      expect(backend.fileCount).toBe(0);
      expect(backend.nextPickFileName).toBeNull();
      expect(backend.nextSaveFileName).toBeNull();
    });
  });
});

// ─── StorageManager Tests ────────────────────────────────────────

describe('StorageManager', () => {
  let backend: InMemoryBackend;
  let manager: StorageManager;

  beforeEach(() => {
    backend = new InMemoryBackend();
    manager = new StorageManager(backend);
  });

  it('exposes backend type', () => {
    expect(manager.backendType).toBe('in-memory');
  });

  it('exposes backend capabilities', () => {
    expect(manager.capabilities.supportsDirectWrite).toBe(true);
    expect(manager.capabilities.supportsLastModified).toBe(false);
  });

  describe('full roundtrip: save → open', () => {
    it('preserves graph data through save-as then open', async () => {
      const graph = createTestGraph();

      // Save As — use the nextSaveFileName to simulate picker
      backend.nextSaveFileName = 'roundtrip.archc';
      const saveResult = await manager.saveArchitectureAs(graph, 'roundtrip.archc');

      expect(saveResult).not.toBeNull();
      expect(saveResult!.handle.name).toBe('roundtrip.archc');

      // Open — use the nextPickFileName to simulate picker
      backend.nextPickFileName = 'roundtrip.archc';
      const openResult = await manager.openArchitecture();

      expect(openResult).not.toBeNull();
      const loaded = openResult!.result.graph;

      // Verify graph fields survived the roundtrip
      expect(loaded.name).toBe('Test Architecture');
      expect(loaded.description).toBe('A test architecture for roundtrip verification');
      expect(loaded.owners).toEqual(['alice', 'bob']);
      expect(loaded.nodes).toHaveLength(2);
      expect(loaded.edges).toHaveLength(1);
    });

    it('preserves node details through roundtrip', async () => {
      const graph = createTestGraph();

      backend.nextSaveFileName = 'details.archc';
      await manager.saveArchitectureAs(graph, 'details.archc');

      backend.nextPickFileName = 'details.archc';
      const openResult = await manager.openArchitecture();
      const loaded = openResult!.result.graph;

      const apiNode = loaded.nodes.find((n) => n.id === 'svc-api');
      expect(apiNode).toBeDefined();
      expect(apiNode!.displayName).toBe('API Gateway');
      expect(apiNode!.type).toBe('compute/service');
      expect(apiNode!.args).toEqual({ runtime: 'node' });
      expect(apiNode!.codeRefs).toHaveLength(1);
      expect(apiNode!.codeRefs[0]!.path).toBe('src/api/index.ts');
      expect(apiNode!.notes).toHaveLength(1);
      expect(apiNode!.notes[0]!.content).toBe('Main entry point');
      expect(apiNode!.position.x).toBe(100);
      expect(apiNode!.position.y).toBe(200);
    });

    it('preserves edge details through roundtrip', async () => {
      const graph = createTestGraph();

      backend.nextSaveFileName = 'edges.archc';
      await manager.saveArchitectureAs(graph, 'edges.archc');

      backend.nextPickFileName = 'edges.archc';
      const openResult = await manager.openArchitecture();
      const loaded = openResult!.result.graph;

      expect(loaded.edges).toHaveLength(1);
      const edge = loaded.edges[0]!;
      expect(edge.id).toBe('e-1');
      expect(edge.fromNode).toBe('svc-api');
      expect(edge.toNode).toBe('db-main');
      expect(edge.type).toBe('sync');
      expect(edge.label).toBe('SQL queries');
    });
  });

  describe('save in-place', () => {
    it('overwrites existing file via handle', async () => {
      const graph1 = createTestGraph('Version 1');

      // Save initial version
      backend.nextSaveFileName = 'project.archc';
      const saveResult = await manager.saveArchitectureAs(graph1, 'project.archc');
      const handle = saveResult!.handle;

      // Update graph and save in-place
      const graph2 = createTestGraph('Version 2');
      const updatedHandle = await manager.saveArchitecture(graph2, handle);

      // Re-read and verify it's the updated version
      backend.nextPickFileName = 'project.archc';
      const openResult = await manager.openArchitecture();
      expect(openResult!.result.graph.name).toBe('Version 2');
      expect(updatedHandle.name).toBe('project.archc');
    });
  });

  describe('saveArchitecture with options', () => {
    it('preserves canvas state through save and open', async () => {
      const graph = createTestGraph();
      const canvasState = {
        viewport: { x: 150, y: 250, zoom: 1.5 },
        selectedNodeIds: ['svc-api'],
        navigationPath: [],
        panelLayout: {
          rightPanelOpen: true,
          rightPanelTab: 'notes',
          rightPanelWidth: 400,
        },
      };

      // Seed the file, then save with canvas state
      const handle = backend.seedFile('state.archc', await graphToBytes(graph));
      await manager.saveArchitecture(graph, handle, { canvasState });

      // Open and verify canvas state
      backend.nextPickFileName = 'state.archc';
      const openResult = await manager.openArchitecture();
      const cs = openResult!.result.canvasState;

      expect(cs).toBeDefined();
      expect(cs!.viewport.x).toBeCloseTo(150);
      expect(cs!.viewport.y).toBeCloseTo(250);
      expect(cs!.viewport.zoom).toBeCloseTo(1.5);
      expect(cs!.selectedNodeIds).toEqual(['svc-api']);
      expect(cs!.panelLayout?.rightPanelOpen).toBe(true);
      expect(cs!.panelLayout?.rightPanelTab).toBe('notes');
    });
  });

  describe('openArchitecture', () => {
    it('returns null when user cancels the picker', async () => {
      // Don't set nextPickFileName → picker returns null
      const result = await manager.openArchitecture();
      expect(result).toBeNull();
    });

    it('includes the handle in the result', async () => {
      const graph = createTestGraph();
      const bytes = await graphToBytes(graph);
      backend.seedFile('test.archc', bytes);
      backend.nextPickFileName = 'test.archc';

      const result = await manager.openArchitecture();
      expect(result).not.toBeNull();
      expect(result!.handle.name).toBe('test.archc');
      expect(result!.handle.backend).toBe('in-memory');
    });
  });

  describe('saveArchitectureAs', () => {
    it('returns null when user cancels the picker', async () => {
      const graph = createTestGraph();
      // Don't set nextSaveFileName → picker returns null
      const result = await manager.saveArchitectureAs(graph, 'test.archc');
      expect(result).toBeNull();
    });

    it('writes encoded data to the backend', async () => {
      const graph = createTestGraph();
      backend.nextSaveFileName = 'new.archc';

      const result = await manager.saveArchitectureAs(graph, 'new.archc');
      expect(result).not.toBeNull();
      expect(backend.fileCount).toBe(1);

      // Verify the stored data is a valid .archc binary
      const raw = backend.getFile('new.archc');
      expect(raw).toBeDefined();
      // Magic bytes: ARCHC\0
      expect(raw![0]).toBe(0x41); // 'A'
      expect(raw![1]).toBe(0x52); // 'R'
      expect(raw![2]).toBe(0x43); // 'C'
      expect(raw![3]).toBe(0x48); // 'H'
      expect(raw![4]).toBe(0x43); // 'C'
      expect(raw![5]).toBe(0x00); // '\0'
    });
  });

  describe('openArchitecture with seeded data', () => {
    it('decodes a pre-seeded .archc file', async () => {
      const graph = createTestGraph('Pre-seeded');
      const bytes = await graphToBytes(graph);

      backend.seedFile('pre-seeded.archc', bytes);
      backend.nextPickFileName = 'pre-seeded.archc';

      const result = await manager.openArchitecture();
      expect(result).not.toBeNull();
      expect(result!.result.graph.name).toBe('Pre-seeded');
      expect(result!.result.graph.nodes).toHaveLength(2);
    });
  });

  describe('empty graph roundtrip', () => {
    it('handles a graph with no nodes or edges', async () => {
      const emptyGraph: ArchGraph = {
        name: 'Empty',
        description: '',
        owners: [],
        nodes: [],
        edges: [],
        annotations: [],
      };

      backend.nextSaveFileName = 'empty.archc';
      await manager.saveArchitectureAs(emptyGraph, 'empty.archc');

      backend.nextPickFileName = 'empty.archc';
      const result = await manager.openArchitecture();

      expect(result).not.toBeNull();
      expect(result!.result.graph.name).toBe('Empty');
      expect(result!.result.graph.nodes).toHaveLength(0);
      expect(result!.result.graph.edges).toHaveLength(0);
    });
  });
});

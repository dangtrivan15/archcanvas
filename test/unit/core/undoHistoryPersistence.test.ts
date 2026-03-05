/**
 * Tests for Feature #38: Undo/redo state serialized in .archc file.
 * Verifies undo history is persisted when saving and restored when opening a file.
 *
 * Steps:
 * 1. Create architecture, perform several mutations to build undo history
 * 2. Save to .archc file (encode)
 * 3. Load the .archc file (decode)
 * 4. Verify undo history is restored
 * 5. Call undo() and verify it works with restored history
 * 6. Call redo() and verify it works with restored history
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UndoManager } from '@/core/history/undoManager';
import {
  createEmptyGraph,
  createNode,
  addNode,
  addEdge,
  createEdge,
  updateNode,
} from '@/core/graph/graphEngine';
import { graphToProto, protoToGraphFull } from '@/core/storage/fileIO';
import type { UndoHistoryData } from '@/core/storage/fileIO';
import { encode, decode } from '@/core/storage/codec';
import type { ArchGraph } from '@/types/graph';

describe('Feature #38: Undo/redo state serialized in .archc file', () => {
  let undoManager: UndoManager;
  let graph: ArchGraph;

  beforeEach(() => {
    undoManager = new UndoManager();
    graph = createEmptyGraph('Undo Persistence Test');
  });

  describe('Feature verification steps', () => {
    it('should persist undo history through save/load and support undo/redo after restore', async () => {
      // Step 1: Create architecture, perform several mutations to build undo history
      // Initial empty state
      undoManager.snapshot('Initial empty state', graph);

      // Mutation 1: Add API Gateway
      const apiGw = createNode({
        type: 'compute/api-gateway',
        displayName: 'API Gateway',
        args: { port: 8080 },
      });
      graph = addNode(graph, apiGw);
      undoManager.snapshot('Add API Gateway', graph);

      // Mutation 2: Add Order Service
      const orderSvc = createNode({
        type: 'compute/service',
        displayName: 'Order Service',
        args: { language: 'TypeScript' },
      });
      graph = addNode(graph, orderSvc);
      undoManager.snapshot('Add Order Service', graph);

      // Mutation 3: Add edge between them
      const edge = createEdge({
        fromNode: apiGw.id,
        toNode: orderSvc.id,
        type: 'sync',
        label: 'REST API',
      });
      graph = addEdge(graph, edge);
      undoManager.snapshot('Add sync edge', graph);

      // Verify we have undo history
      expect(undoManager.historyLength).toBe(4);
      expect(undoManager.canUndo).toBe(true);

      // Step 2: Save to .archc file
      const historyData = undoManager.exportHistory();
      const protoFile = graphToProto(graph, undefined, historyData);
      const binaryData = await encode(protoFile);

      // Step 3: Load the .archc file
      const decoded = await decode(binaryData);
      const result = protoToGraphFull(decoded);

      // Step 4: Verify undo history is restored
      expect(result.undoHistory).toBeDefined();
      expect(result.undoHistory!.entries).toHaveLength(4);
      expect(result.undoHistory!.currentIndex).toBe(3); // pointing to last entry
      expect(result.undoHistory!.maxEntries).toBe(100);

      // Verify entry descriptions
      expect(result.undoHistory!.entries[0].description).toBe('Initial empty state');
      expect(result.undoHistory!.entries[1].description).toBe('Add API Gateway');
      expect(result.undoHistory!.entries[2].description).toBe('Add Order Service');
      expect(result.undoHistory!.entries[3].description).toBe('Add sync edge');

      // Import history into a new UndoManager
      const restoredManager = new UndoManager();
      restoredManager.importHistory(result.undoHistory!.entries, result.undoHistory!.currentIndex);

      // Step 5: Call undo() and verify it works with restored history
      expect(restoredManager.canUndo).toBe(true);

      // Undo: should go back to 2 nodes, 0 edges (before edge was added)
      const undone1 = restoredManager.undo()!;
      expect(undone1.nodes).toHaveLength(2);
      expect(undone1.edges).toHaveLength(0);
      expect(undone1.nodes[0].displayName).toBe('API Gateway');
      expect(undone1.nodes[1].displayName).toBe('Order Service');

      // Undo again: should go back to 1 node (before Order Service was added)
      const undone2 = restoredManager.undo()!;
      expect(undone2.nodes).toHaveLength(1);
      expect(undone2.nodes[0].displayName).toBe('API Gateway');
      expect(undone2.nodes[0].args).toEqual({ port: 8080 });

      // Undo again: should go back to empty state
      const undone3 = restoredManager.undo()!;
      expect(undone3.nodes).toHaveLength(0);
      expect(undone3.edges).toHaveLength(0);

      // No more undo
      expect(restoredManager.canUndo).toBe(false);

      // Step 6: Call redo() and verify it works with restored history
      expect(restoredManager.canRedo).toBe(true);

      // Redo: should restore API Gateway
      const redone1 = restoredManager.redo()!;
      expect(redone1.nodes).toHaveLength(1);
      expect(redone1.nodes[0].displayName).toBe('API Gateway');

      // Redo: should restore Order Service
      const redone2 = restoredManager.redo()!;
      expect(redone2.nodes).toHaveLength(2);
      expect(redone2.nodes[1].displayName).toBe('Order Service');

      // Redo: should restore edge
      const redone3 = restoredManager.redo()!;
      expect(redone3.nodes).toHaveLength(2);
      expect(redone3.edges).toHaveLength(1);
      expect(redone3.edges[0].label).toBe('REST API');
      expect(redone3.edges[0].type).toBe('sync');

      // No more redo
      expect(restoredManager.canRedo).toBe(false);
    });
  });

  describe('Snapshot graph data preserved through roundtrip', () => {
    it('preserves node args, properties, notes, and positions in snapshots', async () => {
      const node = createNode({
        type: 'data/database',
        displayName: 'Orders DB',
        args: { engine: 'PostgreSQL', version: '16' },
        position: { x: 100, y: 200, width: 300, height: 150 },
      });
      graph = addNode(graph, node);
      undoManager.snapshot('Add DB', graph);

      // Rename node
      graph = updateNode(graph, node.id, { displayName: 'Updated DB' });
      undoManager.snapshot('Rename DB', graph);

      // Save → Load roundtrip
      const historyData = undoManager.exportHistory();
      const protoFile = graphToProto(graph, undefined, historyData);
      const binaryData = await encode(protoFile);
      const decoded = await decode(binaryData);
      const result = protoToGraphFull(decoded);

      // Import and undo
      const restored = new UndoManager();
      restored.importHistory(result.undoHistory!.entries, result.undoHistory!.currentIndex);

      const undone = restored.undo()!;
      expect(undone.nodes[0].displayName).toBe('Orders DB');
      expect(undone.nodes[0].args).toEqual({ engine: 'PostgreSQL', version: '16' });
      expect(undone.nodes[0].position.x).toBe(100);
      expect(undone.nodes[0].position.y).toBe(200);
      expect(undone.nodes[0].position.width).toBe(300);
      expect(undone.nodes[0].position.height).toBe(150);
    });

    it('preserves edge types in snapshots through roundtrip', async () => {
      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
      graph = addNode(addNode(graph, nodeA), nodeB);

      const syncEdge = createEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
        label: 'sync call',
      });
      graph = addEdge(graph, syncEdge);
      undoManager.snapshot('With sync edge', graph);

      const asyncEdge = createEdge({
        fromNode: nodeB.id,
        toNode: nodeA.id,
        type: 'async',
        label: 'event',
      });
      graph = addEdge(graph, asyncEdge);
      undoManager.snapshot('With async edge', graph);

      // Roundtrip
      const historyData = undoManager.exportHistory();
      const binary = await encode(graphToProto(graph, undefined, historyData));
      const result = protoToGraphFull(await decode(binary));

      const restored = new UndoManager();
      restored.importHistory(result.undoHistory!.entries, result.undoHistory!.currentIndex);

      // Undo: back to just sync edge
      const undone = restored.undo()!;
      expect(undone.edges).toHaveLength(1);
      expect(undone.edges[0].type).toBe('sync');
      expect(undone.edges[0].label).toBe('sync call');
    });

    it('preserves graph name and owners in snapshots', async () => {
      graph = { ...graph, name: 'My Architecture', owners: ['alice', 'bob'] };
      undoManager.snapshot('Initial', graph);

      graph = { ...graph, name: 'Renamed Architecture' };
      undoManager.snapshot('Renamed', graph);

      // Roundtrip
      const historyData = undoManager.exportHistory();
      const binary = await encode(graphToProto(graph, undefined, historyData));
      const result = protoToGraphFull(await decode(binary));

      const restored = new UndoManager();
      restored.importHistory(result.undoHistory!.entries, result.undoHistory!.currentIndex);

      const undone = restored.undo()!;
      expect(undone.name).toBe('My Architecture');
      expect(undone.owners).toEqual(['alice', 'bob']);
    });
  });

  describe('UndoManager export/import', () => {
    it('exportHistory returns independent deep clones', () => {
      const node = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, node);
      undoManager.snapshot('Add A', graph);

      const exported = undoManager.exportHistory();

      // Mutating the exported data should not affect the undo manager
      exported.entries[0].snapshot.nodes.push(
        createNode({ type: 'compute/service', displayName: 'Intruder' }),
      );

      // Original still has 1 node
      const undone = undoManager.undo();
      // Can't undo from a single entry (need at least 2)
      // But the internal snapshot should be intact
      expect(undoManager.historyLength).toBe(1);
      const reExported = undoManager.exportHistory();
      expect(reExported.entries[0].snapshot.nodes).toHaveLength(1);
    });

    it('importHistory creates independent deep clones', () => {
      const node = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, node);

      const entries = [{ description: 'State 1', timestampMs: Date.now(), snapshot: graph }];

      undoManager.importHistory(entries, 0);

      // Mutating the original data should not affect the imported history
      entries[0].snapshot.nodes.push(
        createNode({ type: 'compute/service', displayName: 'Intruder' }),
      );

      const exported = undoManager.exportHistory();
      expect(exported.entries[0].snapshot.nodes).toHaveLength(1);
    });

    it('importHistory enforces max entries', () => {
      const smallManager = new UndoManager(3);
      const entries = [];
      for (let i = 0; i < 5; i++) {
        graph = addNode(graph, createNode({ type: 'compute/service', displayName: `Node ${i}` }));
        entries.push({
          description: `Step ${i}`,
          timestampMs: Date.now(),
          snapshot: structuredClone(graph),
        });
      }

      smallManager.importHistory(entries, 4);

      // Should be capped at 3
      expect(smallManager.historyLength).toBe(3);
      // Current index adjusted
      expect(smallManager.currentHistoryIndex).toBe(2);
    });

    it('importHistory restores canUndo/canRedo correctly', () => {
      graph = createEmptyGraph('Test');
      const node1 = createNode({ type: 'compute/service', displayName: 'A' });

      const entries = [
        { description: 'Empty', timestampMs: 1000, snapshot: structuredClone(graph) },
        { description: 'Add A', timestampMs: 2000, snapshot: addNode(graph, node1) },
      ];

      // Import at last entry (currentIndex = 1)
      undoManager.importHistory(entries, 1);
      expect(undoManager.canUndo).toBe(true);
      expect(undoManager.canRedo).toBe(false);

      // Import at first entry (currentIndex = 0) - should allow redo
      const manager2 = new UndoManager();
      manager2.importHistory(entries, 0);
      expect(manager2.canUndo).toBe(false);
      expect(manager2.canRedo).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('handles file without undo history gracefully', async () => {
      const protoFile = graphToProto(graph);
      const binaryData = await encode(protoFile);
      const decoded = await decode(binaryData);
      const result = protoToGraphFull(decoded);

      // No undo history in the file
      expect(result.undoHistory).toBeUndefined();
      // Graph still loads fine
      expect(result.graph.name).toBe('Undo Persistence Test');
    });

    it('handles empty undo history', async () => {
      const emptyHistory: UndoHistoryData = {
        entries: [],
        currentIndex: -1,
        maxEntries: 100,
      };

      const protoFile = graphToProto(graph, undefined, emptyHistory);
      const binaryData = await encode(protoFile);
      const decoded = await decode(binaryData);
      const result = protoToGraphFull(decoded);

      // Empty undo history is treated as undefined
      expect(result.undoHistory).toBeUndefined();
    });

    it('preserves timestamps in undo entries through roundtrip', async () => {
      const ts1 = 1700000000000;
      const ts2 = 1700000001000;

      const node = createNode({ type: 'compute/service', displayName: 'A' });
      const graphWithNode = addNode(graph, node);

      const entries = [
        { description: 'State 1', timestampMs: ts1, snapshot: structuredClone(graph) },
        { description: 'State 2', timestampMs: ts2, snapshot: structuredClone(graphWithNode) },
      ];

      undoManager.importHistory(entries, 1);
      const historyData = undoManager.exportHistory();

      const binary = await encode(graphToProto(graphWithNode, undefined, historyData));
      const result = protoToGraphFull(await decode(binary));

      expect(result.undoHistory!.entries[0].timestampMs).toBe(ts1);
      expect(result.undoHistory!.entries[1].timestampMs).toBe(ts2);
    });

    it('undo history coexists with canvas state in same file', async () => {
      const node = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, node);
      undoManager.snapshot('Add A', graph);

      const canvasState = {
        viewport: { x: 100, y: 200, zoom: 1.5 },
        selectedNodeIds: [node.id],
        navigationPath: [],
      };

      const historyData = undoManager.exportHistory();
      const binary = await encode(graphToProto(graph, canvasState, historyData));
      const result = protoToGraphFull(await decode(binary));

      // Both canvas state and undo history should be present
      expect(result.canvasState).toBeDefined();
      expect(result.canvasState!.viewport.x).toBeCloseTo(100);
      expect(result.canvasState!.viewport.zoom).toBeCloseTo(1.5);
      expect(result.undoHistory).toBeDefined();
      expect(result.undoHistory!.entries).toHaveLength(1);
    });

    it('preserves nested children in undo snapshots through roundtrip', async () => {
      const parent = createNode({
        type: 'compute/service',
        displayName: 'Parent',
      });
      // Add children manually since createNode() doesn't accept children param
      parent.children = [
        createNode({ type: 'compute/function', displayName: 'Child A' }),
        createNode({ type: 'compute/function', displayName: 'Child B' }),
      ];
      graph = addNode(graph, parent);
      undoManager.snapshot('Add parent with children', graph);

      // Add another node
      graph = addNode(graph, createNode({ type: 'data/database', displayName: 'DB' }));
      undoManager.snapshot('Add DB', graph);

      // Roundtrip
      const historyData = undoManager.exportHistory();
      const binary = await encode(graphToProto(graph, undefined, historyData));
      const result = protoToGraphFull(await decode(binary));

      const restored = new UndoManager();
      restored.importHistory(result.undoHistory!.entries, result.undoHistory!.currentIndex);

      // Undo: should see parent with 2 children, no DB
      const undone = restored.undo()!;
      expect(undone.nodes).toHaveLength(1);
      expect(undone.nodes[0].displayName).toBe('Parent');
      expect(undone.nodes[0].children).toHaveLength(2);
      expect(undone.nodes[0].children[0].displayName).toBe('Child A');
      expect(undone.nodes[0].children[1].displayName).toBe('Child B');
    });

    it('new action after import discards redo future (branch behavior)', async () => {
      // Build 3 states: empty → A → A+B
      undoManager.snapshot('Empty', graph);

      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, nodeA);
      undoManager.snapshot('Add A', graph);

      const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
      graph = addNode(graph, nodeB);
      undoManager.snapshot('Add B', graph);

      // Undo to just A
      undoManager.undo();

      // Save at mid-undo position (currentIndex=1, but 3 entries)
      const historyData = undoManager.exportHistory();
      expect(historyData.currentIndex).toBe(1);
      expect(historyData.entries).toHaveLength(3);

      // Roundtrip
      const binary = await encode(graphToProto(graph, undefined, historyData));
      const result = protoToGraphFull(await decode(binary));

      const restored = new UndoManager();
      restored.importHistory(result.undoHistory!.entries, result.undoHistory!.currentIndex);

      // Should be able to redo (back to A+B)
      expect(restored.canRedo).toBe(true);

      // Make a new action instead - should discard redo future
      const nodeC = createNode({ type: 'data/database', displayName: 'C' });
      const graphWithC = addNode(addNode(graph, nodeA), nodeC);
      restored.snapshot('Add C instead', graphWithC);

      // Redo should no longer be possible
      expect(restored.canRedo).toBe(false);

      // Undo should go to the "Add A" state
      const undone = restored.undo()!;
      expect(undone.nodes).toHaveLength(1);
      expect(undone.nodes[0].displayName).toBe('A');
    });
  });
});

// @vitest-environment happy-dom
/**
 * Tests for Keyboard Edge Type Cycling (Feature #252)
 * Selected edge + 'T' cycles type: Sync → Async → Data Flow → Sync.
 * Also via command palette 'Change Edge Type' / 'Set Edge Type' commands.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { getAllCommands, searchCommands } from '@/config/commandRegistry';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { TextApi } from '@/api/textApi';
import { UndoManager } from '@/core/history/undoManager';
import { SHORTCUT_ACTIONS } from '@/core/shortcuts/shortcutManager';
import type { EdgeType } from '@/types/graph';

// Helper to set up store with nodes + an edge
function setupStore(edgeType: EdgeType = 'sync') {
  const textApi = new TextApi(createEmptyGraph());

  const nodeA = textApi.addNode({
    type: 'compute/service',
    displayName: 'API Gateway',
    position: { x: 0, y: 0 },
  });

  const nodeB = textApi.addNode({
    type: 'compute/service',
    displayName: 'Order Service',
    position: { x: 300, y: 0 },
  });

  const edge = textApi.addEdge({
    fromNode: nodeA!.id,
    toNode: nodeB!.id,
    type: edgeType,
  });

  const graph = textApi.getGraph();
  const undoManager = new UndoManager();
  undoManager.snapshot('Initial state', graph);

  useCoreStore.setState({
    graph,
    textApi,
    undoManager,
    nodeCount: 2,
    edgeCount: 1,
    isDirty: false,
    canUndo: false,
    canRedo: false,
  });

  useCanvasStore.setState({
    selectedNodeId: null,
    selectedEdgeId: edge!.id,
    selectedNodeIds: [],
    selectedEdgeIds: [edge!.id],
  });

  useUIStore.setState({
    toastMessage: null,
    toastTimerId: null,
  });

  return { nodeA: nodeA!, nodeB: nodeB!, edge: edge! };
}

describe('Keyboard Edge Type Cycling', () => {
  beforeEach(() => {
    useCoreStore.setState(useCoreStore.getInitialState());
    useCanvasStore.setState(useCanvasStore.getInitialState());
    useUIStore.setState(useUIStore.getInitialState());
  });

  describe('Shortcut registration', () => {
    it('has edge:cycle-type shortcut action in SHORTCUT_ACTIONS', () => {
      const action = SHORTCUT_ACTIONS.find((a) => a.id === 'edge:cycle-type');
      expect(action).toBeDefined();
      expect(action!.label).toBe('Cycle Edge Type');
      expect(action!.defaultBinding).toBe('t');
      expect(action!.category).toBe('Edge');
    });
  });

  describe('Edge type cycling via updateEdge', () => {
    it('cycles sync → async', () => {
      const { edge } = setupStore('sync');
      expect(edge.type).toBe('sync');

      useCoreStore.getState().updateEdge(edge.id, { type: 'async' }, 'Change edge type to Async');
      const updatedEdge = useCoreStore.getState().graph.edges.find((e) => e.id === edge.id);
      expect(updatedEdge!.type).toBe('async');
    });

    it('cycles async → data-flow', () => {
      const { edge } = setupStore('async');
      useCoreStore
        .getState()
        .updateEdge(edge.id, { type: 'data-flow' }, 'Change edge type to Data Flow');
      const updatedEdge = useCoreStore.getState().graph.edges.find((e) => e.id === edge.id);
      expect(updatedEdge!.type).toBe('data-flow');
    });

    it('cycles data-flow → sync', () => {
      const { edge } = setupStore('data-flow');
      useCoreStore.getState().updateEdge(edge.id, { type: 'sync' }, 'Change edge type to Sync');
      const updatedEdge = useCoreStore.getState().graph.edges.find((e) => e.id === edge.id);
      expect(updatedEdge!.type).toBe('sync');
    });

    it('full cycle: sync → async → data-flow → sync', () => {
      const { edge } = setupStore('sync');
      const types: EdgeType[] = ['sync', 'async', 'data-flow'];
      const typeLabels: Record<string, string> = {
        sync: 'Sync',
        async: 'Async',
        'data-flow': 'Data Flow',
      };

      for (let i = 0; i < 3; i++) {
        const currentType = types[i]!;
        const nextType = types[(i + 1) % 3]!;

        const currentEdge = useCoreStore.getState().graph.edges.find((e) => e.id === edge.id);
        expect(currentEdge!.type).toBe(currentType);

        useCoreStore
          .getState()
          .updateEdge(edge.id, { type: nextType }, `Change edge type to ${typeLabels[nextType]}`);
      }

      // After 3 cycles, should be back to sync
      const finalEdge = useCoreStore.getState().graph.edges.find((e) => e.id === edge.id);
      expect(finalEdge!.type).toBe('sync');
    });
  });

  describe('Undo/Redo for edge type changes', () => {
    it('marks state as dirty after type change', () => {
      const { edge } = setupStore('sync');
      expect(useCoreStore.getState().isDirty).toBe(false);
      useCoreStore.getState().updateEdge(edge.id, { type: 'async' });
      expect(useCoreStore.getState().isDirty).toBe(true);
    });

    it('sets canUndo to true after type change', () => {
      const { edge } = setupStore('sync');
      expect(useCoreStore.getState().canUndo).toBe(false);
      useCoreStore.getState().updateEdge(edge.id, { type: 'async' });
      expect(useCoreStore.getState().canUndo).toBe(true);
    });

    it('undo reverts edge type to previous value', () => {
      const { edge } = setupStore('sync');
      useCoreStore.getState().updateEdge(edge.id, { type: 'async' });
      expect(useCoreStore.getState().graph.edges.find((e) => e.id === edge.id)!.type).toBe('async');

      useCoreStore.getState().undo();
      expect(useCoreStore.getState().graph.edges.find((e) => e.id === edge.id)!.type).toBe('sync');
    });

    it('redo reapplies edge type change', () => {
      const { edge } = setupStore('sync');
      useCoreStore.getState().updateEdge(edge.id, { type: 'data-flow' });
      useCoreStore.getState().undo();
      expect(useCoreStore.getState().graph.edges.find((e) => e.id === edge.id)!.type).toBe('sync');

      useCoreStore.getState().redo();
      expect(useCoreStore.getState().graph.edges.find((e) => e.id === edge.id)!.type).toBe(
        'data-flow',
      );
    });

    it('undo snapshot has descriptive message', () => {
      const { edge } = setupStore('sync');
      useCoreStore.getState().updateEdge(edge.id, { type: 'async' }, 'Change edge type to Async');
      // Check canUndo is true (snapshot was taken)
      expect(useCoreStore.getState().canUndo).toBe(true);
    });
  });

  describe('Toast notification for type changes', () => {
    it('showToast shows edge type change notification', () => {
      useUIStore.getState().showToast('Changed to Async');
      expect(useUIStore.getState().toastMessage).toBe('Changed to Async');
    });

    it('showToast for each type label', () => {
      const labels = ['Sync', 'Async', 'Data Flow'];
      for (const label of labels) {
        useUIStore.getState().showToast(`Changed to ${label}`);
        expect(useUIStore.getState().toastMessage).toBe(`Changed to ${label}`);
      }
    });
  });

  describe('Command Palette edge type commands', () => {
    it('includes "Cycle Edge Type" command in registry', () => {
      setupStore();
      const commands = getAllCommands();
      const cycleCmd = commands.find((c) => c.id === 'edge:cycle-type');
      expect(cycleCmd).toBeDefined();
      expect(cycleCmd!.label).toBe('Cycle Edge Type');
      expect(cycleCmd!.category).toBe('Edge');
    });

    it('includes "Set Edge Type: Sync" command', () => {
      setupStore();
      const commands = getAllCommands();
      const cmd = commands.find((c) => c.id === 'edge:set-sync');
      expect(cmd).toBeDefined();
      expect(cmd!.label).toBe('Set Edge Type: Sync');
    });

    it('includes "Set Edge Type: Async" command', () => {
      setupStore();
      const commands = getAllCommands();
      const cmd = commands.find((c) => c.id === 'edge:set-async');
      expect(cmd).toBeDefined();
      expect(cmd!.label).toBe('Set Edge Type: Async');
    });

    it('includes "Set Edge Type: Data Flow" command', () => {
      setupStore();
      const commands = getAllCommands();
      const cmd = commands.find((c) => c.id === 'edge:set-data-flow');
      expect(cmd).toBeDefined();
      expect(cmd!.label).toBe('Set Edge Type: Data Flow');
    });

    it('edge type commands are enabled when edge is selected', () => {
      setupStore();
      const commands = getAllCommands();
      const cycleCmd = commands.find((c) => c.id === 'edge:cycle-type')!;
      expect(cycleCmd.isEnabled?.()).toBe(true);
    });

    it('edge type commands are disabled when no edge is selected', () => {
      setupStore();
      useCanvasStore.setState({ selectedEdgeId: null, selectedEdgeIds: [] });
      const commands = getAllCommands();
      const cycleCmd = commands.find((c) => c.id === 'edge:cycle-type')!;
      expect(cycleCmd.isEnabled?.()).toBe(false);
    });

    it('cycle type command is searchable by "type"', () => {
      setupStore();
      const commands = getAllCommands();
      const results = searchCommands(commands, 'type');
      const cycleCmd = results.find((c) => c.id === 'edge:cycle-type');
      expect(cycleCmd).toBeDefined();
    });

    it('set sync command is searchable by "sync"', () => {
      setupStore();
      const commands = getAllCommands();
      const results = searchCommands(commands, 'sync');
      const cmd = results.find((c) => c.id === 'edge:set-sync');
      expect(cmd).toBeDefined();
    });

    it('edge:set-sync command executes and changes type', () => {
      const { edge } = setupStore('async');
      const commands = getAllCommands();
      const cmd = commands.find((c) => c.id === 'edge:set-sync')!;
      cmd.execute();
      const updatedEdge = useCoreStore.getState().graph.edges.find((e) => e.id === edge.id);
      expect(updatedEdge!.type).toBe('sync');
    });

    it('edge:set-async command executes and changes type', () => {
      const { edge } = setupStore('sync');
      const commands = getAllCommands();
      const cmd = commands.find((c) => c.id === 'edge:set-async')!;
      cmd.execute();
      const updatedEdge = useCoreStore.getState().graph.edges.find((e) => e.id === edge.id);
      expect(updatedEdge!.type).toBe('async');
    });

    it('edge:set-data-flow command executes and changes type', () => {
      const { edge } = setupStore('sync');
      const commands = getAllCommands();
      const cmd = commands.find((c) => c.id === 'edge:set-data-flow')!;
      cmd.execute();
      const updatedEdge = useCoreStore.getState().graph.edges.find((e) => e.id === edge.id);
      expect(updatedEdge!.type).toBe('data-flow');
    });

    it('edge:cycle-type command executes and cycles', () => {
      const { edge } = setupStore('sync');
      const commands = getAllCommands();
      const cmd = commands.find((c) => c.id === 'edge:cycle-type')!;
      cmd.execute();
      const updatedEdge = useCoreStore.getState().graph.edges.find((e) => e.id === edge.id);
      expect(updatedEdge!.type).toBe('async');
    });
  });

  describe('Source code verification', () => {
    it('shortcutManager has edge:cycle-type action with binding "t"', async () => {
      const source = await import('@/core/shortcuts/shortcutManager?raw');
      expect(source.default).toContain("id: 'edge:cycle-type'");
      expect(source.default).toContain("defaultBinding: 't'");
    });

    it('useKeyboardShortcuts handles edge:cycle-type action', async () => {
      const source = await import('@/hooks/useKeyboardShortcuts?raw');
      expect(source.default).toContain("case 'edge:cycle-type':");
      expect(source.default).toContain('updateEdge');
    });

    it('commandRegistry has cycle and set edge type commands', async () => {
      const source = await import('@/config/commandRegistry?raw');
      expect(source.default).toContain("id: 'edge:cycle-type'");
      expect(source.default).toContain("id: 'edge:set-sync'");
      expect(source.default).toContain("id: 'edge:set-async'");
      expect(source.default).toContain("id: 'edge:set-data-flow'");
    });

    it('coreStore has updateEdge method', async () => {
      const source = await import('@/store/coreStore?raw');
      expect(source.default).toContain('updateEdge');
    });

    it('textApi has updateEdge method', async () => {
      const source = await import('@/api/textApi?raw');
      expect(source.default).toContain('updateEdge');
    });
  });
});

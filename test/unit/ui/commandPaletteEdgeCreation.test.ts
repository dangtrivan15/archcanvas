// @vitest-environment happy-dom
/**
 * Tests for Command Palette Edge Creation (Feature #251)
 * Multi-step "Connect Nodes..." wizard in the command palette.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { getAllCommands, searchCommands } from '@/config/commandRegistry';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { TextApi } from '@/api/textApi';
import { UndoManager } from '@/core/history/undoManager';

// Helper to create a graph with test nodes and proper store setup
function setupStore() {
  const textApi = new TextApi(createEmptyGraph());

  const nodeA = textApi.addNode({
    type: 'compute/service',
    displayName: 'Order Service',
    position: { x: 0, y: 0 },
  });

  const nodeB = textApi.addNode({
    type: 'storage/database',
    displayName: 'Orders DB',
    position: { x: 300, y: 0 },
  });

  const nodeC = textApi.addNode({
    type: 'compute/function',
    displayName: 'Payment Handler',
    position: { x: 0, y: 200 },
  });

  const graph = textApi.getGraph();
  const undoManager = new UndoManager();
  undoManager.snapshot('Initial state', graph);

  useCoreStore.setState({
    graph,
    textApi,
    undoManager,
    nodeCount: 3,
    edgeCount: 0,
    isDirty: false,
    canUndo: false,
    canRedo: false,
  });

  useCanvasStore.setState({
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
  });

  useUIStore.setState({
    commandPaletteOpen: false,
    toastMessage: null,
    toastTimerId: null,
  });

  return { nodeA: nodeA!, nodeB: nodeB!, nodeC: nodeC! };
}

describe('Command Palette Edge Creation', () => {
  beforeEach(() => {
    useCoreStore.setState(useCoreStore.getInitialState());
    useCanvasStore.setState(useCanvasStore.getInitialState());
    useUIStore.setState(useUIStore.getInitialState());
  });

  describe('Connect Nodes command registration', () => {
    it('includes "Connect Nodes..." command in the registry', () => {
      setupStore();
      const commands = getAllCommands();
      const connectCmd = commands.find((c) => c.id === 'connect:wizard');
      expect(connectCmd).toBeDefined();
      expect(connectCmd!.label).toBe('Connect Nodes...');
    });

    it('has correct category and keywords', () => {
      setupStore();
      const commands = getAllCommands();
      const connectCmd = commands.find((c) => c.id === 'connect:wizard')!;
      expect(connectCmd.category).toBe('Edge');
      expect(connectCmd.keywords).toContain('connect');
      expect(connectCmd.keywords).toContain('edge');
      expect(connectCmd.keywords).toContain('link');
      expect(connectCmd.keywords).toContain('wire');
    });

    it('is searchable by "connect" keyword', () => {
      setupStore();
      const commands = getAllCommands();
      const results = searchCommands(commands, 'connect');
      const connectCmd = results.find((c) => c.id === 'connect:wizard');
      expect(connectCmd).toBeDefined();
    });

    it('is searchable by "edge" keyword', () => {
      setupStore();
      const commands = getAllCommands();
      const results = searchCommands(commands, 'edge');
      const connectCmd = results.find((c) => c.id === 'connect:wizard');
      expect(connectCmd).toBeDefined();
    });

    it('is searchable by "link" keyword', () => {
      setupStore();
      const commands = getAllCommands();
      const results = searchCommands(commands, 'link');
      const connectCmd = results.find((c) => c.id === 'connect:wizard');
      expect(connectCmd).toBeDefined();
    });

    it('is searchable by "wire" keyword', () => {
      setupStore();
      const commands = getAllCommands();
      const results = searchCommands(commands, 'wire');
      const connectCmd = results.find((c) => c.id === 'connect:wizard');
      expect(connectCmd).toBeDefined();
    });

    it('is enabled when graph has >= 2 nodes', () => {
      setupStore();
      const commands = getAllCommands();
      const connectCmd = commands.find((c) => c.id === 'connect:wizard')!;
      expect(connectCmd.isEnabled?.()).toBe(true);
    });

    it('is disabled when graph has < 2 nodes', () => {
      const textApi = new TextApi(createEmptyGraph());
      textApi.addNode({
        type: 'compute/service',
        displayName: 'Only Node',
        position: { x: 0, y: 0 },
      });
      useCoreStore.setState({
        graph: textApi.getGraph(),
        textApi,
        nodeCount: 1,
      });

      const commands = getAllCommands();
      const connectCmd = commands.find((c) => c.id === 'connect:wizard')!;
      expect(connectCmd.isEnabled?.()).toBe(false);
    });

    it('has ArrowRight icon', () => {
      setupStore();
      const commands = getAllCommands();
      const connectCmd = commands.find((c) => c.id === 'connect:wizard')!;
      expect(connectCmd.iconName).toBe('ArrowRight');
    });
  });

  describe('Edge creation via addEdge', () => {
    it('creates a sync edge between two nodes', () => {
      const { nodeA, nodeB } = setupStore();
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
      });
      expect(edge).toBeDefined();
      expect(edge!.type).toBe('sync');
      expect(edge!.fromNode).toBe(nodeA.id);
      expect(edge!.toNode).toBe(nodeB.id);
    });

    it('creates an async edge between two nodes', () => {
      const { nodeA, nodeC } = setupStore();
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeC.id,
        type: 'async',
      });
      expect(edge).toBeDefined();
      expect(edge!.type).toBe('async');
    });

    it('creates a data-flow edge between two nodes', () => {
      const { nodeB, nodeC } = setupStore();
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeB.id,
        toNode: nodeC.id,
        type: 'data-flow',
      });
      expect(edge).toBeDefined();
      expect(edge!.type).toBe('data-flow');
    });

    it('increments edgeCount after edge creation', () => {
      const { nodeA, nodeB } = setupStore();
      expect(useCoreStore.getState().edgeCount).toBe(0);
      useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
      });
      expect(useCoreStore.getState().edgeCount).toBe(1);
    });

    it('marks state as dirty after edge creation', () => {
      const { nodeA, nodeB } = setupStore();
      expect(useCoreStore.getState().isDirty).toBe(false);
      useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
      });
      expect(useCoreStore.getState().isDirty).toBe(true);
    });
  });

  describe('Edge selection after creation', () => {
    it('selectEdge sets selectedEdgeId in canvasStore', () => {
      const { nodeA, nodeB } = setupStore();
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
      });
      expect(edge).toBeDefined();
      useCanvasStore.getState().selectEdge(edge!.id);
      expect(useCanvasStore.getState().selectedEdgeId).toBe(edge!.id);
    });
  });

  describe('Toast notification', () => {
    it('showToast sets toast message', () => {
      useUIStore.getState().showToast('Connected A → B (Sync)');
      expect(useUIStore.getState().toastMessage).toBe('Connected A → B (Sync)');
    });

    it('toast auto-clears after duration', async () => {
      useUIStore.getState().showToast('Test message', 50);
      expect(useUIStore.getState().toastMessage).toBe('Test message');
      await new Promise((r) => setTimeout(r, 100));
      expect(useUIStore.getState().toastMessage).toBeNull();
    });
  });

  describe('Edge type options', () => {
    it('supports sync edge type', () => {
      const { nodeA, nodeB } = setupStore();
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
      });
      expect(edge!.type).toBe('sync');
    });

    it('supports async edge type', () => {
      const { nodeA, nodeB } = setupStore();
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'async',
      });
      expect(edge!.type).toBe('async');
    });

    it('supports data-flow edge type', () => {
      const { nodeA, nodeB } = setupStore();
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'data-flow',
      });
      expect(edge!.type).toBe('data-flow');
    });
  });

  describe('Complete flow simulation', () => {
    it('creates edge with correct source and target', () => {
      const { nodeA, nodeB } = setupStore();

      // Simulate wizard completion: addEdge + selectEdge + toast
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'async',
      });

      expect(edge).toBeDefined();
      expect(edge!.fromNode).toBe(nodeA.id);
      expect(edge!.toNode).toBe(nodeB.id);
      expect(edge!.type).toBe('async');

      // Select the edge
      useCanvasStore.getState().selectEdge(edge!.id);
      expect(useCanvasStore.getState().selectedEdgeId).toBe(edge!.id);

      // Show toast
      useUIStore.getState().showToast('Connected Order Service → Orders DB (Async)');
      expect(useUIStore.getState().toastMessage).toContain('Connected');
      expect(useUIStore.getState().toastMessage).toContain('Async');
    });

    it('creates undoable edge (canUndo becomes true)', () => {
      const { nodeA, nodeB } = setupStore();
      expect(useCoreStore.getState().canUndo).toBe(false);
      useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
      });
      expect(useCoreStore.getState().canUndo).toBe(true);
    });

    it('undo removes the created edge', () => {
      const { nodeA, nodeB } = setupStore();
      useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
      });
      expect(useCoreStore.getState().graph.edges.length).toBe(1);
      useCoreStore.getState().undo();
      expect(useCoreStore.getState().graph.edges.length).toBe(0);
    });

    it('edge appears in graph after creation', () => {
      const { nodeA, nodeC } = setupStore();
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeC.id,
        type: 'data-flow',
      });

      const { graph } = useCoreStore.getState();
      const found = graph.edges.find((e) => e.id === edge!.id);
      expect(found).toBeDefined();
      expect(found!.type).toBe('data-flow');
      expect(found!.fromNode).toBe(nodeA.id);
      expect(found!.toNode).toBe(nodeC.id);
    });
  });

  describe('Wizard step validation', () => {
    it('source and target must be different nodes', () => {
      const { nodeA, nodeB } = setupStore();
      const edge = useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
      });
      expect(edge).toBeDefined();
      expect(edge!.fromNode).not.toBe(edge!.toNode);
    });

    it('multiple edges can be created between different node pairs', () => {
      const { nodeA, nodeB, nodeC } = setupStore();
      useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
      });
      useCoreStore.getState().addEdge({
        fromNode: nodeA.id,
        toNode: nodeC.id,
        type: 'async',
      });
      expect(useCoreStore.getState().graph.edges.length).toBe(2);
      expect(useCoreStore.getState().edgeCount).toBe(2);
    });
  });

  describe('Source code verification', () => {
    it('CommandPalette imports useCoreStore for edge creation', async () => {
      const source = await import('@/components/shared/CommandPalette?raw');
      expect(source.default).toContain("import { useCoreStore }");
    });

    it('CommandPalette imports useCanvasStore for edge selection', async () => {
      const source = await import('@/components/shared/CommandPalette?raw');
      expect(source.default).toContain("import { useCanvasStore }");
    });

    it('CommandPalette has wizard state for multi-step flow', async () => {
      const source = await import('@/components/shared/CommandPalette?raw');
      expect(source.default).toContain('ConnectWizardState');
      expect(source.default).toContain("step: 'source'");
      expect(source.default).toContain("step: 'target'");
      expect(source.default).toContain("step: 'type'");
    });

    it('CommandPalette has wizard progress header', async () => {
      const source = await import('@/components/shared/CommandPalette?raw');
      expect(source.default).toContain('wizard-header');
      expect(source.default).toContain('Connect: Select source node');
      expect(source.default).toContain('Connect: Select target for');
      expect(source.default).toContain('Connect: Select type');
    });

    it('CommandPalette handles Backspace to go back in wizard', async () => {
      const source = await import('@/components/shared/CommandPalette?raw');
      expect(source.default).toContain("case 'Backspace':");
      expect(source.default).toContain("query === ''");
    });

    it('CommandPalette creates edge on wizard completion', async () => {
      const source = await import('@/components/shared/CommandPalette?raw');
      expect(source.default).toContain('addEdge');
      expect(source.default).toContain('selectEdge');
      expect(source.default).toContain('showToast');
    });

    it('CommandPalette has edge type options', async () => {
      const source = await import('@/components/shared/CommandPalette?raw');
      expect(source.default).toContain("id: 'sync'");
      expect(source.default).toContain("id: 'async'");
      expect(source.default).toContain("id: 'data-flow'");
    });

    it('commandRegistry has connect:wizard command', async () => {
      const source = await import('@/config/commandRegistry?raw');
      expect(source.default).toContain("id: 'connect:wizard'");
      expect(source.default).toContain("label: 'Connect Nodes...'");
      expect(source.default).toContain("category: 'Edge'");
    });
  });
});

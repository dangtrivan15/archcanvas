/**
 * Tests for Command Palette Node Creation feature.
 *
 * The command palette supports creating nodes: typing 'add', 'new', or 'create'
 * shows all available node types from the NodeDef registry. Selecting a type
 * creates the node at viewport center (or near selected node). After placing,
 * node is selected and rename activates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getNodeCreationCommands, getAllCommands, searchCommands } from '@/config/commandRegistry';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import type { ArchNode } from '@/types/graph';

function resetStores() {
  useCoreStore.getState().initialize();
  useCanvasStore.setState({
    selectedNodeId: null,
    selectedEdgeId: null,
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  useUIStore.setState({
    rightPanelOpen: false,
    rightPanelTab: 'properties',
    pendingRenameNodeId: null,
    commandPaletteOpen: false,
  });
  useNavigationStore.setState({
    path: [],
  });
}

describe('Command Palette Node Creation - getNodeCreationCommands', () => {
  beforeEach(resetStores);

  it('returns commands from the NodeDef registry', () => {
    const commands = getNodeCreationCommands();
    expect(commands.length).toBeGreaterThan(0);
  });

  it('creates one command per NodeDef type', () => {
    const { registry } = useCoreStore.getState();
    if (!registry) return;
    const types = registry.listAll();
    const commands = getNodeCreationCommands();
    expect(commands.length).toBe(types.length);
  });

  it('each command has "Add {displayName}" label', () => {
    const commands = getNodeCreationCommands();
    for (const cmd of commands) {
      expect(cmd.label).toMatch(/^Add .+/);
    }
  });

  it('each command has id starting with "create:"', () => {
    const commands = getNodeCreationCommands();
    for (const cmd of commands) {
      expect(cmd.id).toMatch(/^create:/);
    }
  });

  it('each command has Node category', () => {
    const commands = getNodeCreationCommands();
    for (const cmd of commands) {
      expect(cmd.category).toBe('Node');
    }
  });

  it('each command has add/new/create as keywords', () => {
    const commands = getNodeCreationCommands();
    for (const cmd of commands) {
      expect(cmd.keywords).toContain('add');
      expect(cmd.keywords).toContain('new');
      expect(cmd.keywords).toContain('create');
      expect(cmd.keywords).toContain('node');
    }
  });

  it('commands include displayName as a keyword', () => {
    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service');
    expect(serviceCmd).toBeDefined();
    expect(serviceCmd!.keywords).toContain('service');
  });

  it('commands have icon names from NodeDef metadata', () => {
    const commands = getNodeCreationCommands();
    // At least some commands should have icons
    const withIcons = commands.filter((c) => c.iconName);
    expect(withIcons.length).toBeGreaterThan(0);
  });
});

describe('Command Palette Node Creation - Search Keywords', () => {
  beforeEach(resetStores);

  it('searching "add" returns node creation commands', () => {
    const allCommands = getAllCommands();
    const results = searchCommands(allCommands, 'add');
    const createCmds = results.filter((c) => c.id.startsWith('create:'));
    expect(createCmds.length).toBeGreaterThan(0);
  });

  it('searching "new" returns node creation commands', () => {
    const allCommands = getAllCommands();
    const results = searchCommands(allCommands, 'new');
    const createCmds = results.filter((c) => c.id.startsWith('create:'));
    expect(createCmds.length).toBeGreaterThan(0);
  });

  it('searching "create" returns node creation commands', () => {
    const allCommands = getAllCommands();
    const results = searchCommands(allCommands, 'create');
    const createCmds = results.filter((c) => c.id.startsWith('create:'));
    expect(createCmds.length).toBeGreaterThan(0);
  });

  it('searching "add service" finds Add Service command', () => {
    const allCommands = getAllCommands();
    const results = searchCommands(allCommands, 'add service');
    const serviceCmd = results.find((c) => c.label === 'Add Service');
    expect(serviceCmd).toBeDefined();
  });

  it('searching "add database" finds Add Database command', () => {
    const allCommands = getAllCommands();
    const results = searchCommands(allCommands, 'add database');
    const dbCmd = results.find((c) => c.label === 'Add Database');
    expect(dbCmd).toBeDefined();
  });

  it('searching "create function" finds Add Function command', () => {
    const allCommands = getAllCommands();
    const results = searchCommands(allCommands, 'create function');
    const funcCmd = results.find((c) => c.label === 'Add Function');
    expect(funcCmd).toBeDefined();
  });

  it('searching by node type namespace finds results', () => {
    const allCommands = getAllCommands();
    const results = searchCommands(allCommands, 'compute');
    const computeCmds = results.filter((c) => c.id.startsWith('create:compute/'));
    expect(computeCmds.length).toBeGreaterThan(0);
  });
});

describe('Command Palette Node Creation - Execute Command', () => {
  beforeEach(resetStores);

  it('creates a node when command is executed', () => {
    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service');
    expect(serviceCmd).toBeDefined();

    const initialNodeCount = useCoreStore.getState().graph.nodes.length;
    serviceCmd!.execute();
    const newNodeCount = useCoreStore.getState().graph.nodes.length;
    expect(newNodeCount).toBe(initialNodeCount + 1);
  });

  it('created node has the correct type', () => {
    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service');
    serviceCmd!.execute();

    const nodes = useCoreStore.getState().graph.nodes;
    const newNode = nodes[nodes.length - 1];
    expect(newNode.type).toBe('compute/service');
  });

  it('created node has the displayName from NodeDef', () => {
    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service');
    serviceCmd!.execute();

    const nodes = useCoreStore.getState().graph.nodes;
    const newNode = nodes[nodes.length - 1];
    expect(newNode.displayName).toBe('Service');
  });

  it('selects the new node after creation', () => {
    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service');
    serviceCmd!.execute();

    const nodes = useCoreStore.getState().graph.nodes;
    const newNode = nodes[nodes.length - 1];
    expect(useCanvasStore.getState().selectedNodeId).toBe(newNode.id);
  });

  it('opens right panel in properties tab after creation', () => {
    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service');
    serviceCmd!.execute();

    expect(useUIStore.getState().rightPanelOpen).toBe(true);
    expect(useUIStore.getState().rightPanelTab).toBe('properties');
  });

  it('triggers rename mode after creation', () => {
    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service');
    serviceCmd!.execute();

    const nodes = useCoreStore.getState().graph.nodes;
    const newNode = nodes[nodes.length - 1];
    expect(useUIStore.getState().pendingRenameNodeId).toBe(newNode.id);
  });

  it('places node at viewport center when no node selected', () => {
    useCanvasStore.setState({
      selectedNodeId: null,
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service');
    serviceCmd!.execute();

    const nodes = useCoreStore.getState().graph.nodes;
    const newNode = nodes[nodes.length - 1];
    // Node should be at or near viewport center
    expect(newNode.position.x).toBeGreaterThan(0);
    expect(newNode.position.y).toBeGreaterThan(0);
  });

  it('places node offset from selected node when one is selected', () => {
    // Create a first node
    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service')!;
    serviceCmd.execute();

    const firstNode = useCoreStore.getState().graph.nodes[0];
    const firstX = firstNode.position.x;
    const firstY = firstNode.position.y;

    // The first node should be selected, now create another
    const dbCmd = commands.find((c) => c.label === 'Add Database')!;
    dbCmd.execute();

    const nodes = useCoreStore.getState().graph.nodes;
    const secondNode = nodes[nodes.length - 1];
    // Second node should be offset to the right (+300) from first
    expect(secondNode.position.x).toBe(firstX + 300);
    expect(secondNode.position.y).toBe(firstY);
  });
});

describe('Command Palette Node Creation - Nested Navigation', () => {
  beforeEach(resetStores);

  it('creates node with parentId when inside a group (nested navigation)', () => {
    // First, create a parent node at root level
    const commands = getNodeCreationCommands();
    const workerCmd = commands.find((c) => c.label === 'Add Worker')!;
    workerCmd.execute();

    const parentNode = useCoreStore.getState().graph.nodes.find(
      (n) => n.type === 'compute/worker'
    );
    expect(parentNode).toBeDefined();

    // Simulate navigating into the parent node
    useNavigationStore.setState({ path: [parentNode!.id] });

    // Now create a child node inside the parent
    const serviceCmd = commands.find((c) => c.label === 'Add Service')!;
    serviceCmd.execute();

    // The child node should be selected
    const selectedId = useCanvasStore.getState().selectedNodeId;
    expect(selectedId).toBeTruthy();

    // Find the parent node again - it should have a child now
    const updatedParent = useCoreStore.getState().graph.nodes.find(
      (n) => n.id === parentNode!.id
    );
    expect(updatedParent).toBeDefined();
    expect(updatedParent!.children.length).toBeGreaterThan(0);
    expect(updatedParent!.children[0].type).toBe('compute/service');
  });

  it('creates node at root when navigation path is empty', () => {
    useNavigationStore.setState({ path: [] });

    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service')!;
    serviceCmd.execute();

    const nodes = useCoreStore.getState().graph.nodes;
    expect(nodes.length).toBeGreaterThan(0);
  });
});

describe('Command Palette Node Creation - Integration with getAllCommands', () => {
  beforeEach(resetStores);

  it('node creation commands are included in getAllCommands', () => {
    const allCommands = getAllCommands();
    const createCmds = allCommands.filter((c) => c.id.startsWith('create:'));
    expect(createCmds.length).toBeGreaterThan(0);
  });

  it('specific node types are available: Service, Function, Database', () => {
    const commands = getNodeCreationCommands();
    const labels = commands.map((c) => c.label);
    expect(labels).toContain('Add Service');
    expect(labels).toContain('Add Function');
    expect(labels).toContain('Add Database');
  });

  it('specific node types are available: Message Queue, Cache, Worker', () => {
    const commands = getNodeCreationCommands();
    const labels = commands.map((c) => c.label);
    expect(labels).toContain('Add Message Queue');
    expect(labels).toContain('Add Cache');
    expect(labels).toContain('Add Worker');
  });

  it('multiple node creations produce unique IDs', () => {
    const commands = getNodeCreationCommands();
    const serviceCmd = commands.find((c) => c.label === 'Add Service')!;

    serviceCmd.execute();
    const node1 = useCoreStore.getState().graph.nodes[0];

    serviceCmd.execute();
    const nodes = useCoreStore.getState().graph.nodes;
    const node2 = nodes[nodes.length - 1];

    expect(node1.id).not.toBe(node2.id);
  });
});

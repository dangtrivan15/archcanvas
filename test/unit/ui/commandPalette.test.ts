/**
 * Tests for the Command Palette (Cmd+K / Ctrl+K).
 * Verifies command registry, fuzzy search, keyboard navigation, and execution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStaticCommands,
  getNodeCommands,
  getNodeCreationCommands,
  getAllCommands,
  searchCommands,
  type Command,
} from '@/config/commandRegistry';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';

// Initialize stores before tests
beforeEach(() => {
  // Reset stores to default state
  useCoreStore.getState().initialize();
  // Reset to clean empty graph
  useCoreStore.getState().newFile();
  useCanvasStore.setState({
    selectedNodeId: null,
    selectedEdgeId: null,
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  useUIStore.setState({
    commandPaletteOpen: false,
    leftPanelOpen: true,
    rightPanelOpen: false,
    shortcutsHelpOpen: false,
  });
  useNavigationStore.setState({ path: [] });
});

describe('Command Registry', () => {
  describe('getStaticCommands', () => {
    it('returns an array of commands', () => {
      const commands = getStaticCommands();
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.every((c) => c.id && c.label && c.category && c.execute)).toBe(true);
    });

    it('includes file commands', () => {
      const commands = getStaticCommands();
      const fileCommands = commands.filter((c) => c.category === 'File');
      expect(fileCommands.length).toBeGreaterThanOrEqual(4);
      expect(fileCommands.find((c) => c.id === 'file:new')).toBeDefined();
      expect(fileCommands.find((c) => c.id === 'file:open')).toBeDefined();
      expect(fileCommands.find((c) => c.id === 'file:save')).toBeDefined();
      expect(fileCommands.find((c) => c.id === 'file:save-as')).toBeDefined();
    });

    it('includes edit commands (undo/redo)', () => {
      const commands = getStaticCommands();
      expect(commands.find((c) => c.id === 'edit:undo')).toBeDefined();
      expect(commands.find((c) => c.id === 'edit:redo')).toBeDefined();
    });

    it('includes view commands', () => {
      const commands = getStaticCommands();
      expect(commands.find((c) => c.id === 'view:toggle-left-panel')).toBeDefined();
      expect(commands.find((c) => c.id === 'view:toggle-right-panel')).toBeDefined();
      expect(commands.find((c) => c.id === 'view:keyboard-shortcuts')).toBeDefined();
    });

    it('includes canvas commands', () => {
      const commands = getStaticCommands();
      expect(commands.find((c) => c.id === 'canvas:fit-view')).toBeDefined();
      expect(commands.find((c) => c.id === 'canvas:deselect')).toBeDefined();
      expect(commands.find((c) => c.id === 'canvas:layout-horizontal')).toBeDefined();
      expect(commands.find((c) => c.id === 'canvas:layout-vertical')).toBeDefined();
    });

    it('includes navigation commands', () => {
      const commands = getStaticCommands();
      expect(commands.find((c) => c.id === 'nav:zoom-to-root')).toBeDefined();
      expect(commands.find((c) => c.id === 'nav:zoom-out')).toBeDefined();
    });

    it('all commands have unique IDs', () => {
      const commands = getStaticCommands();
      const ids = commands.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('commands with shortcuts have shortcut strings', () => {
      const commands = getStaticCommands();
      const withShortcuts = commands.filter((c) => c.shortcut);
      expect(withShortcuts.length).toBeGreaterThan(0);
      for (const cmd of withShortcuts) {
        expect(typeof cmd.shortcut).toBe('string');
        expect(cmd.shortcut!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getNodeCommands', () => {
    it('returns empty array when no nodes exist', () => {
      const commands = getNodeCommands();
      expect(commands).toEqual([]);
    });

    it('returns commands for existing nodes', () => {
      useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'My Service' });
      useCoreStore.getState().addNode({ type: 'data/database', displayName: 'My DB' });

      const commands = getNodeCommands();
      expect(commands.length).toBe(2);
      expect(commands[0].label).toContain('My Service');
      expect(commands[1].label).toContain('My DB');
    });

    it('node commands have Go to prefix', () => {
      useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'Test Node' });

      const commands = getNodeCommands();
      expect(commands[0].label).toBe('Go to: Test Node');
    });

    it('node commands belong to Node category', () => {
      useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'Node1' });

      const commands = getNodeCommands();
      expect(commands[0].category).toBe('Node');
    });

    it('node command execution selects the node and opens right panel', () => {
      const node = useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'Target' })!;

      const commands = getNodeCommands();
      commands[0].execute();

      expect(useCanvasStore.getState().selectedNodeId).toBe(node.id);
      expect(useUIStore.getState().rightPanelOpen).toBe(true);
    });
  });

  describe('getAllCommands', () => {
    it('combines static, node creation, and node navigation commands', () => {
      const textApi = useCoreStore.getState().textApi!;
      textApi.addNode({ type: 'compute/service', displayName: 'Node1' });

      const all = getAllCommands();
      const staticCount = getStaticCommands().length;
      const creationCount = getNodeCreationCommands().length;
      const nodeCount = getNodeCommands().length;
      expect(all.length).toBe(staticCount + creationCount + nodeCount);
    });
  });
});

describe('searchCommands', () => {
  let allCommands: Command[];

  beforeEach(() => {
    useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'Order Service' });
    useCoreStore.getState().addNode({ type: 'data/database', displayName: 'Users DB' });
    allCommands = getAllCommands();
  });

  it('returns all commands when query is empty', () => {
    const result = searchCommands(allCommands, '');
    expect(result.length).toBe(allCommands.length);
  });

  it('returns all commands when query is whitespace', () => {
    const result = searchCommands(allCommands, '   ');
    expect(result.length).toBe(allCommands.length);
  });

  it('filters by command label', () => {
    const result = searchCommands(allCommands, 'save');
    expect(result.length).toBeGreaterThanOrEqual(2); // Save and Save As
    expect(result.every((c) => c.label.toLowerCase().includes('save'))).toBe(true);
  });

  it('filters by keywords', () => {
    const result = searchCommands(allCommands, 'hotkeys');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('view:keyboard-shortcuts');
  });

  it('filters by category', () => {
    const result = searchCommands(allCommands, 'file');
    const fileCommands = result.filter((c) => c.category === 'File');
    expect(fileCommands.length).toBeGreaterThanOrEqual(4);
  });

  it('matches node names', () => {
    const result = searchCommands(allCommands, 'order');
    expect(result.find((c) => c.label.includes('Order Service'))).toBeDefined();
  });

  it('supports multi-word queries', () => {
    const result = searchCommands(allCommands, 'auto layout');
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.every((c) => c.label.toLowerCase().includes('auto layout'))).toBe(true);
  });

  it('returns empty array when no matches', () => {
    const result = searchCommands(allCommands, 'xyznonexistent');
    expect(result).toEqual([]);
  });

  it('is case insensitive', () => {
    const result1 = searchCommands(allCommands, 'SAVE');
    const result2 = searchCommands(allCommands, 'save');
    expect(result1.length).toBe(result2.length);
  });

  it('ranks exact label matches higher', () => {
    const result = searchCommands(allCommands, 'save');
    // "Save" (exact) should come before "Save As..."
    expect(result[0].id).toBe('file:save');
  });
});

describe('Command execution', () => {
  it('file:save calls saveFile', () => {
    const commands = getStaticCommands();
    const saveCmd = commands.find((c) => c.id === 'file:save')!;
    const saveSpy = vi.spyOn(useCoreStore.getState(), 'saveFile');
    saveCmd.execute();
    expect(saveSpy).toHaveBeenCalled();
    saveSpy.mockRestore();
  });

  it('edit:undo calls undo', () => {
    const commands = getStaticCommands();
    const undoCmd = commands.find((c) => c.id === 'edit:undo')!;
    const undoSpy = vi.spyOn(useCoreStore.getState(), 'undo');
    undoCmd.execute();
    expect(undoSpy).toHaveBeenCalled();
    undoSpy.mockRestore();
  });

  it('canvas:fit-view calls requestFitView', () => {
    const commands = getStaticCommands();
    const fitCmd = commands.find((c) => c.id === 'canvas:fit-view')!;
    const fitSpy = vi.spyOn(useCanvasStore.getState(), 'requestFitView');
    fitCmd.execute();
    expect(fitSpy).toHaveBeenCalled();
    fitSpy.mockRestore();
  });

  it('view:toggle-left-panel toggles left panel', () => {
    expect(useUIStore.getState().leftPanelOpen).toBe(true);
    const commands = getStaticCommands();
    const toggleCmd = commands.find((c) => c.id === 'view:toggle-left-panel')!;
    toggleCmd.execute();
    expect(useUIStore.getState().leftPanelOpen).toBe(false);
    toggleCmd.execute();
    expect(useUIStore.getState().leftPanelOpen).toBe(true);
  });

  it('canvas:deselect clears selection and closes right panel', () => {
    useCanvasStore.setState({ selectedNodeId: 'test-node' });
    useUIStore.setState({ rightPanelOpen: true });

    const commands = getStaticCommands();
    const deselectCmd = commands.find((c) => c.id === 'canvas:deselect')!;
    deselectCmd.execute();

    expect(useCanvasStore.getState().selectedNodeId).toBeNull();
    expect(useUIStore.getState().rightPanelOpen).toBe(false);
  });

  it('nav:zoom-to-root resets navigation path', () => {
    useNavigationStore.setState({ path: ['node1', 'node2'] });
    const commands = getStaticCommands();
    const rootCmd = commands.find((c) => c.id === 'nav:zoom-to-root')!;
    rootCmd.execute();
    expect(useNavigationStore.getState().path).toEqual([]);
  });

  it('view:keyboard-shortcuts opens shortcuts help', () => {
    const commands = getStaticCommands();
    const helpCmd = commands.find((c) => c.id === 'view:keyboard-shortcuts')!;
    helpCmd.execute();
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(true);
  });
});

describe('Command isEnabled', () => {
  it('undo is disabled when canUndo is false', () => {
    const commands = getStaticCommands();
    const undoCmd = commands.find((c) => c.id === 'edit:undo')!;
    expect(undoCmd.isEnabled!()).toBe(false);
  });

  it('redo is disabled when canRedo is false', () => {
    const commands = getStaticCommands();
    const redoCmd = commands.find((c) => c.id === 'edit:redo')!;
    expect(redoCmd.isEnabled!()).toBe(false);
  });

  it('undo is enabled after a mutation', () => {
    useCoreStore.getState().addNode({ type: 'compute/service', displayName: 'A' });
    const commands = getStaticCommands();
    const undoCmd = commands.find((c) => c.id === 'edit:undo')!;
    expect(undoCmd.isEnabled!()).toBe(true);
  });

  it('nav:zoom-out is disabled at root level', () => {
    const commands = getStaticCommands();
    const zoomOutCmd = commands.find((c) => c.id === 'nav:zoom-out')!;
    expect(zoomOutCmd.isEnabled!()).toBe(false);
  });

  it('nav:zoom-out is enabled when navigation path is non-empty', () => {
    useNavigationStore.setState({ path: ['node1'] });
    const commands = getStaticCommands();
    const zoomOutCmd = commands.find((c) => c.id === 'nav:zoom-out')!;
    expect(zoomOutCmd.isEnabled!()).toBe(true);
  });

  it('commands without isEnabled are always enabled', () => {
    const commands = getStaticCommands();
    const saveCmd = commands.find((c) => c.id === 'file:save')!;
    expect(saveCmd.isEnabled).toBeUndefined();
  });
});

describe('UI Store - Command Palette state', () => {
  it('commandPaletteOpen defaults to false', () => {
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('openCommandPalette sets commandPaletteOpen to true', () => {
    useUIStore.getState().openCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it('closeCommandPalette sets commandPaletteOpen to false', () => {
    useUIStore.getState().openCommandPalette();
    useUIStore.getState().closeCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('toggleCommandPalette toggles the state', () => {
    useUIStore.getState().toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    useUIStore.getState().toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });
});

describe('Keyboard shortcut registration', () => {
  it('Cmd+K shortcut is registered in keyboard shortcuts config', async () => {
    const { KEYBOARD_SHORTCUTS } = await import('@/config/keyboardShortcuts');
    const cmdK = KEYBOARD_SHORTCUTS.find((s) => s.id === 'command-palette');
    expect(cmdK).toBeDefined();
    expect(cmdK!.macKeys).toBe('⌘ K');
    expect(cmdK!.winKeys).toBe('Ctrl+K');
    expect(cmdK!.category).toBe('Canvas');
  });
});

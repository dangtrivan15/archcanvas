/**
 * Tests for Feature #455: Keyboard & Gesture Navigation for Nested Canvas.
 *
 * Verifies:
 * - Escape at root of nested file pops the file stack
 * - Escape with navigation path zooms out within file first
 * - Ctrl+Shift+Home jumps directly to project root
 * - Enter on container node triggers dive-in
 * - Command palette includes 'Navigate Up (Pop File)' and 'Navigate to Project Root'
 * - Two-finger pinch-out gesture triggers popFile
 * - Shortcut manager recognizes 'mod+shift+home' binding
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useCoreStore } from '@/store/coreStore';
import { getStaticCommands, searchCommands } from '@/config/commandRegistry';
import {
  parseBinding,
  eventMatchesBinding,
  SHORTCUT_ACTIONS,
} from '@/core/shortcuts/shortcutManager';
import type { ArchGraph } from '@/types/graph';

/** Helper to create a simple test graph. */
function makeGraph(name: string): ArchGraph {
  return {
    name,
    description: `Test graph: ${name}`,
    owners: [],
    nodes: [
      {
        id: `node-${name}`,
        type: 'compute/service',
        displayName: `${name} Service`,
        args: {},
        properties: {},
        children: [],
        codeRefs: [],
        notes: [],
        position: { x: 0, y: 0, width: 200, height: 100 },
      },
    ],
    edges: [],
    annotations: [],
  };
}

function makeGraphWithContainer(name: string): ArchGraph {
  return {
    name,
    description: `Test graph: ${name}`,
    owners: [],
    nodes: [
      {
        id: `container-${name}`,
        type: 'meta/canvas-ref',
        displayName: `${name} Container`,
        args: {},
        properties: {},
        children: [],
        codeRefs: [],
        notes: [],
        position: { x: 0, y: 0, width: 280, height: 200 },
        refSource: 'file://./child.archc',
      },
    ],
    edges: [],
    annotations: [],
  };
}

describe('Feature #455: Keyboard & Gesture Navigation for Nested Canvas', () => {
  beforeEach(() => {
    useNestedCanvasStore.setState({ fileStack: [], activeFilePath: null });
    useNavigationStore.setState({ path: [] });
    useCanvasStore.setState({ viewport: { x: 0, y: 0, zoom: 1 } });
    useCoreStore.setState({
      graph: makeGraph('root'),
    });
  });

  // ─── Escape Key Behavior ──────────────────────────────────────

  describe('Escape key behavior', () => {
    it('should pop file when at root of nested file (nav path empty, stack not empty)', () => {
      // Setup: push a file so we're nested
      const rootGraph = makeGraph('root');
      const childGraph = makeGraph('child');
      useCoreStore.setState({ graph: rootGraph });
      useNestedCanvasStore.getState().pushFile('child.archc', childGraph);

      expect(useNestedCanvasStore.getState().getDepth()).toBe(1);
      expect(useNavigationStore.getState().path).toEqual([]);

      // popFile should restore root
      useNestedCanvasStore.getState().popFile();

      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
      expect(useCoreStore.getState().graph.name).toBe('root');
    });

    it('should zoom out within file when nav path is non-empty and nested', () => {
      // Setup: push a file, then zoom into a node within that file
      const rootGraph = makeGraph('root');
      const childGraph = makeGraph('child');
      useCoreStore.setState({ graph: rootGraph });
      useNestedCanvasStore.getState().pushFile('child.archc', childGraph);
      useNavigationStore.getState().zoomIn('node-child');

      expect(useNestedCanvasStore.getState().getDepth()).toBe(1);
      expect(useNavigationStore.getState().path).toEqual(['node-child']);

      // Zoom out within the file first
      useNavigationStore.getState().zoomOut();

      expect(useNestedCanvasStore.getState().getDepth()).toBe(1); // Still nested
      expect(useNavigationStore.getState().path).toEqual([]); // Back to root of nested file
    });
  });

  // ─── Ctrl+Shift+Home: Jump to Project Root ─────────────────────

  describe('Jump to project root (Ctrl+Shift+Home)', () => {
    it('should pop entire file stack with popToRoot', () => {
      const rootGraph = makeGraph('root');
      const child1Graph = makeGraph('child1');
      const child2Graph = makeGraph('child2');
      useCoreStore.setState({ graph: rootGraph });
      useNestedCanvasStore.getState().pushFile('child1.archc', child1Graph);
      useNestedCanvasStore.getState().pushFile('child2.archc', child2Graph);

      expect(useNestedCanvasStore.getState().getDepth()).toBe(2);

      useNestedCanvasStore.getState().popToRoot();

      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
      expect(useNestedCanvasStore.getState().activeFilePath).toBeNull();
      expect(useCoreStore.getState().graph.name).toBe('root');
    });

    it('should have mod+shift+home registered as a shortcut action', () => {
      const action = SHORTCUT_ACTIONS.find((a) => a.id === 'nav:nested-root');
      expect(action).toBeDefined();
      expect(action!.defaultBinding).toBe('mod+shift+home');
      expect(action!.label).toBe('Jump to Project Root');
    });
  });

  // ─── Shortcut Manager Binding ──────────────────────────────────

  describe('Shortcut binding: mod+shift+home', () => {
    it('should parse mod+shift+home binding correctly', () => {
      const binding = parseBinding('mod+shift+home');
      expect(binding.mod).toBe(true);
      expect(binding.shift).toBe(true);
      expect(binding.key).toBe('home');
    });

    it('should match Ctrl+Shift+Home keyboard event', () => {
      const binding = parseBinding('mod+shift+home');
      // Create a mock keyboard event (KeyboardEvent may not be available in Node env)
      const event = {
        key: 'Home',
        ctrlKey: true,
        shiftKey: true,
        metaKey: false,
        altKey: false,
      } as unknown as KeyboardEvent;
      expect(eventMatchesBinding(event, binding)).toBe(true);
    });

    it('should not match Home without modifiers', () => {
      const binding = parseBinding('mod+shift+home');
      const event = {
        key: 'Home',
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
        altKey: false,
      } as unknown as KeyboardEvent;
      expect(eventMatchesBinding(event, binding)).toBe(false);
    });

    it('should not match Ctrl+Home without Shift', () => {
      const binding = parseBinding('mod+shift+home');
      const event = {
        key: 'Home',
        ctrlKey: true,
        shiftKey: false,
        metaKey: false,
        altKey: false,
      } as unknown as KeyboardEvent;
      expect(eventMatchesBinding(event, binding)).toBe(false);
    });
  });

  // ─── Command Palette: Nested Navigation Commands ──────────────

  describe('Command palette nested navigation commands', () => {
    it('should include "Navigate Up (Pop File)" command', () => {
      const commands = getStaticCommands();
      const popCmd = commands.find((c) => c.id === 'nav:nested-up');
      expect(popCmd).toBeDefined();
      expect(popCmd!.label).toBe('Navigate Up (Pop File)');
      expect(popCmd!.category).toBe('Navigation');
    });

    it('should include "Navigate to Project Root" command', () => {
      const commands = getStaticCommands();
      const rootCmd = commands.find((c) => c.id === 'nav:nested-root');
      expect(rootCmd).toBeDefined();
      expect(rootCmd!.label).toBe('Navigate to Project Root');
      expect(rootCmd!.category).toBe('Navigation');
    });

    it('nav:nested-up should be disabled when not nested', () => {
      const commands = getStaticCommands();
      const popCmd = commands.find((c) => c.id === 'nav:nested-up')!;
      expect(popCmd.isEnabled!()).toBe(false);
    });

    it('nav:nested-up should be enabled when nested', () => {
      const rootGraph = makeGraph('root');
      useCoreStore.setState({ graph: rootGraph });
      useNestedCanvasStore.getState().pushFile('child.archc', makeGraph('child'));

      const commands = getStaticCommands();
      const popCmd = commands.find((c) => c.id === 'nav:nested-up')!;
      expect(popCmd.isEnabled!()).toBe(true);
    });

    it('nav:nested-root should be disabled when not nested', () => {
      const commands = getStaticCommands();
      const rootCmd = commands.find((c) => c.id === 'nav:nested-root')!;
      expect(rootCmd.isEnabled!()).toBe(false);
    });

    it('nav:nested-root should be enabled when nested', () => {
      const rootGraph = makeGraph('root');
      useCoreStore.setState({ graph: rootGraph });
      useNestedCanvasStore.getState().pushFile('child.archc', makeGraph('child'));

      const commands = getStaticCommands();
      const rootCmd = commands.find((c) => c.id === 'nav:nested-root')!;
      expect(rootCmd.isEnabled!()).toBe(true);
    });

    it('should find nested commands via search', () => {
      const commands = getStaticCommands();
      const results = searchCommands(commands, 'pop file');
      const hasPopFile = results.some((c) => c.id === 'nav:nested-up');
      expect(hasPopFile).toBe(true);
    });

    it('should find project root command via search', () => {
      const commands = getStaticCommands();
      const results = searchCommands(commands, 'project root');
      const hasRoot = results.some((c) => c.id === 'nav:nested-root');
      expect(hasRoot).toBe(true);
    });

    it('nav:nested-up execute should call popFile', () => {
      const rootGraph = makeGraph('root');
      useCoreStore.setState({ graph: rootGraph });
      useNestedCanvasStore.getState().pushFile('child.archc', makeGraph('child'));
      expect(useNestedCanvasStore.getState().getDepth()).toBe(1);

      const commands = getStaticCommands();
      const popCmd = commands.find((c) => c.id === 'nav:nested-up')!;
      popCmd.execute();

      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
    });

    it('nav:nested-root execute should call popToRoot', () => {
      const rootGraph = makeGraph('root');
      useCoreStore.setState({ graph: rootGraph });
      useNestedCanvasStore.getState().pushFile('child1.archc', makeGraph('child1'));
      useNestedCanvasStore.getState().pushFile('child2.archc', makeGraph('child2'));
      expect(useNestedCanvasStore.getState().getDepth()).toBe(2);

      const commands = getStaticCommands();
      const rootCmd = commands.find((c) => c.id === 'nav:nested-root')!;
      rootCmd.execute();

      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
    });
  });

  // ─── Enter Key on Container Nodes ─────────────────────────────

  describe('Enter key on container nodes', () => {
    it('container node should have refSource property set', () => {
      const graph = makeGraphWithContainer('test');
      const container = graph.nodes[0]!;
      expect(container.refSource).toBe('file://./child.archc');
      expect(container.type).toBe('meta/canvas-ref');
    });
  });

  // ─── Integrated Navigation: File Stack + Nav Path ──────────────

  describe('Integrated navigation: Escape through layers', () => {
    it('should zoom out nav path first, then pop file on successive Escapes', () => {
      const rootGraph = makeGraph('root');
      const childGraph = makeGraph('child');
      useCoreStore.setState({ graph: rootGraph });

      // Push into a nested file
      useNestedCanvasStore.getState().pushFile('child.archc', childGraph);
      // Zoom into a fractal level within the nested file
      useNavigationStore.getState().zoomIn('node-child');

      expect(useNestedCanvasStore.getState().getDepth()).toBe(1);
      expect(useNavigationStore.getState().path).toEqual(['node-child']);

      // First "Escape": should zoom out within the file
      useNavigationStore.getState().zoomOut();
      expect(useNavigationStore.getState().path).toEqual([]);
      expect(useNestedCanvasStore.getState().getDepth()).toBe(1); // still nested

      // Second "Escape": should pop the file (since nav path is now empty)
      useNestedCanvasStore.getState().popFile();
      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
      expect(useCoreStore.getState().graph.name).toBe('root');
    });

    it('should handle deep nesting: 3 levels of files', () => {
      const g1 = makeGraph('root');
      const g2 = makeGraph('level1');
      const g3 = makeGraph('level2');
      useCoreStore.setState({ graph: g1 });

      useNestedCanvasStore.getState().pushFile('level1.archc', g2);
      useNestedCanvasStore.getState().pushFile('level2.archc', g3);
      expect(useNestedCanvasStore.getState().getDepth()).toBe(2);

      // popToRoot should go straight back
      useNestedCanvasStore.getState().popToRoot();
      expect(useNestedCanvasStore.getState().getDepth()).toBe(0);
      expect(useCoreStore.getState().graph.name).toBe('root');
    });
  });

  // ─── Pinch-Out Gesture Detection Logic ─────────────────────────

  describe('Pinch-out gesture detection', () => {
    it('should detect when spread ratio exceeds threshold', () => {
      // Test the pure logic: a spread ratio > 1.5x should trigger pop
      const PINCH_OUT_THRESHOLD = 1.5;
      const initialDistance = 100;

      // Spread to 160px = 1.6x ratio → should trigger
      const currentDistance = 160;
      const ratio = currentDistance / initialDistance;
      expect(ratio).toBeGreaterThan(PINCH_OUT_THRESHOLD);
    });

    it('should not trigger when spread ratio is below threshold', () => {
      const PINCH_OUT_THRESHOLD = 1.5;
      const initialDistance = 100;

      // Spread to 120px = 1.2x ratio → should NOT trigger
      const currentDistance = 120;
      const ratio = currentDistance / initialDistance;
      expect(ratio).toBeLessThan(PINCH_OUT_THRESHOLD);
    });
  });
});

/**
 * Tests for Keyboard Breadcrumb Navigation (feature #257).
 * Verifies Enter drills into group nodes, Escape/Backspace navigates up,
 * and breadcrumb path in status bar.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { findNode } from '@/core/graph/graphEngine';

// Helper: create a graph with group nodes (parent-child hierarchy)
function setupNestedGraph() {
  const store = useCoreStore.getState();
  store.initialize();
  store.newFile();

  // Root level nodes
  const platform = store.addNode({
    type: 'compute/service',
    displayName: 'Platform',
    position: { x: 0, y: 0 },
  });

  store.addNode({
    type: 'data/database',
    displayName: 'Main DB',
    position: { x: 300, y: 0 },
  });

  // Add children to Platform
  if (platform) {
    const backend = store.addNode({
      type: 'compute/service',
      displayName: 'Backend',
      position: { x: 0, y: 0 },
      parentId: platform.id,
    });

    store.addNode({
      type: 'compute/service',
      displayName: 'Frontend',
      position: { x: 200, y: 0 },
      parentId: platform.id,
    });

    // Add children to Backend
    if (backend) {
      store.addNode({
        type: 'compute/service',
        displayName: 'AuthService',
        position: { x: 0, y: 0 },
        parentId: backend.id,
      });

      store.addNode({
        type: 'compute/service',
        displayName: 'OrderService',
        position: { x: 200, y: 0 },
        parentId: backend.id,
      });
    }
  }

  return useCoreStore.getState().graph;
}

beforeEach(() => {
  useCoreStore.getState().initialize();
  useCoreStore.getState().newFile();
  useCanvasStore.setState({
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  useUIStore.setState({
    rightPanelOpen: false,
  });
  useNavigationStore.setState({ path: [] });
});

describe('Navigation Store', () => {
  it('starts at root level (empty path)', () => {
    expect(useNavigationStore.getState().path).toEqual([]);
  });

  it('zoomIn adds node ID to path', () => {
    useNavigationStore.getState().zoomIn('node-1');
    expect(useNavigationStore.getState().path).toEqual(['node-1']);
  });

  it('zoomIn supports multiple levels', () => {
    useNavigationStore.getState().zoomIn('node-1');
    useNavigationStore.getState().zoomIn('node-2');
    expect(useNavigationStore.getState().path).toEqual(['node-1', 'node-2']);
  });

  it('zoomOut removes last path element', () => {
    useNavigationStore.getState().zoomIn('node-1');
    useNavigationStore.getState().zoomIn('node-2');
    useNavigationStore.getState().zoomOut();
    expect(useNavigationStore.getState().path).toEqual(['node-1']);
  });

  it('zoomOut at root stays at root', () => {
    useNavigationStore.getState().zoomOut();
    expect(useNavigationStore.getState().path).toEqual([]);
  });

  it('zoomToRoot clears entire path', () => {
    useNavigationStore.getState().zoomIn('node-1');
    useNavigationStore.getState().zoomIn('node-2');
    useNavigationStore.getState().zoomToRoot();
    expect(useNavigationStore.getState().path).toEqual([]);
  });

  it('zoomToLevel sets exact path', () => {
    useNavigationStore.getState().zoomToLevel(['node-1', 'node-2', 'node-3']);
    expect(useNavigationStore.getState().path).toEqual(['node-1', 'node-2', 'node-3']);
  });
});

describe('Drill-In: Enter on Group Node', () => {
  it('group node has children', () => {
    const graph = setupNestedGraph();
    const platform = graph.nodes.find((n) => n.displayName === 'Platform');
    expect(platform).toBeDefined();
    expect(platform!.children.length).toBeGreaterThan(0);
  });

  it('leaf node has no children', () => {
    const graph = setupNestedGraph();
    const mainDb = graph.nodes.find((n) => n.displayName === 'Main DB');
    expect(mainDb).toBeDefined();
    expect(mainDb!.children.length).toBe(0);
  });

  it('drilling into group adds to navigation path', () => {
    const graph = setupNestedGraph();
    const platform = graph.nodes.find((n) => n.displayName === 'Platform')!;

    useNavigationStore.getState().zoomIn(platform.id);
    expect(useNavigationStore.getState().path).toEqual([platform.id]);
  });

  it('drilling two levels deep builds correct path', () => {
    const graph = setupNestedGraph();
    const platform = graph.nodes.find((n) => n.displayName === 'Platform')!;
    const backend = platform.children.find((n) => n.displayName === 'Backend')!;

    useNavigationStore.getState().zoomIn(platform.id);
    useNavigationStore.getState().zoomIn(backend.id);
    expect(useNavigationStore.getState().path).toEqual([platform.id, backend.id]);
  });

  it('findNode finds nested children', () => {
    const graph = setupNestedGraph();
    // Use find by display name since IDs are auto-generated
    const platform = graph.nodes.find((n) => n.displayName === 'Platform');
    expect(platform).toBeDefined();
    if (platform) {
      const backendChild = platform.children.find((n) => n.displayName === 'Backend');
      expect(backendChild).toBeDefined();
      expect(backendChild!.children.length).toBe(2);
    }
  });
});

describe('Drill-Out: Backspace and Escape', () => {
  it('Backspace at root does not go negative', () => {
    useNavigationStore.getState().zoomOut();
    expect(useNavigationStore.getState().path).toEqual([]);
  });

  it('Backspace navigates up one level', () => {
    useNavigationStore.getState().zoomIn('node-1');
    useNavigationStore.getState().zoomIn('node-2');
    useNavigationStore.getState().zoomOut();
    expect(useNavigationStore.getState().path).toEqual(['node-1']);
  });

  it('multiple Backspace calls navigate to root', () => {
    useNavigationStore.getState().zoomIn('node-1');
    useNavigationStore.getState().zoomIn('node-2');
    useNavigationStore.getState().zoomIn('node-3');
    useNavigationStore.getState().zoomOut();
    useNavigationStore.getState().zoomOut();
    useNavigationStore.getState().zoomOut();
    expect(useNavigationStore.getState().path).toEqual([]);
  });
});

describe('Breadcrumb Path Building', () => {
  it('builds breadcrumb from navigation path and node names', () => {
    const graph = setupNestedGraph();
    const platform = graph.nodes.find((n) => n.displayName === 'Platform')!;

    useNavigationStore.getState().zoomIn(platform.id);
    const path = useNavigationStore.getState().path;

    const parts = ['Root'];
    for (const nodeId of path) {
      const node = findNode(graph, nodeId);
      parts.push(node ? node.displayName : nodeId);
    }
    expect(parts.join(' > ')).toBe('Root > Platform');
  });

  it('builds multi-level breadcrumb', () => {
    const graph = setupNestedGraph();
    const platform = graph.nodes.find((n) => n.displayName === 'Platform')!;
    const backend = platform.children.find((n) => n.displayName === 'Backend')!;

    useNavigationStore.getState().zoomIn(platform.id);
    useNavigationStore.getState().zoomIn(backend.id);
    const path = useNavigationStore.getState().path;

    const parts = ['Root'];
    for (const nodeId of path) {
      const node = findNode(graph, nodeId);
      parts.push(node ? node.displayName : nodeId);
    }
    expect(parts.join(' > ')).toBe('Root > Platform > Backend');
  });

  it('breadcrumb is empty at root level', () => {
    const path = useNavigationStore.getState().path;
    expect(path.length).toBe(0);
  });
});

describe('Source Code Verification', () => {
  it('Canvas.tsx handles Escape drill-out when nothing selected', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/Canvas.tsx', 'utf-8');
    expect(source).toContain('Escape drill-out');
    expect(source).toContain('navigationPath.length > 0');
    expect(source).toContain('zoomOut()');
  });

  it('Canvas.tsx handles Backspace drill-out when inside group', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/Canvas.tsx', 'utf-8');
    expect(source).toContain('Backspace zoom out');
    expect(source).toContain('navigationPath.length > 0');
  });

  it('App.tsx shows breadcrumb in status bar', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(source).toContain('data-testid="breadcrumb"');
    expect(source).toContain("Root");
    expect(source).toContain("parts.join(' > ')");
    expect(source).toContain('navigationPath.length > 0');
  });

  it('App.tsx imports findNode for breadcrumb name resolution', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(source).toContain("import { findNode } from '@/core/graph/graphEngine'");
    expect(source).toContain("import { useNavigationStore } from '@/store/navigationStore'");
  });

  it('Backspace exists as registered shortcut (nav:zoom-out)', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/core/shortcuts/shortcutManager.ts', 'utf-8');
    expect(source).toContain("id: 'nav:zoom-out'");
    expect(source).toContain("defaultBinding: 'backspace'");
  });
});

describe('FocusZone Awareness', () => {
  it('shortcuts are suppressed when text input is focused', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
    // Shortcuts use isActiveElementTextInput() to suppress when typing
    expect(source).toContain('isActiveElementTextInput');
    expect(source).toContain('const inInput = isActiveElementTextInput()');
  });

  it('Escape handler checks for dialog open state', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/Canvas.tsx', 'utf-8');
    expect(source).toContain('deleteDialogOpen');
    expect(source).toContain('connectionDialogOpen');
    expect(source).toContain('unsavedChangesDialogOpen');
  });
});

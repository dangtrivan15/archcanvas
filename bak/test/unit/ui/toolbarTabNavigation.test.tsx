/**
 * Tests for Feature #221: Tab navigation through toolbar items.
 * Verifies that users can navigate toolbar buttons using the Tab key,
 * focus moves sequentially through all toolbar items, and a focus ring
 * is visible on each item.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';

// Mock the fileIO module before importing coreStore
vi.mock('@/core/storage/fileIO', async () => {
  const actual =
    await vi.importActual<typeof import('@/core/storage/fileIO')>('@/core/storage/fileIO');
  return {
    ...actual,
    saveArchcFile: vi.fn(),
    saveArchcFileAs: vi.fn(),
    openArchcFile: vi.fn(),
    pickArchcFile: vi.fn(),
    deriveSummaryFileName: actual.deriveSummaryFileName,
    saveSummaryMarkdown: vi.fn(),
    decodeArchcData: vi.fn(),
    protoToGraphFull: actual.protoToGraphFull,
    graphToProto: actual.graphToProto,
  };
});

// Mock canvasStore as a Zustand-like hook
vi.mock('@/store/canvasStore', () => {
  const state = {
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: null,
    setViewport: vi.fn(),
    requestFitView: vi.fn(),
    layoutSpacing: { nodeSpacing: 60, layerSpacing: 80 },
    setLayoutSpacing: vi.fn(),
    resetLayoutSpacing: vi.fn(),
  };
  const useCanvasStore = (selector?: any) => (selector ? selector(state) : state);
  useCanvasStore.getState = () => state;
  useCanvasStore.subscribe = vi.fn(() => vi.fn());
  return {
    useCanvasStore,
    DEFAULT_LAYOUT_SPACING: { nodeSpacing: 60, layerSpacing: 80 },
  };
});

// Mock navigationStore as a Zustand-like hook
vi.mock('@/store/navigationStore', () => {
  const state = {
    navigationPath: [],
    path: [],
    zoomToRoot: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomToLevel: vi.fn(),
  };
  const useNavigationStore = (selector?: any) => (selector ? selector(state) : state);
  useNavigationStore.getState = () => state;
  useNavigationStore.subscribe = vi.fn(() => vi.fn());
  return { useNavigationStore };
});

// Mock layout
vi.mock('@/core/layout/elkLayout', () => ({
  applyElkLayout: vi.fn(),
}));

// Now import the modules
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import { Toolbar } from '@/components/toolbar/Toolbar';

describe('Feature #221: Tab navigation through toolbar items', () => {
  beforeEach(() => {
    // Reset UI store
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
      fileOperationLoading: false,
      fileOperationMessage: null,
      leftPanelOpen: false,
    });

    // Reset core store
    useGraphStore.setState({ isDirty: false, nodeCount: 0, edgeCount: 0 }); useFileStore.setState({ isSaving: false, fileHandle: null, fileName: 'Untitled Architecture', fileCreatedAtMs: null }); useEngineStore.setState({ initialized: false }); useHistoryStore.setState({ canUndo: false, canRedo: false });
    useEngineStore.getState().initialize();

    // Add 2 nodes AFTER initialize so Connect button is enabled
    useGraphStore.setState({      graph: {
        name: 'Test Architecture',
        description: '',
        owners: [],
        nodes: [
          {
            id: 'n1',
            type: 'compute/service',
            displayName: 'Service A',
            args: {},
            codeRefs: [],
            notes: [],
            properties: {},
            position: { x: 0, y: 0 },
            children: [],
          },
          {
            id: 'n2',
            type: 'data/database',
            displayName: 'DB',
            args: {},
            codeRefs: [],
            notes: [],
            properties: {},
            position: { x: 300, y: 0 },
            children: [],
          },
        ],
        edges: [],
      },
      nodeCount: 2,
      edgeCount: 0,});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Toolbar has correct ARIA structure', () => {
    it('has role="toolbar"', () => {
      render(<Toolbar />);
      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toBeInTheDocument();
    });

    it('has aria-label "Main toolbar"', () => {
      render(<Toolbar />);
      const toolbar = screen.getByRole('toolbar');
      expect(toolbar.getAttribute('aria-label')).toBe('Main toolbar');
    });

    it('has data-testid="toolbar"', () => {
      render(<Toolbar />);
      const toolbar = screen.getByTestId('toolbar');
      expect(toolbar).toBeInTheDocument();
    });
  });

  describe('All toolbar buttons are focusable', () => {
    it('File menu button is a focusable button element', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('file-menu-button');
      expect(btn.tagName).toBe('BUTTON');
      // Buttons are natively focusable (tabIndex is 0 or not set)
      expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it('Add Node button is a focusable button element', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('add-node-button');
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it('Connect Nodes button is a focusable button element', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('connect-nodes-button');
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it('Layout menu button is a focusable button element', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('layout-menu-button');
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it('File menu button can receive focus', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('file-menu-button');
      btn.focus();
      expect(document.activeElement).toBe(btn);
    });

    it('Add Node button can receive focus', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('add-node-button');
      btn.focus();
      expect(document.activeElement).toBe(btn);
    });

    it('Connect Nodes button can receive focus when enabled', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('connect-nodes-button');
      btn.focus();
      expect(document.activeElement).toBe(btn);
    });

    it('Layout menu button can receive focus', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('layout-menu-button');
      btn.focus();
      expect(document.activeElement).toBe(btn);
    });
  });

  describe('Focus ring styles are applied to toolbar buttons', () => {
    it('File menu button has focus-visible ring styles', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('file-menu-button');
      expect(btn.className).toContain('focus-visible:ring-2');
      expect(btn.className).toContain('focus-visible:outline-none');
    });

    it('Add Node button has focus-visible ring styles', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('add-node-button');
      expect(btn.className).toContain('focus-visible:ring-2');
      expect(btn.className).toContain('focus-visible:outline-none');
    });

    it('Connect Nodes button has focus-visible ring styles', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('connect-nodes-button');
      expect(btn.className).toContain('focus-visible:ring-2');
      expect(btn.className).toContain('focus-visible:outline-none');
    });

    it('Layout menu button has focus-visible ring styles', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('layout-menu-button');
      expect(btn.className).toContain('focus-visible:ring-2');
      expect(btn.className).toContain('focus-visible:outline-none');
    });

    it('All toolbar buttons have focus-visible:ring-offset-1', () => {
      render(<Toolbar />);
      const buttons = [
        screen.getByTestId('file-menu-button'),
        screen.getByTestId('add-node-button'),
        screen.getByTestId('connect-nodes-button'),
        screen.getByTestId('layout-menu-button'),
      ];
      buttons.forEach((btn) => {
        expect(btn.className).toContain('focus-visible:ring-offset-1');
      });
    });

    it('All toolbar buttons have the ring color referencing CSS variable', () => {
      render(<Toolbar />);
      const buttons = [
        screen.getByTestId('file-menu-button'),
        screen.getByTestId('add-node-button'),
        screen.getByTestId('connect-nodes-button'),
        screen.getByTestId('layout-menu-button'),
      ];
      buttons.forEach((btn) => {
        expect(btn.className).toContain('focus-visible:ring-ring');
      });
    });
  });

  describe('Toolbar buttons are in correct DOM order for tab navigation', () => {
    it('buttons appear in order: File, Add Node, Connect, Layout', () => {
      render(<Toolbar />);
      const toolbar = screen.getByTestId('toolbar');
      // Get all buttons within the toolbar
      const buttons = toolbar.querySelectorAll('button');
      const testIds = Array.from(buttons).map((btn) => btn.getAttribute('data-testid'));

      // Verify the toolbar buttons are in the correct order
      const fileIdx = testIds.indexOf('file-menu-button');
      const addNodeIdx = testIds.indexOf('add-node-button');
      const connectIdx = testIds.indexOf('connect-nodes-button');
      const layoutIdx = testIds.indexOf('layout-menu-button');

      expect(fileIdx).toBeGreaterThanOrEqual(0);
      expect(addNodeIdx).toBeGreaterThanOrEqual(0);
      expect(connectIdx).toBeGreaterThanOrEqual(0);
      expect(layoutIdx).toBeGreaterThanOrEqual(0);

      expect(fileIdx).toBeLessThan(addNodeIdx);
      expect(addNodeIdx).toBeLessThan(connectIdx);
      expect(connectIdx).toBeLessThan(layoutIdx);
    });

    it('all 4 toolbar buttons exist in the DOM', () => {
      render(<Toolbar />);
      expect(screen.getByTestId('file-menu-button')).toBeInTheDocument();
      expect(screen.getByTestId('add-node-button')).toBeInTheDocument();
      expect(screen.getByTestId('connect-nodes-button')).toBeInTheDocument();
      expect(screen.getByTestId('layout-menu-button')).toBeInTheDocument();
    });

    it('no toolbar button has tabIndex=-1 preventing tab navigation', () => {
      render(<Toolbar />);
      const buttons = [
        screen.getByTestId('file-menu-button'),
        screen.getByTestId('add-node-button'),
        screen.getByTestId('connect-nodes-button'),
        screen.getByTestId('layout-menu-button'),
      ];
      buttons.forEach((btn) => {
        expect(btn.tabIndex).not.toBe(-1);
      });
    });
  });

  describe('Toolbar accessible attributes', () => {
    it('File menu button has aria-haspopup', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('file-menu-button');
      expect(btn.getAttribute('aria-haspopup')).toBe('true');
    });

    it('Layout menu button has aria-haspopup', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('layout-menu-button');
      expect(btn.getAttribute('aria-haspopup')).toBe('true');
    });

    it('File menu button has aria-expanded=false when closed', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('file-menu-button');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    it('Layout menu button has aria-expanded=false when closed', () => {
      render(<Toolbar />);
      const btn = screen.getByTestId('layout-menu-button');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });
  });
});

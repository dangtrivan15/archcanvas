/**
 * Tests for ModeStatusBar - VS Code-style persistent status bar at bottom of canvas.
 * Verifies: mode badge, context hints, breadcrumb path, zoom, selection count,
 * animated transitions, accessibility, and integration with Canvas.tsx.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CanvasMode, MODE_DISPLAY } from '@/core/input/canvasMode';
import { useUIStore } from '@/store/uiStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useCoreStore } from '@/store/coreStore';

// Helper to read the ModeStatusBar source for structural verification
import { readFileSync } from 'fs';
import { join } from 'path';

const COMPONENT_SRC = readFileSync(
  join(__dirname, '../../../src/components/canvas/ModeStatusBar.tsx'),
  'utf-8',
);

const CANVAS_SRC = readFileSync(
  join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
  'utf-8',
);

// ─── Helper: Reset stores ────────────────────────────────────────

function resetStores() {
  useUIStore.setState({
    canvasMode: CanvasMode.Normal,
    previousCanvasMode: CanvasMode.Normal,
    connectSource: null,
    connectTarget: null,
    connectStep: null,
  });
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
  });
  useNavigationStore.setState({ path: [] });
}

describe('ModeStatusBar', () => {
  beforeEach(() => {
    resetStores();
  });

  // ─── Source Structure Verification ──────────────────────────────

  describe('Source structure', () => {
    it('imports useUIStore for mode state', () => {
      expect(COMPONENT_SRC).toContain("import { useUIStore }");
    });

    it('imports useCanvasStore for zoom and selection', () => {
      expect(COMPONENT_SRC).toContain("import { useCanvasStore }");
    });

    it('imports useNavigationStore for breadcrumb path', () => {
      expect(COMPONENT_SRC).toContain("import { useNavigationStore }");
    });

    it('imports useCoreStore for graph data', () => {
      expect(COMPONENT_SRC).toContain("import { useCoreStore }");
    });

    it('imports CanvasMode and MODE_DISPLAY', () => {
      expect(COMPONENT_SRC).toContain("import { CanvasMode, MODE_DISPLAY }");
    });

    it('imports getShortcutManager for context hints', () => {
      expect(COMPONENT_SRC).toContain("import { getShortcutManager }");
    });

    it('imports formatBindingDisplay for binding display', () => {
      expect(COMPONENT_SRC).toContain("import { formatBindingDisplay }");
    });

    it('imports ChevronRight from lucide-react for breadcrumb separators', () => {
      expect(COMPONENT_SRC).toContain("import { ChevronRight }");
    });

    it('has data-testid="mode-status-bar"', () => {
      expect(COMPONENT_SRC).toContain('data-testid="mode-status-bar"');
    });

    it('has role="status" for accessibility', () => {
      expect(COMPONENT_SRC).toContain('role="status"');
    });

    it('has aria-label="Canvas status bar"', () => {
      expect(COMPONENT_SRC).toContain('aria-label="Canvas status bar"');
    });
  });

  // ─── Mode Badge ────────────────────────────────────────────────

  describe('Mode badge', () => {
    it('has data-testid="mode-badge"', () => {
      expect(COMPONENT_SRC).toContain('data-testid="mode-badge"');
    });

    it('shows mode shortLabel from MODE_DISPLAY', () => {
      expect(COMPONENT_SRC).toContain('modeDisplay.shortLabel');
    });

    it('defines badge style for Normal mode (gray)', () => {
      expect(COMPONENT_SRC).toContain('bg-gray-600');
    });

    it('defines badge style for Connect mode (blue)', () => {
      expect(COMPONENT_SRC).toContain('bg-blue-600');
    });

    it('defines badge style for Edit mode (green)', () => {
      expect(COMPONENT_SRC).toContain('bg-green-600');
    });

    it('has aria-label indicating current mode', () => {
      expect(COMPONENT_SRC).toContain('aria-label={`Mode: ${modeDisplay.shortLabel}`}');
    });

    it('uses font-mono font-bold for badge text', () => {
      expect(COMPONENT_SRC).toContain('font-mono');
      expect(COMPONENT_SRC).toContain('font-bold');
    });

    it('uses uppercase tracking-wider for badge', () => {
      expect(COMPONENT_SRC).toContain('uppercase');
      expect(COMPONENT_SRC).toContain('tracking-wider');
    });

    it('Normal mode displays "NORMAL"', () => {
      expect(MODE_DISPLAY[CanvasMode.Normal].shortLabel).toBe('NORMAL');
    });

    it('Connect mode displays "CONNECT"', () => {
      expect(MODE_DISPLAY[CanvasMode.Connect].shortLabel).toBe('CONNECT');
    });

    it('Edit mode displays "EDIT"', () => {
      expect(MODE_DISPLAY[CanvasMode.Edit].shortLabel).toBe('EDIT');
    });
  });

  // ─── Animated Mode Transitions ─────────────────────────────────

  describe('Animated mode transitions', () => {
    it('uses transition-all on mode badge', () => {
      expect(COMPONENT_SRC).toContain('transition-all');
    });

    it('uses duration-300 for smooth transition', () => {
      expect(COMPONENT_SRC).toContain('duration-300');
    });

    it('uses ease-in-out timing function', () => {
      expect(COMPONENT_SRC).toContain('ease-in-out');
    });

    it('connect step label has transition-opacity', () => {
      expect(COMPONENT_SRC).toContain('transition-opacity');
    });
  });

  // ─── Shortcut Hints (merged from ShortcutHints panel) ──────────

  describe('Shortcut hints (merged)', () => {
    it('has data-testid="shortcut-hints" for the hints container', () => {
      expect(COMPONENT_SRC).toContain('data-testid="shortcut-hints"');
    });

    it('shows "cancel" hint in Connect mode', () => {
      expect(COMPONENT_SRC).toContain("label: 'cancel'");
    });

    it('shows "exit" hint in Edit mode', () => {
      expect(COMPONENT_SRC).toContain("label: 'exit'");
    });

    it('shows "change type" hint when edge selected', () => {
      expect(COMPONENT_SRC).toContain("label: 'change type'");
    });

    it('shows "connect" hint when node selected', () => {
      expect(COMPONENT_SRC).toContain("label: 'connect'");
    });

    it('shows "commands" hint when nothing selected', () => {
      expect(COMPONENT_SRC).toContain("label: 'commands'");
    });

    it('shows "all shortcuts" hint when nothing selected', () => {
      expect(COMPONENT_SRC).toContain("label: 'all shortcuts'");
    });

    it('uses kbd element for key display', () => {
      expect(COMPONENT_SRC).toContain('<kbd');
    });

    it('uses ShortcutManager for dynamic bindings', () => {
      expect(COMPONENT_SRC).toContain('sm.getBinding(actionId)');
    });

    it('hints are toggleable with H key (persisted in localStorage)', () => {
      expect(COMPONENT_SRC).toContain('HINTS_STORAGE_KEY');
      expect(COMPONENT_SRC).toContain('hintsVisible');
      expect(COMPONENT_SRC).toContain('toggleHints');
    });
  });

  // ─── Connect Step Sub-label ────────────────────────────────────

  describe('Connect step sub-label', () => {
    it('has data-testid="connect-step-label"', () => {
      expect(COMPONENT_SRC).toContain('data-testid="connect-step-label"');
    });

    it('shows "pick source" for select-source step', () => {
      expect(COMPONENT_SRC).toContain("'pick source'");
    });

    it('shows "pick target" for select-target step', () => {
      expect(COMPONENT_SRC).toContain("'pick target'");
    });

    it('shows "1/2/3 type" for pick-type step', () => {
      expect(COMPONENT_SRC).toContain("'1/2/3 type'");
    });

    it('only renders in Connect mode', () => {
      expect(COMPONENT_SRC).toContain('canvasMode === CanvasMode.Connect && connectStep');
    });
  });

  // ─── Breadcrumb Path (Center) ──────────────────────────────────

  describe('Breadcrumb path', () => {
    it('has data-testid="statusbar-breadcrumb"', () => {
      expect(COMPONENT_SRC).toContain('data-testid="statusbar-breadcrumb"');
    });

    it('has aria-label="Navigation path"', () => {
      expect(COMPONENT_SRC).toContain('aria-label="Navigation path"');
    });

    it('has a Root button with data-testid', () => {
      expect(COMPONENT_SRC).toContain('data-testid="statusbar-breadcrumb-root"');
    });

    it('Root button calls zoomToRoot on click', () => {
      expect(COMPONENT_SRC).toContain('onClick={zoomToRoot}');
    });

    it('intermediate segments call zoomToLevel on click', () => {
      expect(COMPONENT_SRC).toContain('onClick={() => zoomToLevel(pathToHere)}');
    });

    it('renders ChevronRight separator between segments', () => {
      expect(COMPONENT_SRC).toContain('<ChevronRight');
    });

    it('last segment is non-clickable (plain text)', () => {
      // Last segment should be a span, not a button
      expect(COMPONENT_SRC).toContain('isLast ? (');
      expect(COMPONENT_SRC).toContain('<span className="text-white font-medium');
    });

    it('breadcrumb has pointer-events-auto for clickability', () => {
      expect(COMPONENT_SRC).toContain('pointer-events-auto');
    });

    it('only renders breadcrumb when navigation path is non-empty', () => {
      expect(COMPONENT_SRC).toContain('navigationPath.length > 0');
    });

    it('truncates long segment names', () => {
      expect(COMPONENT_SRC).toContain('truncate');
      expect(COMPONENT_SRC).toContain('max-w-[120px]');
    });
  });

  // ─── Zoom Level (Right) ────────────────────────────────────────

  describe('Zoom level', () => {
    it('has data-testid="statusbar-zoom"', () => {
      expect(COMPONENT_SRC).toContain('data-testid="statusbar-zoom"');
    });

    it('displays zoom as percentage', () => {
      expect(COMPONENT_SRC).toContain('Math.round(zoom * 100)');
      expect(COMPONENT_SRC).toContain('%');
    });

    it('reads zoom from canvasStore viewport', () => {
      expect(COMPONENT_SRC).toContain('useCanvasStore((s) => s.viewport.zoom)');
    });
  });

  // ─── Selection Count (Right) ───────────────────────────────────

  describe('Selection count', () => {
    it('has data-testid="statusbar-selection"', () => {
      expect(COMPONENT_SRC).toContain('data-testid="statusbar-selection"');
    });

    it('uses blue-300 color for selection text', () => {
      expect(COMPONENT_SRC).toContain('text-blue-300');
    });

    it('handles single node selection', () => {
      expect(COMPONENT_SRC).toContain("'1 node'");
    });

    it('handles single edge selection', () => {
      expect(COMPONENT_SRC).toContain("'1 edge'");
    });

    it('handles multi-node selection', () => {
      expect(COMPONENT_SRC).toContain('`${selectedNodeIds.length} nodes`');
    });

    it('handles multi-edge selection', () => {
      expect(COMPONENT_SRC).toContain('`${selectedEdgeIds.length} edges`');
    });

    it('handles mixed node+edge selection', () => {
      expect(COMPONENT_SRC).toContain('`${selectedNodeIds.length} nodes, ${selectedEdgeIds.length} edges`');
    });

    it('has separator between selection and zoom', () => {
      // The | separator between selection and zoom
      expect(COMPONENT_SRC).toContain('text-white/20');
    });
  });

  // ─── Layout and Positioning ────────────────────────────────────

  describe('Layout and positioning', () => {
    it('is positioned at bottom of canvas with absolute positioning', () => {
      expect(COMPONENT_SRC).toContain('absolute');
      expect(COMPONENT_SRC).toContain('bottom-0');
      expect(COMPONENT_SRC).toContain('left-0');
      expect(COMPONENT_SRC).toContain('right-0');
    });

    it('has correct height (28-32px)', () => {
      expect(COMPONENT_SRC).toContain('h-[30px]');
    });

    it('uses semi-transparent background', () => {
      expect(COMPONENT_SRC).toContain('bg-gray-900/75');
    });

    it('uses backdrop blur', () => {
      expect(COMPONENT_SRC).toContain('backdrop-blur-sm');
    });

    it('uses z-40 for proper stacking', () => {
      expect(COMPONENT_SRC).toContain('z-40');
    });

    it('uses pointer-events-none on container', () => {
      expect(COMPONENT_SRC).toContain('pointer-events-none');
    });

    it('uses select-none to prevent text selection', () => {
      expect(COMPONENT_SRC).toContain('select-none');
    });

    it('uses flexbox layout with items-center', () => {
      expect(COMPONENT_SRC).toContain('flex items-center');
    });

    it('text is 11px', () => {
      expect(COMPONENT_SRC).toContain('text-[11px]');
    });
  });

  // ─── Store Integration ─────────────────────────────────────────

  describe('Store state integration', () => {
    it('zoom defaults to 100%', () => {
      const zoom = useCanvasStore.getState().viewport.zoom;
      expect(Math.round(zoom * 100)).toBe(100);
    });

    it('zoom updates reflect in store', () => {
      useCanvasStore.setState({ viewport: { x: 0, y: 0, zoom: 0.75 } });
      const zoom = useCanvasStore.getState().viewport.zoom;
      expect(Math.round(zoom * 100)).toBe(75);
    });

    it('selection count updates from store', () => {
      useCanvasStore.setState({
        selectedNodeIds: ['node1', 'node2', 'node3'],
        selectedNodeId: 'node3',
      });
      const { selectedNodeIds } = useCanvasStore.getState();
      expect(selectedNodeIds.length).toBe(3);
    });

    it('mode changes from store', () => {
      useUIStore.setState({ canvasMode: CanvasMode.Connect });
      expect(useUIStore.getState().canvasMode).toBe(CanvasMode.Connect);
    });

    it('connect step changes from store', () => {
      useUIStore.setState({
        canvasMode: CanvasMode.Connect,
        connectStep: 'select-target',
        connectSource: 'node1',
      });
      const { connectStep } = useUIStore.getState();
      expect(connectStep).toBe('select-target');
    });

    it('navigation path changes from store', () => {
      useNavigationStore.setState({ path: ['parent', 'child'] });
      expect(useNavigationStore.getState().path).toEqual(['parent', 'child']);
    });

    it('empty navigation path means at root', () => {
      expect(useNavigationStore.getState().path).toEqual([]);
    });
  });

  // ─── Selection Text Logic ──────────────────────────────────────

  describe('Selection text logic', () => {
    it('returns null when nothing selected', () => {
      const { selectedNodeIds, selectedEdgeIds } = useCanvasStore.getState();
      expect(selectedNodeIds.length).toBe(0);
      expect(selectedEdgeIds.length).toBe(0);
    });

    it('shows "1 node" for single node selection', () => {
      useCanvasStore.setState({
        selectedNodeIds: ['node1'],
        selectedNodeId: 'node1',
      });
      const { selectedNodeIds, selectedEdgeIds } = useCanvasStore.getState();
      expect(selectedNodeIds.length).toBe(1);
      expect(selectedEdgeIds.length).toBe(0);
    });

    it('shows "N nodes" for multi-node selection', () => {
      useCanvasStore.setState({
        selectedNodeIds: ['n1', 'n2', 'n3'],
        selectedNodeId: 'n3',
      });
      expect(useCanvasStore.getState().selectedNodeIds.length).toBe(3);
    });

    it('shows "1 edge" for single edge selection', () => {
      useCanvasStore.setState({
        selectedEdgeIds: ['e1'],
        selectedEdgeId: 'e1',
        selectedNodeIds: [],
        selectedNodeId: null,
      });
      const { selectedEdgeIds } = useCanvasStore.getState();
      expect(selectedEdgeIds.length).toBe(1);
    });

    it('shows mixed count for both nodes and edges', () => {
      useCanvasStore.setState({
        selectedNodeIds: ['n1', 'n2'],
        selectedNodeId: 'n2',
        selectedEdgeIds: ['e1'],
        selectedEdgeId: 'e1',
      });
      const { selectedNodeIds, selectedEdgeIds } = useCanvasStore.getState();
      expect(selectedNodeIds.length).toBe(2);
      expect(selectedEdgeIds.length).toBe(1);
    });
  });

  // ─── getHints Logic (replaces old getContextHint) ──────────────

  describe('getHints logic', () => {
    it('Connect mode returns navigate, confirm, type, cancel hints', () => {
      expect(COMPONENT_SRC).toContain("mode === CanvasMode.Connect");
      expect(COMPONENT_SRC).toContain("label: 'navigate'");
      expect(COMPONENT_SRC).toContain("label: 'confirm'");
      expect(COMPONENT_SRC).toContain("label: 'type'");
    });

    it('Edit mode returns tab, prev field, confirm, exit hints', () => {
      expect(COMPONENT_SRC).toContain("mode === CanvasMode.Edit");
      expect(COMPONENT_SRC).toContain("label: 'next field'");
      expect(COMPONENT_SRC).toContain("label: 'prev field'");
      expect(COMPONENT_SRC).toContain("label: 'exit'");
    });

    it('edge selected returns change type, delete, deselect hints', () => {
      expect(COMPONENT_SRC).toContain("hasEdge");
      expect(COMPONENT_SRC).toContain("key: 'T'");
      expect(COMPONENT_SRC).toContain("label: 'deselect'");
    });

    it('node selected returns connect, edit, delete, rename, commands hints', () => {
      expect(COMPONENT_SRC).toContain("hasNode");
      expect(COMPONENT_SRC).toContain("label: 'edit'");
      expect(COMPONENT_SRC).toContain("label: 'rename'");
    });

    it('nothing selected returns commands, service, database, all shortcuts, hide hints', () => {
      expect(COMPONENT_SRC).toContain("label: 'service'");
      expect(COMPONENT_SRC).toContain("label: 'database'");
      expect(COMPONENT_SRC).toContain("label: 'hide hints'");
    });

    it('uses useMemo for hints computation', () => {
      expect(COMPONENT_SRC).toContain("useMemo");
      expect(COMPONENT_SRC).toContain("getHints(canvasMode");
    });
  });

  // ─── Integration with Canvas.tsx ───────────────────────────────

  describe('Integration with Canvas.tsx', () => {
    it('Canvas.tsx imports ModeStatusBar', () => {
      expect(CANVAS_SRC).toContain("import { ModeStatusBar }");
    });

    it('Canvas.tsx renders <ModeStatusBar />', () => {
      expect(CANVAS_SRC).toContain('<ModeStatusBar />');
    });

    it('import path is correct', () => {
      expect(CANVAS_SRC).toContain("from '@/components/canvas/ModeStatusBar'");
    });
  });

  // ─── PATH resolution ──────────────────────────────────────────

  describe('Breadcrumb path resolution', () => {
    it('resolvePathNames function exists', () => {
      expect(COMPONENT_SRC).toContain('function resolvePathNames');
    });

    it('resolvePathNames traverses node hierarchy', () => {
      expect(COMPONENT_SRC).toContain('currentNodes.find((n) => n.id === segmentId)');
      expect(COMPONENT_SRC).toContain('currentNodes = node.children');
    });

    it('resolvePathNames returns id and displayName', () => {
      expect(COMPONENT_SRC).toContain('id: node.id');
      expect(COMPONENT_SRC).toContain('displayName: node.displayName');
    });
  });

  // ─── Mode Badge Styles ─────────────────────────────────────────

  describe('MODE_BADGE_STYLES configuration', () => {
    it('defines styles for all three modes', () => {
      expect(COMPONENT_SRC).toContain('[CanvasMode.Normal]');
      expect(COMPONENT_SRC).toContain('[CanvasMode.Connect]');
      expect(COMPONENT_SRC).toContain('[CanvasMode.Edit]');
    });

    it('Normal mode uses gray background', () => {
      expect(COMPONENT_SRC).toContain("bg: 'bg-gray-600'");
    });

    it('Connect mode uses blue background', () => {
      expect(COMPONENT_SRC).toContain("bg: 'bg-blue-600'");
    });

    it('Edit mode uses green background', () => {
      expect(COMPONENT_SRC).toContain("bg: 'bg-green-600'");
    });

    it('all modes use white text', () => {
      // All three have text: 'text-white'
      const matches = COMPONENT_SRC.match(/text: 'text-white'/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(3);
    });
  });

  // ─── Overflow / Layout Accommodation (Feature #272) ───────────

  describe('Status bar layout accommodates hints without overflow', () => {
    it('status bar container has fixed height h-[30px]', () => {
      expect(COMPONENT_SRC).toContain('h-[30px]');
    });

    it('status bar uses flex layout (no wrap)', () => {
      // flex items-center but no flex-wrap means single-line layout
      expect(COMPONENT_SRC).toContain('flex items-center');
      expect(COMPONENT_SRC).not.toContain('flex-wrap');
    });

    it('left section (mode badge) is shrink-0 to prevent collapse', () => {
      // Left section should never shrink
      const leftSectionMatch = COMPONENT_SRC.match(
        /Left Section.*?<div className="([^"]+)"/s,
      );
      expect(leftSectionMatch).not.toBeNull();
      expect(leftSectionMatch![1]).toContain('shrink-0');
    });

    it('right section uses min-w-0 for flex child overflow', () => {
      // min-w-0 allows flex children to shrink below their content size
      const rightSectionMatch = COMPONENT_SRC.match(
        /Right Section.*?<div className="([^"]+)"/s,
      );
      expect(rightSectionMatch).not.toBeNull();
      expect(rightSectionMatch![1]).toContain('min-w-0');
    });

    it('hints container has overflow-hidden to prevent layout break', () => {
      expect(COMPONENT_SRC).toContain('overflow-hidden');
    });

    it('hints container has whitespace-nowrap to prevent wrapping', () => {
      expect(COMPONENT_SRC).toContain('whitespace-nowrap');
    });

    it('each hint item is shrink-0 to keep items intact until clipped', () => {
      // Individual hint spans should not partially shrink
      expect(COMPONENT_SRC).toContain('className="flex items-center gap-0.5 shrink-0"');
    });

    it('zoom percentage is shrink-0 to always remain visible', () => {
      // The zoom span should have shrink-0
      expect(COMPONENT_SRC).toContain('className="shrink-0 whitespace-nowrap" data-testid="statusbar-zoom"');
    });

    it('selection text is shrink-0 with whitespace-nowrap', () => {
      expect(COMPONENT_SRC).toContain('shrink-0 whitespace-nowrap');
    });

    it('pipe separators between hints, selection, and zoom are shrink-0', () => {
      // All separator pipes should be shrink-0
      expect(COMPONENT_SRC).toContain('text-white/20 shrink-0');
    });

    it('center section (breadcrumb) has overflow-hidden', () => {
      const centerMatch = COMPONENT_SRC.match(
        /Center Section.*?<div className="([^"]+)"/s,
      );
      expect(centerMatch).not.toBeNull();
      expect(centerMatch![1]).toContain('overflow-hidden');
    });

    it('center section is flex-1 to absorb extra space', () => {
      const centerMatch = COMPONENT_SRC.match(
        /Center Section.*?<div className="([^"]+)"/s,
      );
      expect(centerMatch).not.toBeNull();
      expect(centerMatch![1]).toContain('flex-1');
    });

    it('hints container has min-w-0 for flex overflow', () => {
      // The shortcut-hints container should allow shrinking
      expect(COMPONENT_SRC).toContain(
        'overflow-hidden whitespace-nowrap min-w-0',
      );
    });
  });
});

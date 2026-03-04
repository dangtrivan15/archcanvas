import { useEffect, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore, LEFT_PANEL_COLLAPSE_THRESHOLD } from '@/store/uiStore';
import { Toolbar } from '@/components/toolbar';
import { Canvas } from '@/components/canvas/Canvas';
import { NodeDetailPanel } from '@/components/panels/NodeDetailPanel';
import { EdgeDetailPanel } from '@/components/panels/EdgeDetailPanel';
import { NodeDefBrowser } from '@/components/panels/NodeDefBrowser';
import { DeleteConfirmationDialog } from '@/components/shared/DeleteConfirmationDialog';
import { ConnectionTypeDialog } from '@/components/shared/ConnectionTypeDialog';
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog';
import { ErrorDialog } from '@/components/shared/ErrorDialog';
import { IntegrityWarningDialog } from '@/components/shared/IntegrityWarningDialog';
import { ShortcutsHelpPanel } from '@/components/shared/ShortcutsHelpPanel';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { QuickSearchOverlay } from '@/components/shared/QuickSearchOverlay';
import { ShortcutSettingsPanel } from '@/components/shared/ShortcutSettingsPanel';
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { Toast } from '@/components/shared/Toast';
import { ResizeHandle } from '@/components/shared/ResizeHandle';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAutoSaveOnBlur } from '@/hooks/useAutoSaveOnBlur';
import { FocusZoneProvider, FocusZoneRegion, FocusZone } from '@/core/input/focusZones';
import { CanvasMode, MODE_DISPLAY } from '@/core/input/canvasMode';
import { useNavigationStore } from '@/store/navigationStore';
import { findNode } from '@/core/graph/graphEngine';

export function App() {
  const initialize = useCoreStore((s) => s.initialize);
  const initialized = useCoreStore((s) => s.initialized);
  const nodeCount = useCoreStore((s) => s.nodeCount);
  const edgeCount = useCoreStore((s) => s.edgeCount);
  const isDirty = useCoreStore((s) => s.isDirty);
  const loadFromUrl = useCoreStore((s) => s.loadFromUrl);

  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const leftPanelWidth = useUIStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const setLeftPanelWidth = useUIStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const autosaveStatusMessage = useUIStore((s) => s.autosaveStatusMessage);
  const canvasMode = useUIStore((s) => s.canvasMode);
  const navigationPath = useNavigationStore((s) => s.path);
  const graph = useCoreStore((s) => s.graph);

  const handleLeftResize = useCallback((delta: number) => {
    const newWidth = leftPanelWidth + delta;
    // Snap-to-collapse: if dragged below collapse threshold, close the panel
    if (newWidth < LEFT_PANEL_COLLAPSE_THRESHOLD) {
      if (leftPanelOpen) {
        toggleLeftPanel();
      }
      return;
    }
    setLeftPanelWidth(newWidth);
  }, [leftPanelWidth, setLeftPanelWidth, leftPanelOpen, toggleLeftPanel]);

  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth(rightPanelWidth + delta);
  }, [rightPanelWidth, setRightPanelWidth]);

  // Global keyboard shortcuts (Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O, Ctrl+Z, Ctrl+Shift+Z)
  useKeyboardShortcuts();

  // Responsive layout: auto-close panels when window is narrow
  useResponsiveLayout();

  // Autosave when browser tab/window loses focus
  useAutoSaveOnBlur();

  // Auto-open right panel when a node or edge is selected
  useEffect(() => {
    if (selectedNodeId || selectedEdgeId) {
      openRightPanel();
    }
  }, [selectedNodeId, selectedEdgeId, openRightPanel]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Auto-load file from URL parameter (for development/testing)
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(window.location.search);
    const loadFile = params.get('load');
    if (loadFile) {
      loadFromUrl(`/${loadFile}`).then((success) => {
        if (success) {
          console.log(`[App] Auto-loaded file from URL param: ${loadFile}`);
        }
      });
    }
  }, [initialized, loadFromUrl]);

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <div className="text-[hsl(var(--muted-foreground))]">Initializing ArchCanvas...</div>
      </div>
    );
  }

  return (
    <FocusZoneProvider>
      <div className="h-screen w-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        {/* Toolbar - sticky at top */}
        <Toolbar />

        {/* Main content area: left panel, canvas, right panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - NodeDef Browser (draggable width) or collapsed expand strip */}
          {leftPanelOpen ? (
            <>
              <FocusZoneRegion zone={FocusZone.LeftPanel}>
                <aside
                  className="overflow-y-auto shrink-0 bg-white border-r h-full safe-area-left"
                  style={{ width: leftPanelWidth }}
                  data-testid="left-panel"
                >
                  <NodeDefBrowser />
                </aside>
              </FocusZoneRegion>
              <ResizeHandle side="left" onResize={handleLeftResize} />
            </>
          ) : (
            <button
              className="w-5 shrink-0 border-r bg-gray-50 hover:bg-gray-100 flex items-center justify-center cursor-pointer transition-colors"
              onClick={toggleLeftPanel}
              title="Expand node types panel"
              data-testid="left-panel-expand"
              aria-label="Expand node types panel"
            >
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}

          {/* Center - Canvas (always gets minimum usable space) */}
          <FocusZoneRegion zone={FocusZone.Canvas} className="flex-1 min-w-[200px] relative">
            <Canvas />
          </FocusZoneRegion>

          {/* Right Panel - Node/Edge Detail (draggable width) */}
          {rightPanelOpen && (
            <>
              <ResizeHandle side="right" onResize={handleRightResize} />
              <FocusZoneRegion zone={FocusZone.RightPanel}>
                <aside
                  className="overflow-y-auto shrink-0 bg-white border-l h-full safe-area-right"
                  style={{ width: rightPanelWidth }}
                  data-testid="right-panel"
                >
                  {selectedEdgeId ? <EdgeDetailPanel /> : <NodeDetailPanel />}
                </aside>
              </FocusZoneRegion>
            </>
          )}
        </div>

        {/* Delete Confirmation Dialog (overlay) */}
        <DeleteConfirmationDialog />

        {/* Connection Type Dialog (overlay) */}
        <ConnectionTypeDialog />

        {/* Unsaved Changes Dialog (overlay) */}
        <UnsavedChangesDialog />

        {/* Error Dialog (overlay) */}
        <ErrorDialog />

        {/* Integrity Warning Dialog (overlay) */}
        <IntegrityWarningDialog />

        {/* Keyboard Shortcuts Help Panel (overlay) */}
        <ShortcutsHelpPanel />

        {/* Keyboard Shortcut Settings Panel (overlay) */}
        <ShortcutSettingsPanel />

        {/* Command Palette (Cmd+K) */}
        <CommandPalette />

        {/* Quick Search (/) */}
        <QuickSearchOverlay />

        {/* Loading Overlay (file operations) */}
        <LoadingOverlay />

        {/* Toast notifications */}
        <Toast />

        {/* Status Bar */}
        <footer className="h-6 border-t flex items-center px-4 text-xs text-[hsl(var(--muted-foreground))] shrink-0 safe-area-bottom safe-area-left safe-area-right" data-testid="status-bar">
          <span data-testid="node-count">Nodes: {nodeCount}</span>
          <span className="mx-2">|</span>
          <span data-testid="edge-count">Edges: {edgeCount}</span>
          <span className="mx-2">|</span>
          <span data-testid="dirty-indicator">{isDirty ? '● Modified' : '✓ Saved'}</span>
          {(selectedNodeIds.length > 1 || selectedEdgeIds.length > 1) && (
            <>
              <span className="mx-2">|</span>
              <span data-testid="selection-count" className="text-blue-500 font-medium">
                Selected: {selectedNodeIds.length > 0 ? `${selectedNodeIds.length} node${selectedNodeIds.length !== 1 ? 's' : ''}` : `${selectedEdgeIds.length} edge${selectedEdgeIds.length !== 1 ? 's' : ''}`}
              </span>
            </>
          )}
          {autosaveStatusMessage && (
            <>
              <span className="mx-2">|</span>
              <span data-testid="autosave-status" className="text-green-600">{autosaveStatusMessage}</span>
            </>
          )}
          <span className="mx-2">|</span>
          <span data-testid="zoom-level">Zoom: {Math.round(zoom * 100)}%</span>
          {navigationPath.length > 0 && (
            <>
              <span className="mx-2">|</span>
              <span data-testid="breadcrumb" className="text-blue-600 font-medium">
                {(() => {
                  const parts = ['Root'];
                  for (const nodeId of navigationPath) {
                    const node = findNode(graph, nodeId);
                    parts.push(node ? node.displayName : nodeId);
                  }
                  return parts.join(' > ');
                })()}
              </span>
            </>
          )}
          {canvasMode !== CanvasMode.Normal && (
            <>
              <span className="mx-2">|</span>
              <span
                data-testid="mode-status"
                className={`font-mono font-bold ${MODE_DISPLAY[canvasMode].color}`}
              >
                {MODE_DISPLAY[canvasMode].shortLabel}
              </span>
            </>
          )}
        </footer>
      </div>
    </FocusZoneProvider>
  );
}

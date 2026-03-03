import { useEffect, useCallback } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
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
import { LoadingOverlay } from '@/components/shared/LoadingOverlay';
import { ResizeHandle } from '@/components/shared/ResizeHandle';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export function App() {
  const initialize = useCoreStore((s) => s.initialize);
  const initialized = useCoreStore((s) => s.initialized);
  const nodeCount = useCoreStore((s) => s.nodeCount);
  const edgeCount = useCoreStore((s) => s.edgeCount);
  const isDirty = useCoreStore((s) => s.isDirty);
  const loadFromUrl = useCoreStore((s) => s.loadFromUrl);

  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const leftPanelWidth = useUIStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const setLeftPanelWidth = useUIStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
  const zoom = useCanvasStore((s) => s.viewport.zoom);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth(leftPanelWidth + delta);
  }, [leftPanelWidth, setLeftPanelWidth]);

  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth(rightPanelWidth + delta);
  }, [rightPanelWidth, setRightPanelWidth]);

  // Global keyboard shortcuts (Ctrl+S, Ctrl+Shift+S, Ctrl+N, Ctrl+O, Ctrl+Z, Ctrl+Shift+Z)
  useKeyboardShortcuts();

  // Responsive layout: auto-close panels when window is narrow
  useResponsiveLayout();

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
    <div className="h-screen w-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Toolbar - sticky at top */}
      <Toolbar />

      {/* Main content area: left panel, canvas, right panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - NodeDef Browser (draggable width) */}
        {leftPanelOpen && (
          <>
            <aside
              className="overflow-y-auto shrink-0 bg-white border-r"
              style={{ width: leftPanelWidth }}
              data-testid="left-panel"
            >
              <NodeDefBrowser />
            </aside>
            <ResizeHandle side="left" onResize={handleLeftResize} />
          </>
        )}

        {/* Center - Canvas (always gets minimum usable space) */}
        <main className="flex-1 min-w-[200px] relative">
          <Canvas />
        </main>

        {/* Right Panel - Node/Edge Detail (draggable width) */}
        {rightPanelOpen && (
          <>
            <ResizeHandle side="right" onResize={handleRightResize} />
            <aside
              className="overflow-y-auto shrink-0 bg-white border-l"
              style={{ width: rightPanelWidth }}
              data-testid="right-panel"
            >
              {selectedEdgeId ? <EdgeDetailPanel /> : <NodeDetailPanel />}
            </aside>
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

      {/* Loading Overlay (file operations) */}
      <LoadingOverlay />

      {/* Status Bar */}
      <footer className="h-6 border-t flex items-center px-4 text-xs text-[hsl(var(--muted-foreground))] shrink-0" data-testid="status-bar">
        <span data-testid="node-count">Nodes: {nodeCount}</span>
        <span className="mx-2">|</span>
        <span data-testid="edge-count">Edges: {edgeCount}</span>
        <span className="mx-2">|</span>
        <span data-testid="dirty-indicator">{isDirty ? '● Modified' : '✓ Saved'}</span>
        <span className="mx-2">|</span>
        <span data-testid="zoom-level">Zoom: {Math.round(zoom * 100)}%</span>
      </footer>
    </div>
  );
}

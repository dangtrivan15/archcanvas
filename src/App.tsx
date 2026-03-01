import { useEffect } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { Toolbar } from '@/components/toolbar';
import { Canvas } from '@/components/canvas/Canvas';
import { NodeDetailPanel } from '@/components/panels/NodeDetailPanel';

export function App() {
  const initialize = useCoreStore((s) => s.initialize);
  const initialized = useCoreStore((s) => s.initialized);
  const nodeCount = useCoreStore((s) => s.nodeCount);
  const edgeCount = useCoreStore((s) => s.edgeCount);
  const loadFromUrl = useCoreStore((s) => s.loadFromUrl);

  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const openRightPanel = useUIStore((s) => s.openRightPanel);

  // Auto-open right panel when a node is selected
  useEffect(() => {
    if (selectedNodeId) {
      openRightPanel();
    }
  }, [selectedNodeId, openRightPanel]);

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

      {/* Main content area: canvas, right panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center - Canvas */}
        <main className="flex-1 relative">
          <Canvas />
        </main>

        {/* Right Panel - Node Detail */}
        {rightPanelOpen && (
          <aside className="w-80 border-l overflow-y-auto shrink-0 bg-white" data-testid="right-panel">
            <NodeDetailPanel />
          </aside>
        )}
      </div>

      {/* Status Bar */}
      <footer className="h-6 border-t flex items-center px-4 text-xs text-[hsl(var(--muted-foreground))] shrink-0" data-testid="status-bar">
        <span data-testid="node-count">Nodes: {nodeCount}</span>
        <span className="mx-2">|</span>
        <span data-testid="edge-count">Edges: {edgeCount}</span>
        <span className="mx-2">|</span>
        <span>Zoom: 100%</span>
      </footer>
    </div>
  );
}

import { useEffect } from 'react';
import { useCoreStore } from '@/store/coreStore';
import { Toolbar } from '@/components/toolbar';

export function App() {
  const initialize = useCoreStore((s) => s.initialize);
  const initialized = useCoreStore((s) => s.initialized);
  const nodeCount = useCoreStore((s) => s.nodeCount);
  const edgeCount = useCoreStore((s) => s.edgeCount);

  useEffect(() => {
    initialize();
  }, [initialize]);

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
        {/* Left Panel - NodeDef Browser */}
        <aside className="w-60 border-r overflow-y-auto shrink-0">
          <div className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
            NodeDef Browser
          </div>
        </aside>

        {/* Center - Canvas */}
        <main className="flex-1 relative">
          <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--muted-foreground))]">
            Canvas — No file open
          </div>
        </main>

        {/* Right Panel - Node Detail */}
        <aside className="w-80 border-l overflow-y-auto shrink-0 hidden">
          <div className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
            Node Detail Panel
          </div>
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="h-6 border-t flex items-center px-4 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
        <span>Nodes: {nodeCount}</span>
        <span className="mx-2">|</span>
        <span>Edges: {edgeCount}</span>
        <span className="mx-2">|</span>
        <span>Zoom: 100%</span>
      </footer>
    </div>
  );
}

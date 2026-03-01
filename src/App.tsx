import { useEffect } from 'react';
import { useCoreStore } from '@/store/coreStore';

export function App() {
  const initialize = useCoreStore((s) => s.initialize);
  const initialized = useCoreStore((s) => s.initialized);
  const nodeCount = useCoreStore((s) => s.nodeCount);
  const edgeCount = useCoreStore((s) => s.edgeCount);
  const isDirty = useCoreStore((s) => s.isDirty);
  const fileName = useCoreStore((s) => s.fileName);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-muted-foreground">Initializing ArchCanvas...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <header className="h-12 border-b flex items-center px-4 shrink-0">
        <h1 className="text-lg font-semibold">ArchCanvas</h1>
        <span className="ml-4 text-sm text-muted-foreground">
          {fileName}{isDirty ? ' *' : ''}
        </span>
      </header>

      {/* Main content area: left panel, canvas, right panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - NodeDef Browser */}
        <aside className="w-60 border-r overflow-y-auto shrink-0">
          <div className="p-4 text-sm text-muted-foreground">
            NodeDef Browser
          </div>
        </aside>

        {/* Center - Canvas */}
        <main className="flex-1 relative">
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Canvas — No file open
          </div>
        </main>

        {/* Right Panel - Node Detail */}
        <aside className="w-80 border-l overflow-y-auto shrink-0 hidden">
          <div className="p-4 text-sm text-muted-foreground">
            Node Detail Panel
          </div>
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="h-6 border-t flex items-center px-4 text-xs text-muted-foreground shrink-0">
        <span>Nodes: {nodeCount}</span>
        <span className="mx-2">|</span>
        <span>Edges: {edgeCount}</span>
        <span className="mx-2">|</span>
        <span>Zoom: 100%</span>
      </footer>
    </div>
  );
}

/**
 * NodePalette - Touch-friendly node palette for dragging node types onto the canvas.
 * Uses pointer events (not HTML5 DnD) for iPad/touch compatibility.
 * Renders as a floating bottom sheet on compact viewports, sidebar-like on regular/wide.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Box, Server, Database, HardDrive, Radio, Globe, Shield, Cpu, Layers,
  GripVertical, Search, X,
} from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useCoreStore } from '@/store/coreStore';
import { useViewportSize } from '@/hooks/useViewportSize';
import type { NodeDef } from '@/types/nodedef';

const iconMap: Record<string, React.ElementType> = {
  Server, Database, HardDrive, Radio, Globe, Shield, Cpu, Layers, Box,
};

const namespaceLabels: Record<string, string> = {
  compute: 'Compute',
  data: 'Data',
  messaging: 'Messaging',
  network: 'Network',
  observability: 'Observability',
};

interface DragState {
  nodeType: string;
  displayName: string;
  icon: string;
  /** Current pointer position (client coords) */
  clientX: number;
  clientY: number;
  /** Whether we're actively dragging (moved beyond threshold) */
  active: boolean;
  /** Start position for threshold detection */
  startX: number;
  startY: number;
}

const DRAG_THRESHOLD = 8; // px before drag activates

export function NodePalette() {
  const registry = useCoreStore((s) => s.registry);
  const addNode = useCoreStore((s) => s.addNode);
  const { isCompact } = useViewportSize();
  const { screenToFlowPosition } = useReactFlow();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Get all nodedefs, filtered by search
  const allNodeDefs = useMemo(() => {
    if (!registry) return [];
    if (searchQuery.trim()) {
      return registry.search(searchQuery.trim());
    }
    return registry.listAll();
  }, [registry, searchQuery]);

  // Group by namespace
  const groupedNodeDefs = useMemo(() => {
    const groups: Record<string, NodeDef[]> = {};
    for (const def of allNodeDefs) {
      const ns = def.metadata.namespace;
      if (!groups[ns]) groups[ns] = [];
      groups[ns]!.push(def);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [allNodeDefs]);

  // Pointer-based drag handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, def: NodeDef) => {
      // Only respond to primary button (touch, pen, or left mouse)
      if (e.button !== 0) return;

      const typeKey = `${def.metadata.namespace}/${def.metadata.name}`;
      setDragState({
        nodeType: typeKey,
        displayName: def.metadata.displayName,
        icon: def.metadata.icon,
        clientX: e.clientX,
        clientY: e.clientY,
        active: false,
        startX: e.clientX,
        startY: e.clientY,
      });

      // Capture pointer so we get move/up events even outside the element
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!dragState.active && distance < DRAG_THRESHOLD) return;

      setDragState((prev) =>
        prev ? { ...prev, clientX: e.clientX, clientY: e.clientY, active: true } : null,
      );
    },
    [dragState],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;

      if (dragState.active) {
        // Drop: create node at the pointer position on the canvas
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        addNode({
          type: dragState.nodeType,
          displayName: dragState.displayName,
          position: { x: position.x, y: position.y },
        });

        // Close palette on compact after drop
        if (isCompact) {
          setIsOpen(false);
        }
      }

      // Release pointer capture
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // May already be released
      }

      setDragState(null);
    },
    [dragState, screenToFlowPosition, addNode, isCompact],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setDragState(null);
    },
    [],
  );

  // Also handle global pointer events for drag that leaves the palette
  useEffect(() => {
    if (!dragState?.active) return;

    const handleGlobalMove = (e: PointerEvent) => {
      setDragState((prev) =>
        prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null,
      );
    };

    const handleGlobalUp = (e: PointerEvent) => {
      if (dragState?.active) {
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        addNode({
          type: dragState.nodeType,
          displayName: dragState.displayName,
          position: { x: position.x, y: position.y },
        });
        if (isCompact) {
          setIsOpen(false);
        }
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
    };
  }, [dragState?.active, dragState?.nodeType, dragState?.displayName, screenToFlowPosition, addNode, isCompact]);

  // Render a single palette item
  const renderItem = (def: NodeDef) => {
    const typeKey = `${def.metadata.namespace}/${def.metadata.name}`;
    const Icon = iconMap[def.metadata.icon] ?? Box;
    const isDragging = dragState?.active && dragState.nodeType === typeKey;

    return (
      <div
        key={typeKey}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-grab select-none
                   transition-colors touch-none
                   ${isDragging ? 'opacity-40 bg-blue-50' : 'hover:bg-blue-50 active:bg-blue-100'}`}
        data-testid={`palette-item-${typeKey}`}
        onPointerDown={(e) => handlePointerDown(e, def)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center shrink-0 border border-blue-100">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-800 truncate">
            {def.metadata.displayName}
          </div>
          <div className="text-[11px] text-gray-400 truncate">
            {def.metadata.description}
          </div>
        </div>
        <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
      </div>
    );
  };

  // Ghost preview that follows finger/pencil
  const ghostPreview = dragState?.active ? (
    <div
      ref={ghostRef}
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: dragState.clientX - 60,
        top: dragState.clientY - 24,
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/90 shadow-lg border border-blue-200 backdrop-blur-sm">
        {(() => {
          const Icon = iconMap[dragState.icon] ?? Box;
          return <Icon className="w-5 h-5 text-blue-600" />;
        })()}
        <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
          {dragState.displayName}
        </span>
      </div>
    </div>
  ) : null;

  // Palette content (shared between bottom sheet and sidebar modes)
  const paletteContent = (
    <div className="flex flex-col h-full" ref={paletteRef}>
      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white
                       focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400
                       placeholder:text-gray-400"
            data-testid="palette-search"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto px-1 pb-2" data-testid="palette-list">
        {groupedNodeDefs.length === 0 ? (
          <div className="px-3 py-4 text-sm text-gray-400 text-center">
            {searchQuery ? 'No matching nodes' : 'No node types available'}
          </div>
        ) : (
          groupedNodeDefs.map(([namespace, defs]) => (
            <div key={namespace} className="mb-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {namespaceLabels[namespace] || namespace}
              </div>
              {defs.map(renderItem)}
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Toggle button (FAB-like)
  const toggleButton = (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={`flex items-center justify-center rounded-full shadow-lg transition-all
                 ${isOpen
                   ? 'bg-gray-700 text-white w-10 h-10'
                   : 'bg-blue-600 text-white px-4 h-10 gap-2 hover:bg-blue-700'
                 }`}
      data-testid="palette-toggle"
      aria-label={isOpen ? 'Close node palette' : 'Add node'}
      title={isOpen ? 'Close palette' : 'Add node from palette'}
    >
      {isOpen ? (
        <X className="w-5 h-5" />
      ) : (
        <>
          <Box className="w-5 h-5" />
          <span className="text-sm font-medium">Add</span>
        </>
      )}
    </button>
  );

  // Compact mode: bottom sheet
  if (isCompact) {
    return (
      <>
        {/* Toggle FAB - bottom-right */}
        <div className="absolute bottom-4 right-4 z-40" data-testid="palette-fab-container">
          {toggleButton}
        </div>

        {/* Bottom sheet */}
        {isOpen && (
          <div
            className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200"
            style={{ maxHeight: '55vh' }}
            data-testid="palette-sheet"
          >
            {/* Sheet handle */}
            <div className="flex items-center justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2">
              <h3 className="text-sm font-semibold text-gray-700">Node Palette</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                data-testid="palette-sheet-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div style={{ maxHeight: 'calc(55vh - 56px)', overflow: 'auto' }}>
              {paletteContent}
            </div>
          </div>
        )}

        {/* Ghost preview overlay */}
        {ghostPreview}
      </>
    );
  }

  // Regular/wide mode: collapsible sidebar-like panel (floating on left side of canvas)
  return (
    <>
      {/* Toggle button - top-left area of canvas */}
      <div className="absolute top-3 left-3 z-30" data-testid="palette-toggle-container">
        {toggleButton}
      </div>

      {/* Floating palette panel */}
      {isOpen && (
        <div
          className="absolute top-14 left-3 z-30 bg-white rounded-xl shadow-xl border border-gray-200 w-64"
          style={{ maxHeight: 'calc(100% - 70px)' }}
          data-testid="palette-panel"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Node Palette</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400"
              data-testid="palette-panel-close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
            {paletteContent}
          </div>
        </div>
      )}

      {/* Ghost preview overlay */}
      {ghostPreview}
    </>
  );
}

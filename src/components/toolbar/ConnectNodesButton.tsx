/**
 * Connect Nodes button - creates an edge between two nodes.
 * Shows a dropdown with source/target node selection and edge type.
 */

import { useState, useRef, useEffect } from 'react';
import { Link2 } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';

export function ConnectNodesButton({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [edgeType, setEdgeType] = useState<'sync' | 'async' | 'data-flow'>('sync');
  const [sourceIdx, setSourceIdx] = useState(0);
  const [targetIdx, setTargetIdx] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addEdge = useCoreStore((s) => s.addEdge);
  const graph = useCoreStore((s) => s.graph);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleConnect = () => {
    const nodes = graph.nodes;
    if (nodes.length < 2) return;
    const source = nodes[sourceIdx];
    const target = nodes[targetIdx];
    if (!source || !target || source.id === target.id) return;

    const edge = addEdge({
      fromNode: source.id,
      toNode: target.id,
      type: edgeType,
    });

    if (edge) {
      console.log(`[ConnectNodes] Edge created: ${source.displayName} → ${target.displayName} [${edgeType}]`);
    }

    setIsOpen(false);
  };

  const nodes = graph.nodes;
  const hasEnoughNodes = nodes.length >= 2;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
        data-testid="connect-nodes-button"
        title="Connect two nodes with an edge"
        disabled={!hasEnoughNodes}
      >
        <Link2 className="w-4 h-4" />
        {!compact && <span>Connect</span>}
      </button>

      {isOpen && hasEnoughNodes && (
        <div
          className="absolute top-full left-0 mt-1 w-72 bg-white border rounded-lg shadow-lg z-50 p-3 space-y-3"
          data-testid="connect-nodes-dropdown"
        >
          <div className="text-sm font-medium text-gray-700">Create Edge</div>

          {/* Source node selector */}
          <div>
            <label htmlFor="edge-source-select" className="text-xs text-gray-500">From Node</label>
            <select
              id="edge-source-select"
              value={sourceIdx}
              onChange={(e) => setSourceIdx(Number(e.target.value))}
              className="w-full mt-0.5 text-sm border rounded px-2 py-1.5"
              data-testid="edge-source-select"
            >
              {nodes.map((node, i) => (
                <option key={node.id} value={i}>
                  {node.displayName} ({node.type})
                </option>
              ))}
            </select>
          </div>

          {/* Target node selector */}
          <div>
            <label htmlFor="edge-target-select" className="text-xs text-gray-500">To Node</label>
            <select
              id="edge-target-select"
              value={targetIdx}
              onChange={(e) => setTargetIdx(Number(e.target.value))}
              className="w-full mt-0.5 text-sm border rounded px-2 py-1.5"
              data-testid="edge-target-select"
            >
              {nodes.map((node, i) => (
                <option key={node.id} value={i}>
                  {node.displayName} ({node.type})
                </option>
              ))}
            </select>
          </div>

          {/* Edge type selector */}
          <div>
            <label htmlFor="edge-type-select" className="text-xs text-gray-500">Edge Type</label>
            <select
              id="edge-type-select"
              value={edgeType}
              onChange={(e) => setEdgeType(e.target.value as 'sync' | 'async' | 'data-flow')}
              className="w-full mt-0.5 text-sm border rounded px-2 py-1.5"
              data-testid="edge-type-select"
            >
              <option value="sync">Sync (solid line)</option>
              <option value="async">Async (dashed line)</option>
              <option value="data-flow">Data Flow (thick line)</option>
            </select>
          </div>

          <button
            onClick={handleConnect}
            className="w-full py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            data-testid="create-edge-button"
          >
            Create Edge
          </button>
        </div>
      )}
    </div>
  );
}

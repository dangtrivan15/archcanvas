/**
 * Add Node button - dropdown to select nodedef type and add to canvas.
 */

import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';

const NODE_TYPES = [
  { type: 'compute/service', label: 'Service', group: 'Compute' },
  { type: 'compute/function', label: 'Function', group: 'Compute' },
  { type: 'compute/worker', label: 'Worker', group: 'Compute' },
  { type: 'compute/api-gateway', label: 'API Gateway', group: 'Compute' },
  { type: 'data/database', label: 'Database', group: 'Data' },
  { type: 'data/cache', label: 'Cache', group: 'Data' },
  { type: 'data/object-storage', label: 'Object Storage', group: 'Data' },
  { type: 'messaging/message-queue', label: 'Message Queue', group: 'Messaging' },
  { type: 'messaging/event-bus', label: 'Event Bus', group: 'Messaging' },
  { type: 'network/load-balancer', label: 'Load Balancer', group: 'Network' },
  { type: 'network/cdn', label: 'CDN', group: 'Network' },
];

export function AddNodeButton({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addNode = useCoreStore((s) => s.addNode);
  const graph = useCoreStore((s) => s.graph);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);

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

  const handleAddNode = (type: string, label: string) => {
    const name = customName.trim() || label;
    // Position nodes in a grid-like pattern
    const existingCount = graph.nodes.length;
    const col = existingCount % 3;
    const row = Math.floor(existingCount / 3);
    const x = 100 + col * 300;
    const y = 100 + row * 200;

    addNode({
      type,
      displayName: name,
      position: { x, y },
    });

    setCustomName('');
    setIsOpen(false);
    console.log(`[AddNodeButton] Added ${type} node: ${name}`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          // Open the NodeDef browser panel if not already open
          if (!leftPanelOpen) {
            toggleLeftPanel();
          }
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-[hsl(var(--muted))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
        data-testid="add-node-button"
        title="Add Node"
      >
        <Plus className="w-4 h-4" />
        {!compact && <span>Add Node</span>}
        {!compact && <ChevronDown className="w-3 h-3 ml-0.5" />}
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-72 bg-white border rounded-lg shadow-lg z-50 overflow-hidden"
          data-testid="add-node-dropdown"
        >
          {/* Custom name input */}
          <div className="p-2 border-b">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Custom name (optional)"
              aria-label="Custom node name"
              className="w-full text-sm border rounded px-2 py-1.5"
              data-testid="custom-node-name-input"
              autoFocus
            />
          </div>

          {/* Node type list grouped */}
          <div className="max-h-64 overflow-y-auto">
            {['Compute', 'Data', 'Messaging', 'Network'].map((group) => (
              <div key={group}>
                <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50">
                  {group}
                </div>
                {NODE_TYPES.filter((n) => n.group === group).map((nodeType) => (
                  <button
                    key={nodeType.type}
                    onClick={() => handleAddNode(nodeType.type, nodeType.label)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
                    data-testid={`add-node-${nodeType.type.replace('/', '-')}`}
                  >
                    <span>{nodeType.label}</span>
                    <span className="text-xs text-gray-400 font-mono">{nodeType.type}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

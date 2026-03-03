/**
 * ConnectionTypeDialog - modal for selecting edge type when creating a connection.
 * Appears when the user drags from an outbound port to an inbound port.
 * Lets the user choose between sync, async, and data-flow edge types.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Zap, Database } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type EdgeType = 'sync' | 'async' | 'data-flow';

const EDGE_TYPE_OPTIONS: {
  type: EdgeType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    type: 'sync',
    label: 'Synchronous',
    description: 'Direct request-response call (HTTP, gRPC)',
    icon: ArrowRight,
    color: 'text-blue-600',
  },
  {
    type: 'async',
    label: 'Asynchronous',
    description: 'Event-driven or message-based communication',
    icon: Zap,
    color: 'text-purple-600',
  },
  {
    type: 'data-flow',
    label: 'Data Flow',
    description: 'Data pipeline or ETL stream',
    icon: Database,
    color: 'text-green-600',
  },
];

export function ConnectionTypeDialog() {
  const connectionDialogOpen = useUIStore((s) => s.connectionDialogOpen);
  const connectionDialogInfo = useUIStore((s) => s.connectionDialogInfo);
  const closeConnectionDialog = useUIStore((s) => s.closeConnectionDialog);
  const addEdge = useCoreStore((s) => s.addEdge);

  const [selectedType, setSelectedType] = useState<EdgeType>('sync');
  const [label, setLabel] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(connectionDialogOpen);

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (connectionDialogOpen && confirmRef.current) {
      confirmRef.current.focus();
    }
    // Reset state when dialog opens
    if (connectionDialogOpen) {
      setSelectedType('sync');
      setLabel('');
    }
  }, [connectionDialogOpen]);

  // Handle keyboard: Escape to cancel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!connectionDialogOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeConnectionDialog();
      }
    },
    [connectionDialogOpen, closeConnectionDialog],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  const handleConfirm = useCallback(() => {
    if (!connectionDialogInfo) return;

    addEdge({
      fromNode: connectionDialogInfo.sourceNodeId,
      toNode: connectionDialogInfo.targetNodeId,
      type: selectedType,
      fromPort: connectionDialogInfo.sourceHandle,
      toPort: connectionDialogInfo.targetHandle,
      label: label.trim() || undefined,
    });

    console.log('[ConnectionTypeDialog] Edge created:', selectedType, connectionDialogInfo.sourceNodeId, '->', connectionDialogInfo.targetNodeId);
    closeConnectionDialog();
  }, [connectionDialogInfo, selectedType, label, addEdge, closeConnectionDialog]);

  const handleCancel = useCallback(() => {
    closeConnectionDialog();
  }, [closeConnectionDialog]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeConnectionDialog();
      }
    },
    [closeConnectionDialog],
  );

  if (!connectionDialogOpen || !connectionDialogInfo) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="connection-type-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-dialog-title"
    >
      <div ref={focusTrapRef} className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-5" data-testid="connection-dialog-content">
        {/* Header */}
        <h2 id="connection-dialog-title" className="text-lg font-semibold text-gray-900 mb-1">
          Create Connection
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Choose the connection type for this edge.
        </p>

        {/* Edge type selection */}
        <div className="space-y-2 mb-4" data-testid="edge-type-options">
          {EDGE_TYPE_OPTIONS.map((option) => {
            const IconComp = option.icon;
            const isSelected = selectedType === option.type;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => setSelectedType(option.type)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                data-testid={`edge-type-${option.type}`}
                data-selected={isSelected}
              >
                <IconComp className={`w-5 h-5 ${option.color} shrink-0`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Optional label input */}
        <div className="mb-4">
          <label htmlFor="edge-label" className="block text-sm font-medium text-gray-700 mb-1">
            Label <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="edge-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., REST API, events, data sync"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            data-testid="edge-label-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
              }
            }}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="connection-cancel-button"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="connection-confirm-button"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

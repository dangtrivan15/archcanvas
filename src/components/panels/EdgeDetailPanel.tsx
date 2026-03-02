/**
 * EdgeDetailPanel - shows selected edge details in the right panel.
 * Displays edge id, fromNode, toNode, type, label, properties, and notes.
 */

import { useMemo } from 'react';
import { X, Bot } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { findEdge, findNode } from '@/core/graph/graphEngine';

export function EdgeDetailPanel() {
  const graph = useCoreStore((s) => s.graph);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  const edge = useMemo(() => {
    if (!selectedEdgeId) return null;
    return findEdge(graph, selectedEdgeId);
  }, [graph, selectedEdgeId]);

  const fromNode = useMemo(() => {
    if (!edge) return null;
    return findNode(graph, edge.fromNode);
  }, [graph, edge]);

  const toNode = useMemo(() => {
    if (!edge) return null;
    return findNode(graph, edge.toNode);
  }, [graph, edge]);

  if (!edge) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400 p-4">
        Select an edge to view details
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="edge-detail-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate" data-testid="detail-edge-label">
            {edge.label || 'Edge'}
          </div>
          <div className="text-xs text-gray-400">
            {fromNode?.displayName ?? edge.fromNode} → {toNode?.displayName ?? edge.toNode}
          </div>
        </div>
        <button
          onClick={closeRightPanel}
          className="p-1 rounded hover:bg-gray-200 text-gray-400"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Edge properties */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-4">
          {/* Edge ID */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">ID</label>
            <div className="mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded break-all" data-testid="detail-edge-id">
              {edge.id}
            </div>
          </div>

          {/* From Node */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">From Node</label>
            <div className="mt-1 text-sm" data-testid="detail-edge-from">
              <div className="font-mono text-xs text-gray-400">{edge.fromNode}</div>
              {fromNode && <div className="text-gray-700">{fromNode.displayName}</div>}
            </div>
          </div>

          {/* To Node */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">To Node</label>
            <div className="mt-1 text-sm" data-testid="detail-edge-to">
              <div className="font-mono text-xs text-gray-400">{edge.toNode}</div>
              {toNode && <div className="text-gray-700">{toNode.displayName}</div>}
            </div>
          </div>

          {/* Edge Type */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</label>
            <div className="mt-1 text-sm font-mono" data-testid="detail-edge-type">
              {edge.type}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Label</label>
            <div className="mt-1 text-sm" data-testid="detail-edge-label-value">
              {edge.label || <span className="text-gray-400">none</span>}
            </div>
          </div>

          {/* Properties */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Properties</label>
            <div className="mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded" data-testid="detail-edge-properties">
              {Object.keys(edge.properties).length === 0
                ? <span className="text-gray-400">empty object {'{}'}</span>
                : JSON.stringify(edge.properties, null, 2)
              }
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Notes ({edge.notes.length})
            </label>
            <div className="mt-1 text-xs" data-testid="detail-edge-notes">
              {edge.notes.length === 0
                ? <span className="text-gray-400">empty array []</span>
                : edge.notes.map((note) => (
                    <div key={note.id} className="border rounded p-2 mt-1">
                      {note.author.toLowerCase() === 'ai' ? (
                        <div className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200" data-testid="note-author" data-author-type="ai">
                          <Bot className="w-3 h-3" />
                          AI
                        </div>
                      ) : (
                        <div className="font-medium" data-testid="note-author">{note.author}</div>
                      )}
                      <div>{note.content}</div>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

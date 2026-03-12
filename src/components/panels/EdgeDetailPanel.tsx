import { useState } from 'react';
import type { Edge } from '@/types';
import { useGraphStore } from '@/store/graphStore';
import { NotesTab } from './NotesTab';

interface Props {
  edge: Edge;
  canvasId: string;
}

export function EdgeDetailPanel({ edge, canvasId }: Props) {
  const from = edge.from.node;
  const to = edge.to.node;

  const [label, setLabel] = useState(edge.label ?? '');
  const [protocol, setProtocol] = useState(edge.protocol ?? '');
  const [newEntity, setNewEntity] = useState('');
  const [showEntityInput, setShowEntityInput] = useState(false);

  const entities = edge.entities ?? [];
  const notes = edge.notes ?? [];

  const saveField = (updates: { label?: string; protocol?: string }) => {
    useGraphStore.getState().updateEdge(canvasId, from, to, updates);
  };

  const addEntity = () => {
    const trimmed = newEntity.trim();
    if (!trimmed) return;
    useGraphStore.getState().updateEdge(canvasId, from, to, {
      entities: [...entities, trimmed],
    });
    setNewEntity('');
    setShowEntityInput(false);
  };

  const removeEntity = (name: string) => {
    useGraphStore.getState().updateEdge(canvasId, from, to, {
      entities: entities.filter((e) => e !== name),
    });
  };

  const inputClass = 'w-full border rounded px-1 py-0.5 text-xs';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b">
        <h3 className="font-medium text-sm">
          <span className="font-mono">{from}</span>
          <span className="text-gray-400 mx-1">→</span>
          <span className="font-mono">{to}</span>
        </h3>
        {edge.protocol && (
          <p className="text-xs text-gray-500 mt-0.5">{edge.protocol}</p>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Label */}
        <div className="text-xs">
          <label className="block font-medium text-gray-700 mb-0.5">Label</label>
          <input
            className={inputClass}
            value={label}
            placeholder="Optional label"
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => saveField({ label: label || undefined })}
            onKeyDown={(e) => e.key === 'Enter' && saveField({ label: label || undefined })}
          />
        </div>

        {/* Protocol */}
        <div className="text-xs">
          <label className="block font-medium text-gray-700 mb-0.5">Protocol</label>
          <input
            className={inputClass}
            value={protocol}
            placeholder="e.g. HTTP, gRPC, Kafka"
            onChange={(e) => setProtocol(e.target.value)}
            onBlur={() => saveField({ protocol: protocol || undefined })}
            onKeyDown={(e) => e.key === 'Enter' && saveField({ protocol: protocol || undefined })}
          />
        </div>

        {/* Entities */}
        <div className="text-xs">
          <label className="block font-medium text-gray-700 mb-1">Entities</label>
          {entities.length === 0 && !showEntityInput && (
            <p className="text-gray-400 mb-1">No entities.</p>
          )}
          <div className="flex flex-wrap gap-1 mb-1">
            {entities.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-0.5 bg-purple-50 text-purple-700 rounded px-1.5 py-0.5 text-[10px]"
              >
                {name}
                <button
                  onClick={() => removeEntity(name)}
                  className="text-purple-400 hover:text-purple-700 ml-0.5 leading-none"
                  title="Remove entity"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {showEntityInput ? (
            <div className="flex gap-1 items-center">
              <input
                autoFocus
                className="flex-1 border rounded px-1.5 py-0.5 text-xs"
                placeholder="Entity name"
                value={newEntity}
                onChange={(e) => setNewEntity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addEntity();
                  if (e.key === 'Escape') { setShowEntityInput(false); setNewEntity(''); }
                }}
              />
              <button
                onClick={addEntity}
                className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => { setShowEntityInput(false); setNewEntity(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 px-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowEntityInput(true)}
              className="text-blue-600 hover:underline"
            >
              + Add Entity
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="text-xs">
          <label className="block font-medium text-gray-700 mb-1">Notes</label>
          <NotesTab notes={notes} canvasId={canvasId} from={from} to={to} />
        </div>
      </div>
    </div>
  );
}

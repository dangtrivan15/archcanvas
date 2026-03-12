import { useState } from 'react';
import type { InlineNode } from '@/types';
import type { NodeDef } from '@/types/nodeDefSchema';
import { useGraphStore } from '@/store/graphStore';
import { PropertiesTab } from './PropertiesTab';

interface Props {
  node: InlineNode;
  nodeDef: NodeDef | undefined;
  canvasId: string;
}

export function NodeDetailPanel({ node, nodeDef, canvasId }: Props) {
  const [activeTab, setActiveTab] = useState<'properties' | 'notes' | 'code'>('properties');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(node.displayName ?? node.id);

  const saveName = () => {
    useGraphStore.getState().updateNode(canvasId, node.id, { displayName: nameValue });
    setEditingName(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b">
        {editingName ? (
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            autoFocus
            className="font-medium text-sm border rounded px-1 w-full"
          />
        ) : (
          <h3
            className="font-medium text-sm cursor-pointer hover:text-blue-600"
            onClick={() => setEditingName(true)}
          >
            {node.displayName ?? node.id}
          </h3>
        )}
        <p className="text-xs text-gray-500 mt-0.5">{node.type}</p>
        {nodeDef && (
          <p className="text-xs text-gray-400 mt-0.5">{nodeDef.metadata.displayName}</p>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b text-xs">
        {(['properties', 'notes', 'code'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 capitalize ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'properties' && (
          <PropertiesTab node={node} nodeDef={nodeDef} canvasId={canvasId} />
        )}
        {activeTab === 'notes' && (
          <div className="text-xs text-gray-400">Notes coming in Task 11</div>
        )}
        {activeTab === 'code' && (
          <div className="text-xs text-gray-400">Code refs coming in Task 11</div>
        )}
      </div>
    </div>
  );
}

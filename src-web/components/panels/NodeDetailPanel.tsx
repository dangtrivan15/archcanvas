import { useState, useEffect } from 'react';
import type { InlineNode } from '@/types';
import type { NodeDef } from '@/types/nodeDefSchema';
import { useGraphStore } from '@/store/graphStore';
import { useUiStore } from '@/store/uiStore';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PropertiesTab } from './PropertiesTab';
import { NotesTab } from './NotesTab';
import { CodeRefsTab } from './CodeRefsTab';
import { NodeColorPicker } from './NodeColorPicker';

interface Props {
  node: InlineNode;
  nodeDef: NodeDef | undefined;
  canvasId: string;
}

export function NodeDetailPanel({ node, nodeDef, canvasId }: Props) {
  const [activeTab, setActiveTab] = useState<'properties' | 'notes' | 'code'>('properties');
  const detailPanelTab = useUiStore((s) => s.detailPanelTab);

  // External tab-switch API: uiStore.setDetailPanelTab() drives the active tab
  useEffect(() => {
    if (!detailPanelTab) return;
    const mapped = detailPanelTab === 'codeRefs' ? 'code' : detailPanelTab;
    setActiveTab(mapped);
    useUiStore.getState().setDetailPanelTab(null); // clear after applying
  }, [detailPanelTab]);

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
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
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
                className="font-medium text-sm cursor-pointer hover:text-blue-600 flex items-center gap-1.5"
                onClick={() => setEditingName(true)}
              >
                {nodeDef?.metadata.icon && (
                  <span className="text-base" aria-hidden="true">{nodeDef.metadata.icon}</span>
                )}
                {node.displayName ?? node.id}
              </h3>
            )}
            <p className="text-xs text-gray-500 mt-0.5">{node.type}</p>
            {nodeDef && (
              <p className="text-xs text-gray-400 mt-0.5">{nodeDef.metadata.displayName}</p>
            )}
          </div>
          <NodeColorPicker
            canvasId={canvasId}
            nodeId={node.id}
            currentColor={node.color}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList className="h-auto rounded-none border-b bg-transparent p-0 text-xs">
          <TabsTrigger
            value="properties"
            className="rounded-none border-b-2 border-transparent px-3 py-1.5 text-xs capitalize shadow-none data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            properties
          </TabsTrigger>
          <TabsTrigger
            value="notes"
            className="rounded-none border-b-2 border-transparent px-3 py-1.5 text-xs capitalize shadow-none data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            notes
          </TabsTrigger>
          <TabsTrigger
            value="code"
            className="rounded-none border-b-2 border-transparent px-3 py-1.5 text-xs capitalize shadow-none data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            code
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-3">
          <TabsContent value="properties" className="mt-0">
            <PropertiesTab node={node} nodeDef={nodeDef} canvasId={canvasId} />
          </TabsContent>
          <TabsContent value="notes" className="mt-0">
            <NotesTab notes={node.notes ?? []} canvasId={canvasId} nodeId={node.id} />
          </TabsContent>
          <TabsContent value="code" className="mt-0">
            <CodeRefsTab codeRefs={node.codeRefs ?? []} canvasId={canvasId} nodeId={node.id} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

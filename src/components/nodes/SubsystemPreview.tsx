import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { useMemo } from 'react';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { PreviewModeContext } from './PreviewModeContext';
import { NodeRenderer } from './NodeRenderer';
import { EdgeRenderer } from '../edges/EdgeRenderer';
import { mapCanvasNodes, mapCanvasEdges } from '../canvas/mapCanvasData';

interface SubsystemPreviewProps {
  canvasId: string;
}

const previewNodeTypes = { archNode: NodeRenderer };
const previewEdgeTypes = { archEdge: EdgeRenderer };
const emptySet = new Set<string>();

export function SubsystemPreview({ canvasId }: SubsystemPreviewProps) {
  const canvas = useFileStore((s) => {
    void s.project?.canvases; // touch Map ref for subscription
    return s.getCanvas(canvasId);
  });
  const canvasesRef = useFileStore((s) => s.project?.canvases);
  const resolve = useRegistryStore((s) => s.resolve);

  const nodes = canvas?.data?.nodes ?? [];

  const rfNodes = useMemo(
    () => mapCanvasNodes({
      canvas: canvas?.data,
      resolve,
      selectedNodeIds: emptySet,
      canvasesRef,
    }),
    [canvas, resolve, canvasesRef],
  );

  const rfEdges = useMemo(
    () => mapCanvasEdges(canvas?.data),
    [canvas],
  );

  if (nodes.length === 0) return null;

  return (
    <div className="subsystem-preview" style={{ width: '100%', flex: 1, minHeight: 0 }}>
      <PreviewModeContext.Provider value={true}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={previewNodeTypes}
            edgeTypes={previewEdgeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={true}
            nodesFocusable={false}
            edgesFocusable={false}
            proOptions={{ hideAttribution: true }}
          />
        </ReactFlowProvider>
      </PreviewModeContext.Provider>
    </div>
  );
}

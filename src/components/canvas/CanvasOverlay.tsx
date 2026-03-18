import { useMemo, useEffect } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, useReactFlow } from '@xyflow/react';
import type { ReactFlowInstance } from '@xyflow/react';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { NodeRenderer } from '../nodes/NodeRenderer';
import { EdgeRenderer } from '../edges/EdgeRenderer';
import { PreviewModeContext } from '../nodes/PreviewModeContext';
import { mapCanvasNodes, mapCanvasEdges } from './mapCanvasData';

interface CanvasOverlayProps {
  canvasId: string;
  backdrop?: boolean;
  clipPath?: string;
  onReactFlowReady?: (rf: ReactFlowInstance) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

const overlayNodeTypes = { archNode: NodeRenderer };
const overlayEdgeTypes = { archEdge: EdgeRenderer };
const emptySet = new Set<string>();

function OverlayInner({ canvasId, onReactFlowReady }: {
  canvasId: string;
  onReactFlowReady?: (rf: ReactFlowInstance) => void;
}) {
  const reactFlow = useReactFlow();
  const canvas = useFileStore((s) => {
    void s.project?.canvases;
    return s.getCanvas(canvasId);
  });
  const canvasesRef = useFileStore((s) => s.project?.canvases);
  const resolve = useRegistryStore((s) => s.resolve);

  const rfNodes = useMemo(
    () => mapCanvasNodes({ canvas: canvas?.data, resolve, selectedNodeIds: emptySet, canvasesRef }),
    [canvas, resolve, canvasesRef],
  );
  const rfEdges = useMemo(() => mapCanvasEdges(canvas?.data), [canvas]);

  useEffect(() => {
    if (onReactFlowReady) onReactFlowReady(reactFlow as unknown as ReactFlowInstance);
  }, [reactFlow, onReactFlowReady]);

  return (
    <PreviewModeContext.Provider value={true}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={overlayNodeTypes}
        edgeTypes={overlayEdgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        nodesFocusable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </PreviewModeContext.Provider>
  );
}

export function CanvasOverlay({ canvasId, backdrop, clipPath, onReactFlowReady, containerRef }: CanvasOverlayProps) {
  return (
    <div
      ref={containerRef}
      className="canvas-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: backdrop ? 0 : 50,
        pointerEvents: 'none',
        clipPath: clipPath ?? undefined,
        overflow: 'hidden',
      }}
    >
      <ReactFlowProvider>
        <OverlayInner canvasId={canvasId} onReactFlowReady={onReactFlowReady} />
      </ReactFlowProvider>
    </div>
  );
}

import { ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useRef } from 'react';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { PreviewModeContext } from './PreviewModeContext';
import { NodeRenderer } from './NodeRenderer';
import { EdgeRenderer } from '../edges/EdgeRenderer';
import { mapCanvasNodes, mapCanvasEdges } from '../canvas/mapCanvasData';
import { computeFitViewport } from '@/lib/computeFitViewport';

interface SubsystemPreviewProps {
  canvasId: string;
}

const previewNodeTypes = { archNode: NodeRenderer };
const previewEdgeTypes = { archEdge: EdgeRenderer };
const emptySet = new Set<string>();

function ViewportSetter({ nodes }: { nodes: readonly { position: { x: number; y: number }; width?: number | null; height?: number | null }[] }) {
  const reactFlow = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current?.closest('.subsystem-preview');
    if (!el || nodes.length === 0) return;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const fitNodes = nodes.map((n) => ({
      x: n.position.x,
      y: n.position.y,
      width: n.width ?? 150,
      height: n.height ?? 40,
    }));

    const vp = computeFitViewport({
      nodes: fitNodes,
      viewportWidth: rect.width,
      viewportHeight: rect.height,
    });

    reactFlow.setViewport({ x: vp.offsetX, y: vp.offsetY, zoom: vp.zoom });
  }, [nodes, reactFlow]);

  return <div ref={containerRef} style={{ display: 'none' }} />;
}

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
    <div className="subsystem-preview" data-canvas-id={canvasId} style={{ width: '100%', flex: 1, minHeight: 0 }}>
      <PreviewModeContext.Provider value={true}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={previewNodeTypes}
            edgeTypes={previewEdgeTypes}
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
          >
            <ViewportSetter nodes={rfNodes} />
          </ReactFlow>
        </ReactFlowProvider>
      </PreviewModeContext.Provider>
    </div>
  );
}

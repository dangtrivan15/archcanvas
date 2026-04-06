import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { Canvas } from '@/types';
import type { CanvasNodeData, CanvasEdgeData } from './types';
import { PROTOCOL_STYLES } from './types';
import { computeAutoSize } from '@/lib/computeAutoSize';
import type { CanvasDiff } from '@/core/diff/types';

interface MapNodesOptions {
  canvas: Canvas | undefined;
  resolve: (type: string) => import('@/types/nodeDefSchema').NodeDef | undefined;
  selectedNodeIds: ReadonlySet<string>;
  canvasesRef: Map<string, { data: Canvas }> | undefined;
  /** Active canvas diff (undefined when diff overlay is off) */
  diff?: CanvasDiff;
}

export function mapCanvasNodes(opts: MapNodesOptions): RFNode<CanvasNodeData>[] {
  const { canvas, resolve, selectedNodeIds, canvasesRef, diff } = opts;
  const rawNodes = canvas?.nodes ?? [];
  return rawNodes.map((node) => {
    const isRef = 'ref' in node;
    const nodeDef = isRef ? undefined : resolve((node as { type: string }).type);
    const nodeDiffStatus = diff?.nodes.get(node.id)?.status;
    const data: CanvasNodeData = {
      node,
      nodeDef,
      isSelected: selectedNodeIds.has(node.id),
      isRef,
      diffStatus: nodeDiffStatus,
    };
    const rfNode: RFNode<CanvasNodeData> = {
      id: node.id,
      type: 'archNode',
      position: node.position ?? { x: 0, y: 0 },
      data,
    };

    if (isRef) {
      const childCanvas = canvasesRef?.get(node.id);
      const pos = node.position;
      if (pos?.autoSize === false) {
        rfNode.width = pos.width ?? 240;
        rfNode.height = pos.height ?? 160;
      } else {
        const { width, height } = computeAutoSize(childCanvas?.data);
        rfNode.width = width;
        rfNode.height = height;
      }
    }

    return rfNode;
  });
}

interface MapEdgesOptions {
  canvas: Canvas | undefined;
  selectedEdgeKeys: ReadonlySet<string>;
  /** Active canvas diff (undefined when diff overlay is off) */
  diff?: CanvasDiff;
}

export function mapCanvasEdges(opts: MapEdgesOptions): RFEdge<CanvasEdgeData>[] {
  const { canvas, selectedEdgeKeys, diff } = opts;
  const rawEdges = canvas?.edges ?? [];
  return rawEdges.map((edge) => {
    const protocol = edge.protocol;
    const styleCategory: 'sync' | 'async' | 'default' =
      protocol !== undefined
        ? (PROTOCOL_STYLES[protocol] ?? 'default')
        : 'default';
    const selectionKey = `${edge.from.node}→${edge.to.node}`;
    const isSelected = selectedEdgeKeys.has(selectionKey);
    // Compute diff status for this edge
    const diffEdgeKey = `${edge.from.node}:${edge.from.port ?? ''}→${edge.to.node}:${edge.to.port ?? ''}`;
    const edgeDiffStatus = diff?.edges.get(diffEdgeKey)?.status;
    const data: CanvasEdgeData = { edge, styleCategory, isSelected, diffStatus: edgeDiffStatus };
    return {
      id: `${edge.from.node}-${edge.to.node}`,
      source: edge.from.node,
      target: edge.to.node,
      type: 'archEdge',
      data,
    };
  });
}

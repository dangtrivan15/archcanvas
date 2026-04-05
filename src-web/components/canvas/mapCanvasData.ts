import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { Canvas } from '@/types';
import type { CanvasNodeData, CanvasEdgeData } from './types';
import { PROTOCOL_STYLES } from './types';
import { computeAutoSize } from '@/lib/computeAutoSize';

interface MapNodesOptions {
  canvas: Canvas | undefined;
  resolve: (type: string) => import('@/types/nodeDefSchema').NodeDef | undefined;
  selectedNodeIds: ReadonlySet<string>;
  canvasesRef: Map<string, { data: Canvas }> | undefined;
}

export function mapCanvasNodes(opts: MapNodesOptions): RFNode<CanvasNodeData>[] {
  const { canvas, resolve, selectedNodeIds, canvasesRef } = opts;
  const rawNodes = canvas?.nodes ?? [];
  return rawNodes.map((node) => {
    const isRef = 'ref' in node;
    const nodeDef = isRef ? undefined : resolve((node as { type: string }).type);
    const data: CanvasNodeData = {
      node,
      nodeDef,
      isSelected: selectedNodeIds.has(node.id),
      isRef,
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
}

export function mapCanvasEdges(opts: MapEdgesOptions): RFEdge<CanvasEdgeData>[] {
  const { canvas, selectedEdgeKeys } = opts;
  const rawEdges = canvas?.edges ?? [];
  return rawEdges.map((edge) => {
    const protocol = edge.protocol;
    const styleCategory: 'sync' | 'async' | 'default' =
      protocol !== undefined
        ? (PROTOCOL_STYLES[protocol] ?? 'default')
        : 'default';
    const edgeKey = `${edge.from.node}→${edge.to.node}`;
    const isSelected = selectedEdgeKeys.has(edgeKey);
    const data: CanvasEdgeData = { edge, styleCategory, isSelected };
    return {
      id: `${edge.from.node}-${edge.to.node}`,
      source: edge.from.node,
      target: edge.to.node,
      type: 'archEdge',
      data,
    };
  });
}

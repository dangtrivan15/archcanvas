import { useMemo } from 'react';
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useCanvasStore } from '@/store/canvasStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import { type CanvasNodeData, type CanvasEdgeData, PROTOCOL_STYLES } from '../types';

export function useCanvasRenderer(): {
  nodes: RFNode<CanvasNodeData>[];
  edges: RFEdge<CanvasEdgeData>[];
} {
  const canvas = useFileStore((s) => s.getCanvas(ROOT_CANVAS_KEY));
  const resolve = useRegistryStore((s) => s.resolve);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);

  const nodes = useMemo<RFNode<CanvasNodeData>[]>(() => {
    const rawNodes = canvas?.data.nodes ?? [];
    return rawNodes.map((node) => {
      const isRef = 'ref' in node;
      const nodeDef = isRef ? undefined : resolve((node as { type: string }).type);
      const data: CanvasNodeData = {
        node,
        nodeDef,
        isSelected: selectedNodeIds.has(node.id),
        isRef,
      };
      return {
        id: node.id,
        type: 'default',
        position: node.position ?? { x: 0, y: 0 },
        data,
      };
    });
  }, [canvas, resolve, selectedNodeIds]);

  const edges = useMemo<RFEdge<CanvasEdgeData>[]>(() => {
    const rawEdges = canvas?.data.edges ?? [];
    return rawEdges.map((edge) => {
      const protocol = edge.protocol;
      const styleCategory: 'sync' | 'async' | 'default' =
        protocol !== undefined
          ? (PROTOCOL_STYLES[protocol] ?? 'default')
          : 'default';
      const data: CanvasEdgeData = {
        edge,
        styleCategory,
      };
      return {
        id: `${edge.from.node}-${edge.to.node}`,
        source: edge.from.node,
        target: edge.to.node,
        type: 'default',
        data,
      };
    });
  }, [canvas]);

  return { nodes, edges };
}

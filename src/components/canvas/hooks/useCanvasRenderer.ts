import { useMemo } from 'react';
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { type CanvasNodeData, type CanvasEdgeData, PROTOCOL_STYLES } from '../types';
import { extractInheritedEdges } from '../inheritedEdges';
import { computeAutoSize } from '@/lib/computeAutoSize';

export const GHOST_NODE_PREFIX = '__ghost__';

export function useCanvasRenderer(): {
  nodes: RFNode<CanvasNodeData>[];
  edges: RFEdge<CanvasEdgeData>[];
} {
  const canvasId = useNavigationStore((s) => s.currentCanvasId);
  const canvas = useFileStore((s) => s.getCanvas(canvasId));
  const resolve = useRegistryStore((s) => s.resolve);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);
  const parentEdges = useNavigationStore((s) => s.parentEdges);

  // Subscribe to canvases Map reference for reactivity — the Map is cloned on
  // every canvas mutation, so this re-runs auto-fit sizing when child content changes.
  const canvasesRef = useFileStore((s) => s.project?.canvases);

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
      const rfNode: RFNode<CanvasNodeData> = {
        id: node.id,
        type: 'archNode',
        position: node.position ?? { x: 0, y: 0 },
        data,
      };

      // Auto-fit sizing for RefNode containers
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
  }, [canvas, resolve, selectedNodeIds, canvasesRef]);

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
        type: 'archEdge',
        data,
      };
    });
  }, [canvas]);

  // Inherited edges from parent scope (only when inside a child canvas)
  const { inheritedRFEdges, ghostNodes } = useMemo(() => {
    if (breadcrumb.length <= 1 || parentEdges.length === 0) {
      return { inheritedRFEdges: [] as RFEdge<CanvasEdgeData>[], ghostNodes: [] as RFNode<CanvasNodeData>[] };
    }

    const inherited = extractInheritedEdges(parentEdges, canvasId);
    if (inherited.length === 0) {
      return { inheritedRFEdges: [] as RFEdge<CanvasEdgeData>[], ghostNodes: [] as RFNode<CanvasNodeData>[] };
    }

    const ghostNodeMap = new Map<string, RFNode<CanvasNodeData>>();
    const rfEdges: RFEdge<CanvasEdgeData>[] = [];

    for (const ie of inherited) {
      const ghostId = `${GHOST_NODE_PREFIX}${ie.ghostEndpoint}`;

      // Create ghost node if not already created
      if (!ghostNodeMap.has(ghostId)) {
        const ghostNode: RFNode<CanvasNodeData> = {
          id: ghostId,
          type: 'archGhostNode',
          position: { x: 0, y: 0 },
          data: {
            node: { id: ghostId, type: 'ghost', displayName: ie.ghostEndpoint },
            nodeDef: undefined,
            isSelected: false,
            isRef: false,
          },
          selectable: false,
          draggable: false,
          connectable: false,
        };
        ghostNodeMap.set(ghostId, ghostNode);
      }

      // Map inherited edge source/target: localEndpoint is a real node, ghostEndpoint becomes ghost
      const source = ie.direction === 'outbound' ? ie.localEndpoint : ghostId;
      const target = ie.direction === 'outbound' ? ghostId : ie.localEndpoint;

      const protocol = ie.edge.protocol;
      const styleCategory: 'sync' | 'async' | 'default' =
        protocol !== undefined
          ? (PROTOCOL_STYLES[protocol] ?? 'default')
          : 'default';

      rfEdges.push({
        id: `inherited-${ie.edge.from.node}-${ie.edge.to.node}`,
        source,
        target,
        type: 'archEdge',
        selectable: false,
        data: {
          edge: ie.edge,
          styleCategory,
          inherited: true,
        },
      });
    }

    return { inheritedRFEdges: rfEdges, ghostNodes: Array.from(ghostNodeMap.values()) };
  }, [breadcrumb, parentEdges, canvasId]);

  // Merge inherited edges and ghost nodes with regular ones
  const allNodes = useMemo(() => {
    if (ghostNodes.length === 0) return nodes;
    return [...nodes, ...ghostNodes];
  }, [nodes, ghostNodes]);

  const allEdges = useMemo(() => {
    if (inheritedRFEdges.length === 0) return edges;
    return [...edges, ...inheritedRFEdges];
  }, [edges, inheritedRFEdges]);

  return { nodes: allNodes, edges: allEdges };
}

import { useMemo } from 'react';
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { type CanvasNodeData, type CanvasEdgeData, PROTOCOL_STYLES } from '../types';
import { extractInheritedEdges } from '../inheritedEdges';
import { mapCanvasNodes, mapCanvasEdges } from '../mapCanvasData';

export const GHOST_NODE_PREFIX = '__ghost__';

export function useCanvasRenderer(): {
  nodes: RFNode<CanvasNodeData>[];
  edges: RFEdge<CanvasEdgeData>[];
} {
  const canvasId = useNavigationStore((s) => s.currentCanvasId);
  const canvas = useFileStore((s) => s.getCanvas(canvasId));
  const resolve = useRegistryStore((s) => s.resolve);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeKeys = useCanvasStore((s) => s.selectedEdgeKeys);
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);
  const parentEdges = useNavigationStore((s) => s.parentEdges);

  // Subscribe to canvases Map reference for reactivity — the Map is cloned on
  // every canvas mutation, so this re-runs auto-fit sizing when child content changes.
  const canvasesRef = useFileStore((s) => s.project?.canvases);

  const nodes = useMemo<RFNode<CanvasNodeData>[]>(
    () => mapCanvasNodes({ canvas: canvas?.data, resolve, selectedNodeIds, canvasesRef }),
    [canvas, resolve, selectedNodeIds, canvasesRef],
  );

  const edges = useMemo<RFEdge<CanvasEdgeData>[]>(
    () => mapCanvasEdges({ canvas: canvas?.data, selectedEdgeKeys }),
    [canvas, selectedEdgeKeys],
  );

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

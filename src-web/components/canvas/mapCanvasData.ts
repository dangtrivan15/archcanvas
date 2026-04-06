import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { Canvas } from '@/types';
import type { CanvasNodeData, CanvasEdgeData } from './types';
import { PROTOCOL_STYLES } from './types';
import { computeAutoSize } from '@/lib/computeAutoSize';
import type { CanvasDiff } from '@/core/diff/types';
import { edgeKey } from '@/core/diff/engine';

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

// ---------------------------------------------------------------------------
// Ghost nodes/edges for removed items (visible when diff overlay is active)
// ---------------------------------------------------------------------------

interface MapRemovedNodesOptions {
  diff: CanvasDiff | undefined;
  baseCanvas: Canvas | undefined;
  resolve: (type: string) => import('@/types/nodeDefSchema').NodeDef | undefined;
}

/**
 * Create read-only ghost RFNodes for nodes that exist in the base canvas but
 * were removed in the current canvas. These appear with `diffStatus: 'removed'`
 * so the NodeRenderer renders them with the `diff-removed` style (faded out,
 * dashed border, etc.).
 */
export function mapRemovedNodes(opts: MapRemovedNodesOptions): RFNode<CanvasNodeData>[] {
  const { diff, baseCanvas, resolve } = opts;
  if (!diff || !baseCanvas) return [];

  const baseNodeMap = new Map(
    (baseCanvas.nodes ?? []).map((n) => [n.id, n]),
  );

  const ghosts: RFNode<CanvasNodeData>[] = [];

  for (const [nodeId, nodeDiff] of diff.nodes) {
    if (nodeDiff.status !== 'removed') continue;
    const baseNode = baseNodeMap.get(nodeId);
    if (!baseNode) continue;

    const isRef = 'ref' in baseNode;
    const nodeDef = isRef
      ? undefined
      : resolve((baseNode as { type: string }).type);

    ghosts.push({
      id: nodeId,
      type: 'archNode',
      position: baseNode.position ?? { x: 0, y: 0 },
      data: {
        node: baseNode,
        nodeDef,
        isSelected: false,
        isRef,
        diffStatus: 'removed',
      },
      selectable: false,
      draggable: false,
      connectable: false,
    });
  }

  return ghosts;
}

interface MapRemovedEdgesOptions {
  diff: CanvasDiff | undefined;
  baseCanvas: Canvas | undefined;
}

/**
 * Create read-only ghost RFEdges for edges that exist in the base canvas but
 * were removed in the current canvas. These appear with `diffStatus: 'removed'`
 * so the EdgeRenderer renders them with the `edge-diff-removed` style (dashed,
 * faded).
 */
export function mapRemovedEdges(opts: MapRemovedEdgesOptions): RFEdge<CanvasEdgeData>[] {
  const { diff, baseCanvas } = opts;
  if (!diff || !baseCanvas) return [];

  // Build a lookup from edge key → base Edge object
  const baseEdgeMap = new Map(
    (baseCanvas.edges ?? []).map((e) => [edgeKey(e), e]),
  );

  const ghosts: RFEdge<CanvasEdgeData>[] = [];

  for (const [key, edgeDiff] of diff.edges) {
    if (edgeDiff.status !== 'removed') continue;
    const baseEdge = baseEdgeMap.get(key);
    if (!baseEdge) continue;

    const protocol = baseEdge.protocol;
    const styleCategory: 'sync' | 'async' | 'default' =
      protocol !== undefined
        ? (PROTOCOL_STYLES[protocol] ?? 'default')
        : 'default';

    ghosts.push({
      id: `diff-removed-${baseEdge.from.node}-${baseEdge.to.node}`,
      source: baseEdge.from.node,
      target: baseEdge.to.node,
      type: 'archEdge',
      selectable: false,
      data: {
        edge: baseEdge,
        styleCategory,
        diffStatus: 'removed',
      },
    });
  }

  return ghosts;
}

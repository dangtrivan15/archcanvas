/**
 * ELK layout engine - arranges nodes using the ELK layered algorithm.
 * Transforms ArchGraph nodes/edges into ELK format, runs layout, and returns
 * updated node positions.
 */

import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';

const elk = new ELK();

// Default node dimensions when not specified
const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 100;
const NODE_SPACING = 60;
const LAYER_SPACING = 100;

export type LayoutDirection = 'horizontal' | 'vertical';

interface LayoutResult {
  /** Map of node ID -> { x, y } */
  positions: Map<string, { x: number; y: number }>;
}

/**
 * Compute ELK layout for a set of nodes and edges.
 * Returns a map of node ID -> new position.
 */
export async function computeElkLayout(
  nodes: ArchNode[],
  edges: ArchEdge[],
  direction: LayoutDirection = 'horizontal',
): Promise<LayoutResult> {
  if (nodes.length === 0) {
    return { positions: new Map() };
  }

  // Map direction to ELK algorithm direction
  const elkDirection = direction === 'horizontal' ? 'RIGHT' : 'DOWN';

  // Build ELK graph
  const elkChildren: ElkNode[] = nodes.map((node) => ({
    id: node.id,
    width: node.position.width > 0 ? node.position.width : DEFAULT_NODE_WIDTH,
    height: node.position.height > 0 ? node.position.height : DEFAULT_NODE_HEIGHT,
  }));

  const elkEdges: ElkExtendedEdge[] = edges
    .filter((edge) => {
      // Only include edges where both endpoints are in the provided node list
      const nodeIds = new Set(nodes.map((n) => n.id));
      return nodeIds.has(edge.fromNode) && nodeIds.has(edge.toNode);
    })
    .map((edge) => ({
      id: edge.id,
      sources: [edge.fromNode],
      targets: [edge.toNode],
    }));

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection,
      'elk.spacing.nodeNode': String(NODE_SPACING),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(LAYER_SPACING),
      'elk.layered.spacing.edgeNodeBetweenLayers': String(LAYER_SPACING / 2),
      'elk.edgeRouting': 'POLYLINE',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children: elkChildren,
    edges: elkEdges,
  };

  // Run ELK layout
  const layoutResult = await elk.layout(elkGraph);

  // Extract positions from result
  const positions = new Map<string, { x: number; y: number }>();
  if (layoutResult.children) {
    for (const child of layoutResult.children) {
      positions.set(child.id, {
        x: child.x ?? 0,
        y: child.y ?? 0,
      });
    }
  }

  return { positions };
}

/**
 * Apply ELK layout to an ArchGraph, returning a new graph with updated positions.
 * Only lays out nodes at the given navigation level (root by default).
 */
export async function applyElkLayout(
  graph: ArchGraph,
  direction: LayoutDirection = 'horizontal',
  navigationPath: string[] = [],
): Promise<ArchGraph> {
  // Get nodes at the current navigation level
  let targetNodes: ArchNode[];
  if (navigationPath.length === 0) {
    targetNodes = graph.nodes;
  } else {
    // Navigate into children
    targetNodes = graph.nodes;
    for (const pathId of navigationPath) {
      const parent = targetNodes.find((n) => n.id === pathId);
      if (parent) {
        targetNodes = parent.children;
      } else {
        return graph; // Path invalid, return unchanged
      }
    }
  }

  // Get edges that connect nodes at this level
  const nodeIds = new Set(targetNodes.map((n) => n.id));
  const relevantEdges = graph.edges.filter(
    (e) => nodeIds.has(e.fromNode) && nodeIds.has(e.toNode),
  );

  // Compute layout
  const result = await computeElkLayout(targetNodes, relevantEdges, direction);

  // Apply positions to the graph
  const updatedNodes = applyPositionsToNodes(
    graph.nodes,
    result.positions,
    navigationPath,
    0,
  );

  return {
    ...graph,
    nodes: updatedNodes,
  };
}

/**
 * Recursively apply position updates to the correct level of the node tree.
 */
function applyPositionsToNodes(
  nodes: ArchNode[],
  positions: Map<string, { x: number; y: number }>,
  navigationPath: string[],
  pathIndex: number,
): ArchNode[] {
  if (pathIndex < navigationPath.length) {
    // Navigate deeper
    const targetId = navigationPath[pathIndex];
    return nodes.map((node) => {
      if (node.id === targetId) {
        return {
          ...node,
          children: applyPositionsToNodes(
            node.children,
            positions,
            navigationPath,
            pathIndex + 1,
          ),
        };
      }
      return node;
    });
  }

  // At the target level - apply positions
  return nodes.map((node) => {
    const newPos = positions.get(node.id);
    if (newPos) {
      return {
        ...node,
        position: {
          ...node.position,
          x: newPos.x,
          y: newPos.y,
        },
      };
    }
    return node;
  });
}

import ELK from 'elkjs/lib/elk.bundled.js';
import type { Canvas, Position } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  direction?: 'horizontal' | 'vertical';
  /** Extra nodes to include in layout (e.g. ghost nodes for inherited edges) */
  ghostNodes?: GhostLayoutNode[];
  /** Extra edges to include in layout (e.g. inherited edges) */
  ghostEdges?: GhostLayoutEdge[];
}

export interface GhostLayoutNode {
  id: string;
  width?: number;
  height?: number;
}

export interface GhostLayoutEdge {
  source: string;
  target: string;
}

export interface LayoutResult {
  positions: Map<string, Position>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;
const GHOST_NODE_WIDTH = 150;
const GHOST_NODE_HEIGHT = 40;

// ---------------------------------------------------------------------------
// computeLayout
// ---------------------------------------------------------------------------

/**
 * Runs the ELK layered layout algorithm on a Canvas and returns computed
 * node positions as a Map<nodeId, Position>.
 *
 * Pure function — no side effects, no React dependency.
 */
export async function computeLayout(
  canvas: Canvas,
  options?: LayoutOptions,
): Promise<LayoutResult> {
  const nodes = canvas.nodes ?? [];
  const edges = canvas.edges ?? [];

  const direction = options?.direction === 'vertical' ? 'DOWN' : 'RIGHT';

  const elk = new ELK();

  const children = nodes.map((node) => ({
    id: node.id,
    width: node.position?.width ?? DEFAULT_NODE_WIDTH,
    height: node.position?.height ?? DEFAULT_NODE_HEIGHT,
  }));

  // Add ghost nodes for layout participation
  if (options?.ghostNodes) {
    for (const ghost of options.ghostNodes) {
      children.push({
        id: ghost.id,
        width: ghost.width ?? GHOST_NODE_WIDTH,
        height: ghost.height ?? GHOST_NODE_HEIGHT,
      });
    }
  }

  const elkEdges = edges.map((edge, idx) => ({
    id: `edge-${idx}`,
    sources: [edge.from.node],
    targets: [edge.to.node],
  }));

  // Add ghost edges for layout participation
  if (options?.ghostEdges) {
    for (let i = 0; i < options.ghostEdges.length; i++) {
      const ge = options.ghostEdges[i];
      elkEdges.push({
        id: `ghost-edge-${i}`,
        sources: [ge.source],
        targets: [ge.target],
      });
    }
  }

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '50',
    },
    children,
    edges: elkEdges,
  };

  const result = await elk.layout(graph);

  const positions = new Map<string, Position>();

  for (const child of result.children ?? []) {
    if (child.x !== undefined && child.y !== undefined) {
      const original = nodes.find((n) => n.id === child.id);
      positions.set(child.id, {
        x: child.x,
        y: child.y,
        width: original?.position?.width,
        height: original?.position?.height,
      });
    }
  }

  return { positions };
}

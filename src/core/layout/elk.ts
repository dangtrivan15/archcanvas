import ELK from 'elkjs/lib/elk.bundled.js';
import type { Canvas, Position } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  direction?: 'horizontal' | 'vertical';
}

export interface LayoutResult {
  positions: Map<string, Position>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;

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

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '50',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.position?.width ?? DEFAULT_NODE_WIDTH,
      height: node.position?.height ?? DEFAULT_NODE_HEIGHT,
    })),
    edges: edges.map((edge, idx) => ({
      id: `edge-${idx}`,
      sources: [edge.from.node],
      targets: [edge.to.node],
    })),
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

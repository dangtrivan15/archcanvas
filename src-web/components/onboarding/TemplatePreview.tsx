import type { ArchTemplate } from '@/core/templates/schema';

interface TemplatePreviewProps {
  template: ArchTemplate;
  className?: string;
}

/**
 * Lightweight SVG preview of a template's node positions and edges.
 * Renders nodes as rounded rectangles and edges as lines.
 */
export function TemplatePreview({ template, className = '' }: TemplatePreviewProps) {
  const nodes = template.canvas.nodes ?? [];
  const edges = template.canvas.edges ?? [];

  if (nodes.length === 0) return null;

  // Compute bounding box of all nodes
  const positions = nodes
    .filter((n): n is typeof n & { position: { x: number; y: number } } => 'position' in n && n.position != null)
    .map((n) => n.position);

  if (positions.length === 0) return null;

  const minX = Math.min(...positions.map((p) => p.x));
  const minY = Math.min(...positions.map((p) => p.y));
  const maxX = Math.max(...positions.map((p) => p.x));
  const maxY = Math.max(...positions.map((p) => p.y));

  const nodeW = 60;
  const nodeH = 24;
  const padding = 20;

  const viewWidth = maxX - minX + nodeW + padding * 2;
  const viewHeight = maxY - minY + nodeH + padding * 2;

  // Build a lookup from node ID to center position for edge drawing
  const nodeCenter = new Map<string, { cx: number; cy: number }>();
  for (const node of nodes) {
    if ('position' in node && node.position) {
      const cx = node.position.x - minX + padding + nodeW / 2;
      const cy = node.position.y - minY + padding + nodeH / 2;
      nodeCenter.set(node.id, { cx, cy });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      className={`text-muted-foreground ${className}`}
      aria-hidden
    >
      {/* Edges */}
      {edges.map((edge, i) => {
        const from = nodeCenter.get(edge.from.node);
        const to = nodeCenter.get(edge.to.node);
        if (!from || !to) return null;
        return (
          <line
            key={`edge-${i}`}
            x1={from.cx}
            y1={from.cy}
            x2={to.cx}
            y2={to.cy}
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.3}
          />
        );
      })}

      {/* Nodes */}
      {positions.map((pos, i) => {
        const x = pos.x - minX + padding;
        const y = pos.y - minY + padding;
        return (
          <rect
            key={`node-${i}`}
            x={x}
            y={y}
            width={nodeW}
            height={nodeH}
            rx={4}
            fill="currentColor"
            opacity={0.15}
            stroke="currentColor"
            strokeWidth={1}
            strokeOpacity={0.3}
          />
        );
      })}
    </svg>
  );
}

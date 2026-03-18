import { useFileStore } from '@/store/fileStore';
import { typeToColor } from '@/lib/typeToColor';

interface SubsystemPreviewProps {
  canvasId: string;
}

const MINI_NODE_W = 44;
const MINI_NODE_H = 16;
const PADDING = 12;
const MAX_LABEL_LEN = 10;

export function SubsystemPreview({ canvasId }: SubsystemPreviewProps) {
  // Subscribe to canvases Map reference so Zustand re-renders when any canvas mutates.
  // getCanvas alone is not reliably reactive (same LoadedCanvas ref if a different canvas changed).
  const canvas = useFileStore((s) => {
    void s.project?.canvases; // touch Map ref for subscription
    return s.getCanvas(canvasId);
  });
  const nodes = canvas?.data.nodes ?? [];
  const edges = canvas?.data.edges ?? [];

  if (nodes.length === 0) return null;

  // Compute bounding box of node positions
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const x = n.position?.x ?? 0;
    const y = n.position?.y ?? 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + MINI_NODE_W > maxX) maxX = x + MINI_NODE_W;
    if (y + MINI_NODE_H > maxY) maxY = y + MINI_NODE_H;
  }

  const contentW = maxX - minX + PADDING * 2;
  const contentH = maxY - minY + PADDING * 2;

  // Build a node position map for edge rendering
  const nodePositions = new Map<string, { cx: number; cy: number }>();
  for (const n of nodes) {
    const x = (n.position?.x ?? 0) - minX + PADDING;
    const y = (n.position?.y ?? 0) - minY + PADDING;
    nodePositions.set(n.id, { cx: x + MINI_NODE_W / 2, cy: y + MINI_NODE_H / 2 });
  }

  return (
    <svg
      viewBox={`0 0 ${contentW} ${contentH}`}
      className="subsystem-preview"
      style={{ width: '100%', flex: 1, pointerEvents: 'none', minHeight: 0 }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Edges first (behind nodes) */}
      {edges.map((edge, i) => {
        const from = nodePositions.get(edge.from.node);
        const to = nodePositions.get(edge.to.node);
        if (!from || !to) return null;
        return (
          <line
            key={i}
            x1={from.cx} y1={from.cy}
            x2={to.cx} y2={to.cy}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={0.8}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const x = (n.position?.x ?? 0) - minX + PADDING;
        const y = (n.position?.y ?? 0) - minY + PADDING;
        const type = 'type' in n ? n.type : 'ref';
        const color = typeToColor(type);
        const displayName = ('displayName' in n && n.displayName) ? n.displayName : n.id;
        const label = displayName.length > MAX_LABEL_LEN
          ? displayName.slice(0, MAX_LABEL_LEN - 1) + '\u2026'
          : displayName;

        return (
          <g key={n.id} data-node-id={n.id}>
            <rect
              x={x} y={y}
              width={MINI_NODE_W} height={MINI_NODE_H}
              rx={3}
              fill={color}
              fillOpacity={0.15}
              stroke={color}
              strokeOpacity={0.4}
              strokeWidth={0.8}
            />
            <text
              x={x + MINI_NODE_W / 2}
              y={y + MINI_NODE_H / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fill={color}
              fillOpacity={0.8}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

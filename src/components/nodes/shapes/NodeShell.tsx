/**
 * NodeShell - Reusable SVG shape wrapper for canvas nodes.
 *
 * Renders a distinct SVG shape as the node background, with inner React content
 * placed inside via <foreignObject>. Uses ResizeObserver to sync content height
 * with SVG viewBox. All fill/stroke colors resolve to CSS theme variables.
 *
 * Usage:
 *   <NodeShell shape="hexagon" width={220} color="#3B82F6" selected={false}>
 *     <div>...node content...</div>
 *   </NodeShell>
 */

import {
  memo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  shapeRegistry,
  cylinderLid,
  type ShapeName,
} from './shapeRegistry';

export interface NodeShellProps {
  /** The SVG shape to render as the node background */
  shape: ShapeName;
  /** Outer width of the node in pixels */
  width?: number;
  /** Optional fixed height (if omitted, auto-sized via ResizeObserver) */
  height?: number;
  /** Accent/stroke color for the shape (hex string) */
  color?: string;
  /** Whether the node is currently selected */
  selected?: boolean;
  /** Inner React content (header, args, badges, ports) */
  children?: ReactNode;
}

const DEFAULT_WIDTH = 220;
const MIN_HEIGHT = 60;
const PADDING = 8; // inner padding for foreignObject

function NodeShellComponent({
  shape,
  width = DEFAULT_WIDTH,
  height: fixedHeight,
  color,
  selected = false,
  children,
}: NodeShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(fixedHeight ?? MIN_HEIGHT);

  // Use ResizeObserver to measure inner content and dynamically adjust SVG viewBox/height
  useEffect(() => {
    if (fixedHeight != null) {
      setMeasuredHeight(fixedHeight);
      return;
    }

    const el = contentRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.max(MIN_HEIGHT, Math.ceil(entry.contentRect.height) + PADDING * 2);
        setMeasuredHeight(h);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [fixedHeight]);

  const effectiveHeight = fixedHeight ?? measuredHeight;

  // Generate shape path
  const pathGenerator = shapeRegistry[shape];
  const shapePath = pathGenerator(width, effectiveHeight);

  // CSS variable based colors
  const fillColor = 'hsl(var(--surface))';
  const strokeColor = selected
    ? 'hsl(var(--iris))'
    : color
      ? `${color}66`
      : 'hsl(var(--border))';
  const strokeWidth = selected ? 2.5 : 1.5;

  return (
    <div
      className="relative"
      style={{ width, height: effectiveHeight }}
      data-testid="node-shell"
      data-shape={shape}
    >
      <svg
        width={width}
        height={effectiveHeight}
        viewBox={`0 0 ${width} ${effectiveHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
        data-testid="node-shell-svg"
      >
        {/* Main shape fill */}
        <path
          d={shapePath}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          data-testid="node-shell-path"
        />

        {/* Extra lid for cylinder shape (visual depth) */}
        {shape === 'cylinder' && (
          <path
            d={cylinderLid(width, effectiveHeight)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            data-testid="node-shell-cylinder-lid"
          />
        )}

        {/* Selection ring effect */}
        {selected && (
          <path
            d={shapePath}
            fill="none"
            stroke="hsl(var(--iris))"
            strokeWidth={1}
            strokeOpacity={0.3}
            strokeDasharray="4 2"
            data-testid="node-shell-selection-ring"
          />
        )}

        {/* Inner content via foreignObject */}
        <foreignObject
          x={PADDING}
          y={PADDING}
          width={width - PADDING * 2}
          height={effectiveHeight - PADDING * 2}
          data-testid="node-shell-foreign-object"
        >
          <div
            ref={contentRef}
            /* xmlns required for foreignObject in SVG */
            {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as any)}
            style={{ width: '100%', minHeight: MIN_HEIGHT - PADDING * 2 }}
            data-testid="node-shell-content"
          >
            {children}
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}

export const NodeShell = memo(NodeShellComponent);
export default NodeShell;

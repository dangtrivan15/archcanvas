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
import { getShapeInsets } from './shapeInsets';

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
        // Use shape-aware vertical insets for height calculation
        const insets = getShapeInsets(shape, width, Math.max(MIN_HEIGHT, Math.ceil(entry.contentRect.height) + 40));
        const h = Math.max(MIN_HEIGHT, Math.ceil(entry.contentRect.height) + insets.top + insets.bottom);
        setMeasuredHeight(h);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [fixedHeight, shape, width]);

  const effectiveHeight = fixedHeight ?? measuredHeight;

  // Shape-aware content insets (replaces uniform PADDING)
  const insets = getShapeInsets(shape, width, effectiveHeight);

  // Generate shape path
  const pathGenerator = shapeRegistry[shape];
  const shapePath = pathGenerator(width, effectiveHeight);

  // CSS variable based colors
  const fillColor = 'hsl(var(--surface))';
  // Subtle accent tint overlay (~6% opacity of accent color)
  const tintColor = color ? `${color}0F` : undefined;
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

        {/* Subtle accent color tint overlay */}
        {tintColor && (
          <path
            d={shapePath}
            fill={tintColor}
            stroke="none"
            data-testid="node-shell-tint"
          />
        )}

        {/* Extra lid for cylinder shape (visual depth) */}
        {shape === 'cylinder' && (
          <>
            <path
              d={cylinderLid(width, effectiveHeight)}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              data-testid="node-shell-cylinder-lid"
            />
            {tintColor && (
              <path
                d={cylinderLid(width, effectiveHeight)}
                fill={tintColor}
                stroke="none"
              />
            )}
          </>
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

        {/* Inner content via foreignObject - shape-aware insets prevent clipping */}
        <foreignObject
          x={insets.left}
          y={insets.top}
          width={width - insets.left - insets.right}
          height={effectiveHeight - insets.top - insets.bottom}
          data-testid="node-shell-foreign-object"
        >
          <div
            ref={contentRef}
            /* xmlns required for foreignObject in SVG */
            {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as any)}
            style={{ width: '100%', minHeight: Math.max(0, MIN_HEIGHT - insets.top - insets.bottom) }}
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

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

import { memo, useId, useRef, useState, useEffect, useMemo, type ReactNode } from 'react';
import { shapeRegistry, cylinderLid, type ShapeName } from './shapeRegistry';
import { getShapeInsets } from './shapeInsets';
import { hexToNormalizedRgb } from '@/utils/nodeColors';

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
  const uniqueId = useId();
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
        const insets = getShapeInsets(
          shape,
          width,
          Math.max(MIN_HEIGHT, Math.ceil(entry.contentRect.height) + 40),
        );
        const h = Math.max(
          MIN_HEIGHT,
          Math.ceil(entry.contentRect.height) + insets.top + insets.bottom,
        );
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

  // Unique gradient IDs for this node instance (avoids SVG ID collisions)
  const gradientId = `grad-${uniqueId.replace(/:/g, '')}`;
  const tintGradientId = `tint-${uniqueId.replace(/:/g, '')}`;

  // CSS variable based colors
  const fillColor = 'hsl(var(--surface))';
  // Subtle accent tint overlay (~6% opacity of accent color)
  const tintColor = color ? `${color}0F` : undefined;
  // Slightly stronger tint for gradient top highlight (~10% opacity)
  const tintColorTop = color ? `${color}18` : undefined;
  const strokeColor = selected
    ? (color ?? 'hsl(var(--iris))')
    : color
      ? `${color}B3`
      : 'hsl(var(--border))';
  // Refined stroke width per shape: cloud gets slightly thicker strokes for its complex curves
  const baseStrokeWidth = shape === 'cloud' ? 1.8 : 1.5;
  const strokeWidth = selected ? baseStrokeWidth + 1 : baseStrokeWidth;

  // Color-tinted drop shadow + accent glow halo when selected
  const shadowFilter = useMemo(() => {
    const rgb = hexToNormalizedRgb(color ?? '#6B7280');
    const r = Math.round(rgb.r * 255);
    const g = Math.round(rgb.g * 255);
    const b = Math.round(rgb.b * 255);
    if (selected) {
      return `drop-shadow(0px 3px 8px rgba(${r},${g},${b},0.3)) drop-shadow(0px 1px 3px rgba(${r},${g},${b},0.2)) drop-shadow(0px 0px 12px rgba(${r},${g},${b},0.4)) drop-shadow(0px 0px 4px rgba(${r},${g},${b},0.3))`;
    }
    return `drop-shadow(0px 2px 6px rgba(${r},${g},${b},0.2)) drop-shadow(0px 1px 2px rgba(${r},${g},${b},0.12))`;
  }, [color, selected]);

  return (
    <div
      className="relative"
      style={{
        width,
        height: effectiveHeight,
        filter: shadowFilter,
        transition: 'filter 180ms ease, transform 180ms ease',
      }}
      data-testid="node-shell"
      data-shape={shape}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        if (!selected) {
          const rgb = hexToNormalizedRgb(color ?? '#6B7280');
          const r = Math.round(rgb.r * 255);
          const g = Math.round(rgb.g * 255);
          const b = Math.round(rgb.b * 255);
          e.currentTarget.style.filter = `drop-shadow(0px 3px 8px rgba(${r},${g},${b},0.3)) drop-shadow(0px 1px 3px rgba(${r},${g},${b},0.2))`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        if (!selected) {
          e.currentTarget.style.filter = shadowFilter;
        }
      }}
    >
      <svg
        width={width}
        height={effectiveHeight}
        viewBox={`0 0 ${width} ${effectiveHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
        data-testid="node-shell-svg"
      >
        {/* Gradient definitions for 3D depth effect */}
        <defs>
          {/* Top-to-bottom lighting gradient: white highlight at top fading to transparent */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.08" />
            <stop offset="100%" stopColor="black" stopOpacity="0.04" />
          </linearGradient>
          {/* Accent-tinted gradient: stronger tint at top, lighter at bottom */}
          {tintColor && tintColorTop && (
            <linearGradient id={tintGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.10" />
              <stop offset="100%" stopColor={color} stopOpacity="0.04" />
            </linearGradient>
          )}
        </defs>

        {/* Main shape fill */}
        <path
          d={shapePath}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          data-testid="node-shell-path"
        />

        {/* Subtle gradient overlay for 3D depth (lighter top → slightly darker bottom) */}
        <path
          d={shapePath}
          fill={`url(#${gradientId})`}
          stroke="none"
          data-testid="node-shell-gradient"
        />

        {/* Accent color tint gradient overlay (replaces flat tint) */}
        {tintColor && (
          <path
            d={shapePath}
            fill={`url(#${tintGradientId})`}
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
              strokeLinejoin="round"
              strokeLinecap="round"
              data-testid="node-shell-cylinder-lid"
            />
            {/* Gradient on cylinder lid too */}
            <path
              d={cylinderLid(width, effectiveHeight)}
              fill={`url(#${gradientId})`}
              stroke="none"
            />
            {tintColor && (
              <path
                d={cylinderLid(width, effectiveHeight)}
                fill={`url(#${tintGradientId})`}
                stroke="none"
              />
            )}
          </>
        )}

        {/* Selection glow halo - rendered via CSS filter drop-shadow on parent div */}

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
            style={{
              width: '100%',
              minHeight: Math.max(0, MIN_HEIGHT - insets.top - insets.bottom),
            }}
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

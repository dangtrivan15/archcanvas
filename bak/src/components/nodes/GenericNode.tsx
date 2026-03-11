/**
 * GenericNode - a versatile node component for React Flow canvas.
 * Displays: icon, displayName, type, args, port handles, and badge counts.
 * Used as the default node type and base for all specialized node components.
 *
 * Port handles are dynamically generated from the nodedef's port definitions:
 * - Inbound ports appear on the left side (target handles)
 * - Outbound ports appear on the right side (source handles)
 * - Each port has a tooltip showing the port name
 * - Falls back to a single in/out handle if no ports are defined
 *
 * Color support:
 * - Each node has a type-based default color (from nodeColors utility)
 * - Users can override with a custom color (stored in position.color)
 * - Color is applied as a left accent bar and tinted header background
 */

import { memo, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { CanvasNode, CanvasNodeData } from '@/types/canvas';
import {
  getEffectiveNodeColor,
  colorToBackground,
  colorTintedShadow,
  colorGlowShadow,
} from '@/utils/nodeColors';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { iconMap, DefaultNodeIcon } from './iconMap';
import { NodeIconBadge } from './NodeIconBadge';
import { NodeArgsTable } from './NodeArgsTable';
import { NodeBadges } from './NodeBadges';
import { GenericPortHandles } from './NodePortHandles';
import { ExternalLink } from 'lucide-react';

// Re-export iconMap for backward compatibility (used by CommandPalette, QuickSearch)
export { iconMap } from './iconMap';

function GenericNodeComponent({ data, selected }: NodeProps<CanvasNode>) {
  const nodeData: CanvasNodeData = data;
  const Icon = iconMap[nodeData.icon] ?? DefaultNodeIcon;
  const isRef = !!nodeData.refSource;

  const inboundPorts = nodeData.ports?.inbound ?? [];
  const outboundPorts = nodeData.ports?.outbound ?? [];

  const inlineEdit = useInlineEdit(nodeData.archNodeId, nodeData.displayName);

  // Compute effective color (custom or type-default)
  const effectiveColor = useMemo(
    () => (isRef ? '#A855F7' : getEffectiveNodeColor(nodeData.color, nodeData.nodedefType)),
    [nodeData.color, nodeData.nodedefType, isRef],
  );

  // Compute style objects for color application
  const headerBgStyle = useMemo(
    () => ({
      background: `linear-gradient(to bottom, ${colorToBackground(effectiveColor, 0.18)}, ${colorToBackground(effectiveColor, 0.05)})`,
    }),
    [effectiveColor],
  );

  const borderStyle = useMemo(
    () => ({
      borderColor: selected ? effectiveColor : `${effectiveColor}B3`,
    }),
    [effectiveColor, selected],
  );

  // Color-tinted drop shadow + accent glow halo when selected
  const shadowStyle = useMemo(
    () => ({
      boxShadow: selected
        ? `${colorTintedShadow(effectiveColor, 'hover')}, ${colorGlowShadow(effectiveColor)}`
        : colorTintedShadow(effectiveColor, 'default'),
    }),
    [effectiveColor, selected],
  );

  // Top accent strip gradient (replaces the left accent bar)
  const topAccentStyle = useMemo(
    () => ({
      background: `linear-gradient(to right, ${effectiveColor}, ${effectiveColor}99)`,
    }),
    [effectiveColor],
  );

  // Body background: gradient tint for 3D depth (matches NodeShell's gradient approach)
  const bodyBackgroundStyle = useMemo(() => {
    if (isRef) {
      return { background: 'hsl(var(--iris) / 0.08)' };
    }
    return {
      background: `linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(0,0,0,0.02)), linear-gradient(to bottom, ${effectiveColor}18, ${effectiveColor}0A), hsl(var(--surface))`,
    };
  }, [effectiveColor, isRef]);

  return (
    <div
      className={`
        border-2 rounded-lg min-w-[200px] max-w-[280px]
        relative overflow-hidden
        ${isRef ? 'border-dashed' : ''}
      `}
      style={{
        ...borderStyle,
        ...shadowStyle,
        ...bodyBackgroundStyle,
        transition: 'box-shadow 180ms ease, transform 180ms ease',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.boxShadow = colorTintedShadow(effectiveColor, 'hover');
        }
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.boxShadow = colorTintedShadow(effectiveColor, 'default');
        }
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      data-testid={`node-${nodeData.archNodeId}`}
      data-node-id={nodeData.archNodeId}
      data-node-type={nodeData.nodedefType}
      data-node-name={nodeData.displayName}
      data-node-color={effectiveColor}
      data-ref-source={nodeData.refSource || undefined}
    >
      {/* Color accent strip (top edge) */}
      <div
        className="absolute left-0 right-0 top-0 h-[3px] rounded-t-md"
        style={topAccentStyle}
        data-testid="node-color-accent"
      />

      {/* Port handles */}
      <GenericPortHandles inboundPorts={inboundPorts} outboundPorts={outboundPorts} />

      {/* Node header with tinted background */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ ...headerBgStyle, borderBottom: `1px solid ${effectiveColor}20` }}
        data-testid="node-header"
      >
        <NodeIconBadge icon={Icon} color={effectiveColor} data-testid="node-icon" />
        <div className="min-w-0 flex-1">
          {inlineEdit.isInlineEditing ? (
            <input
              ref={inlineEdit.inputRef}
              type="text"
              className="text-sm font-medium text-text w-full bg-surface border border-iris rounded px-1 py-0 outline-none ring-2 ring-iris/30 nodrag"
              value={inlineEdit.editValue}
              onChange={(e) => inlineEdit.setEditValue(e.target.value)}
              onKeyDown={inlineEdit.handleKeyDown}
              onBlur={inlineEdit.confirmEdit}
              data-testid="inline-edit-input"
              aria-label="Edit node name"
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <div className="text-sm font-medium text-text truncate" data-testid="node-display-name">
              {nodeData.displayName}
            </div>
          )}
          <span
            className="inline-block mt-0.5 px-1.5 py-0 rounded-full bg-highlight-med text-[10px] leading-4 text-muted-foreground truncate max-w-full"
            data-testid="node-type-label"
          >
            {nodeData.nodedefType}
          </span>
        </div>
        {isRef && (
          <span
            className="shrink-0"
            data-testid="ref-indicator"
            title={`Reference to: ${nodeData.refSource}`}
          >
            <ExternalLink className="w-3.5 h-3.5 text-iris" />
          </span>
        )}
        {nodeData.hasChildren && (
          <div
            className="text-xs text-iris cursor-pointer"
            title="Has children - double click to zoom in"
          >
            ▶
          </div>
        )}
      </div>

      {/* Reference source indicator */}
      {isRef && (
        <div
          className="flex items-center gap-1 px-3 py-1 text-xs text-iris bg-iris/10 border-b border-iris/20"
          data-testid="ref-source-indicator"
          title={`References: ${nodeData.refSource}`}
        >
          <span className="font-medium">ref:</span>
          <span className="truncate font-mono">{nodeData.refSource}</span>
        </div>
      )}

      {/* Node body - show key args */}
      {Object.keys(nodeData.args).length > 0 && (
        <NodeArgsTable args={nodeData.args} maxRows={3} className="px-3 py-1.5" />
      )}

      {/* Badges (footer) */}
      <NodeBadges
        noteCount={nodeData.noteCount}
        codeRefCount={nodeData.codeRefCount}
        className="px-3 py-1.5"
        dividerColor={`${effectiveColor}20`}
      />
    </div>
  );
}

export const GenericNode = memo(GenericNodeComponent);

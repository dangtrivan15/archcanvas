/**
 * ContainerNode - A container node component for nested .archc canvas references.
 *
 * Represents a child .archc file as a visually distinct container on the parent canvas.
 * Features:
 * - Layered/nested visual treatment with rounded border and layered shadow
 * - Child file name display
 * - Node count badge showing how many nodes the child canvas contains
 * - "Dive in" affordance icon indicating the node can be opened
 * - Support for refSource pattern 'file://./relative-path.archc'
 *
 * Maps to: meta/canvas-ref
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
import { NodeBadges } from './NodeBadges';
import { GenericPortHandles } from './NodePortHandles';
import { FolderOpen, ChevronRight, Layers } from 'lucide-react';

/** Default container color - a teal/cyan tone for canvas references */
const CONTAINER_DEFAULT_COLOR = '#0EA5E9';

/**
 * Extract a display-friendly file name from a refSource or filePath arg.
 * Supports patterns like 'file://./child-system.archc' or plain paths.
 */
function extractFileName(refSource?: string, filePathArg?: string): string {
  const raw = refSource || filePathArg || '';
  // Strip 'file://' prefix
  const cleaned = raw.replace(/^file:\/\//, '');
  // Get the basename
  const parts = cleaned.split('/');
  const basename = parts[parts.length - 1] || cleaned;
  // Remove .archc extension for display
  return basename.replace(/\.archc$/, '') || 'Untitled Canvas';
}

function ContainerNodeComponent({ data, selected }: NodeProps<CanvasNode>) {
  const nodeData: CanvasNodeData = data;
  const Icon = iconMap[nodeData.icon] ?? DefaultNodeIcon;

  const inboundPorts = nodeData.ports?.inbound ?? [];
  const outboundPorts = nodeData.ports?.outbound ?? [];

  const inlineEdit = useInlineEdit(nodeData.archNodeId, nodeData.displayName);

  // Container nodes get a distinctive color
  const effectiveColor = useMemo(
    () => getEffectiveNodeColor(nodeData.color, nodeData.nodedefType) || CONTAINER_DEFAULT_COLOR,
    [nodeData.color, nodeData.nodedefType],
  );

  // Extract file name from refSource
  const childFileName = useMemo(
    () => extractFileName(nodeData.refSource, nodeData.args?.filePath as string | undefined),
    [nodeData.refSource, nodeData.args?.filePath],
  );

  // Node count from args
  const nodeCount = (nodeData.args?.nodeCount as number) || 0;

  // Style computations
  const headerBgStyle = useMemo(
    () => ({
      background: `linear-gradient(to bottom, ${colorToBackground(effectiveColor, 0.22)}, ${colorToBackground(effectiveColor, 0.08)})`,
    }),
    [effectiveColor],
  );

  const borderStyle = useMemo(
    () => ({
      borderColor: selected ? effectiveColor : `${effectiveColor}B3`,
    }),
    [effectiveColor, selected],
  );

  // Layered shadow effect - gives the impression of stacked canvases
  const shadowStyle = useMemo(
    () => ({
      boxShadow: selected
        ? `${colorTintedShadow(effectiveColor, 'hover')}, ${colorGlowShadow(effectiveColor)}, 4px 4px 0 0 ${effectiveColor}30, 8px 8px 0 0 ${effectiveColor}15`
        : `${colorTintedShadow(effectiveColor, 'default')}, 4px 4px 0 0 ${effectiveColor}20, 8px 8px 0 0 ${effectiveColor}10`,
    }),
    [effectiveColor, selected],
  );

  const topAccentStyle = useMemo(
    () => ({
      background: `linear-gradient(to right, ${effectiveColor}, ${effectiveColor}99)`,
    }),
    [effectiveColor],
  );

  const bodyBackgroundStyle = useMemo(
    () => ({
      background: `linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(0,0,0,0.02)), linear-gradient(to bottom, ${effectiveColor}18, ${effectiveColor}0A), hsl(var(--surface))`,
    }),
    [effectiveColor],
  );

  return (
    <div
      className={`
        border-2 rounded-xl min-w-[220px] max-w-[300px]
        relative overflow-hidden
      `}
      style={{
        ...borderStyle,
        ...shadowStyle,
        ...bodyBackgroundStyle,
        transition: 'box-shadow 180ms ease, transform 180ms ease',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.boxShadow = `${colorTintedShadow(effectiveColor, 'hover')}, 4px 4px 0 0 ${effectiveColor}30, 8px 8px 0 0 ${effectiveColor}15`;
        }
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.boxShadow = `${colorTintedShadow(effectiveColor, 'default')}, 4px 4px 0 0 ${effectiveColor}20, 8px 8px 0 0 ${effectiveColor}10`;
        }
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      data-testid={`node-${nodeData.archNodeId}`}
      data-node-id={nodeData.archNodeId}
      data-node-type={nodeData.nodedefType}
      data-node-name={nodeData.displayName}
      data-node-color={effectiveColor}
      data-node-shape="container"
      data-ref-source={nodeData.refSource || undefined}
    >
      {/* Color accent strip (top edge) - thicker for container nodes */}
      <div
        className="absolute left-0 right-0 top-0 h-[4px] rounded-t-lg"
        style={topAccentStyle}
        data-testid="node-color-accent"
      />

      {/* Port handles */}
      <GenericPortHandles inboundPorts={inboundPorts} outboundPorts={outboundPorts} />

      {/* Node header with tinted background */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
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
      </div>

      {/* Container body - shows nested canvas info */}
      <div className="px-3 py-2.5" data-testid="container-body">
        {/* File reference */}
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"
          data-testid="container-file-ref"
        >
          <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: effectiveColor }} />
          <span className="truncate font-mono" title={nodeData.refSource || (nodeData.args?.filePath as string) || ''}>
            {childFileName}
          </span>
        </div>

        {/* Node count badge */}
        {nodeCount > 0 && (
          <div
            className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"
            data-testid="container-node-count"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: effectiveColor }} />
            <span>
              {nodeCount} node{nodeCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Dive-in affordance */}
        <div
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors"
          style={{
            backgroundColor: `${effectiveColor}15`,
            color: effectiveColor,
            border: `1px solid ${effectiveColor}30`,
          }}
          data-testid="container-dive-in"
          title="Open nested canvas"
        >
          <span>Open Canvas</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Badges (footer) */}
      <NodeBadges
        noteCount={nodeData.noteCount}
        pendingSuggestionCount={nodeData.pendingSuggestionCount}
        codeRefCount={nodeData.codeRefCount}
        className="px-3 py-1.5"
        dividerColor={`${effectiveColor}20`}
      />
    </div>
  );
}

export const ContainerNode = memo(ContainerNodeComponent);

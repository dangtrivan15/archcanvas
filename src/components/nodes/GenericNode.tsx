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

import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CanvasNodeData } from '@/types/canvas';
import { getEffectiveNodeColor, colorToBackground, colorTintedShadow, colorGlowShadow } from '@/utils/nodeColors';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';
import {
  Box, Server, Database, HardDrive, Radio, Globe, Shield, Cpu, Layers,
  Inbox, GitFork, Activity, BarChart3, FileText, Cog, Zap, Archive,
  ExternalLink,
} from 'lucide-react';
import { NodeIconBadge } from './NodeIconBadge';
import { NodeArgsTable } from './NodeArgsTable';
import { NodeBadges } from './NodeBadges';

export const iconMap: Record<string, React.ElementType> = {
  Server,
  Database,
  HardDrive,
  Radio,
  Globe,
  Shield,
  Cpu,
  Layers,
  Box,
  Inbox,
  GitFork,
  Activity,
  BarChart3,
  FileText,
  Cog,
  Zap,
  Archive,
};

function GenericNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const Icon = iconMap[nodeData.icon] ?? Box;
  const isRef = !!nodeData.refSource;

  const inboundPorts = nodeData.ports?.inbound ?? [];
  const outboundPorts = nodeData.ports?.outbound ?? [];
  const hasDefinedInboundPorts = inboundPorts.length > 0;
  const hasDefinedOutboundPorts = outboundPorts.length > 0;

  // ── Inline edit state ──────────────────────────────────────────────
  const inlineEditNodeId = useUIStore((s) => s.inlineEditNodeId);
  const isInlineEditing = inlineEditNodeId === nodeData.archNodeId;
  const [editValue, setEditValue] = useState(nodeData.displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  // When inline edit activates for this node, focus the input and select all text
  useEffect(() => {
    if (isInlineEditing) {
      setEditValue(nodeData.displayName);
      // Use requestAnimationFrame to ensure the input is rendered before focusing
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, [isInlineEditing, nodeData.displayName]);

  /** Confirm inline edit: apply new display name via coreStore.updateNode() */
  const confirmEdit = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== nodeData.displayName) {
      useCoreStore.getState().updateNode(nodeData.archNodeId, {
        displayName: trimmedValue,
      });
    }
    useUIStore.getState().clearInlineEdit();
  }, [editValue, nodeData.displayName, nodeData.archNodeId]);

  /** Revert inline edit: discard changes */
  const revertEdit = useCallback(() => {
    setEditValue(nodeData.displayName);
    useUIStore.getState().clearInlineEdit();
  }, [nodeData.displayName]);

  /** Handle keyboard events on the inline edit input */
  const handleInlineKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Prevent canvas shortcuts from firing
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      revertEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      confirmEdit();
    }
  }, [confirmEdit, revertEdit]);

  // Compute effective color (custom or type-default)
  const effectiveColor = useMemo(
    () => isRef ? '#A855F7' : getEffectiveNodeColor(nodeData.color, nodeData.nodedefType),
    [nodeData.color, nodeData.nodedefType, isRef],
  );

  // Compute style objects for color application
  const headerBgStyle = useMemo(
    () => ({ background: `linear-gradient(to bottom, ${colorToBackground(effectiveColor, 0.15)}, ${colorToBackground(effectiveColor, 0.03)})` }),
    [effectiveColor],
  );

  const accentBarStyle = useMemo(
    () => ({ backgroundColor: effectiveColor }),
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

  return (
    <div
      className={`
        border-2 rounded-lg min-w-[200px] max-w-[280px]
        relative overflow-hidden
        ${isRef ? 'border-dashed' : ''}
        ${selected ? '' : ''}
      `}
      style={{
        ...borderStyle,
        ...shadowStyle,
        background: isRef
          ? 'hsl(var(--iris) / 0.08)'
          : `linear-gradient(${effectiveColor}0F, ${effectiveColor}0F), hsl(var(--surface))`,
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
      {/* Color accent bar (left edge) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
        style={accentBarStyle}
        data-testid="node-color-accent"
      />

      {/* Inbound port handles (left side) */}
      {hasDefinedInboundPorts ? (
        inboundPorts.map((port, index) => (
          <Handle
            key={`in-${port.name}`}
            type="target"
            position={Position.Left}
            id={port.name}
            title={port.name}
            className="!w-3 !h-3 !bg-foam !border-2 !border-surface !rounded-full"
            style={{
              top: `${((index + 1) / (inboundPorts.length + 1)) * 100}%`,
            }}
            data-testid={`port-in-${port.name}`}
            data-port-name={port.name}
            data-port-direction="inbound"
          />
        ))
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-foam !border-2 !border-surface !rounded-full"
          id="in"
          title="in"
          data-testid="port-in-default"
          data-port-name="in"
          data-port-direction="inbound"
        />
      )}

      {/* Node header with tinted background */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ ...headerBgStyle, borderBottom: `1px solid ${effectiveColor}20` }}
        data-testid="node-header"
      >
        <NodeIconBadge icon={Icon} color={effectiveColor} data-testid="node-icon" />
        <div className="min-w-0 flex-1">
          {isInlineEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="text-sm font-medium text-text w-full bg-surface border border-iris rounded px-1 py-0 outline-none ring-2 ring-iris/30 nodrag"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleInlineKeyDown}
              onBlur={confirmEdit}
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
          <span className="inline-block mt-0.5 px-1.5 py-0 rounded-full bg-highlight-med text-[10px] leading-4 text-muted-foreground truncate max-w-full" data-testid="node-type-label">
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
          <div className="text-xs text-iris cursor-pointer" title="Has children - double click to zoom in">
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
        pendingSuggestionCount={nodeData.pendingSuggestionCount}
        codeRefCount={nodeData.codeRefCount}
        className="px-3 py-1.5"
        dividerColor={`${effectiveColor}20`}
      />

      {/* Outbound port handles (right side) */}
      {hasDefinedOutboundPorts ? (
        outboundPorts.map((port, index) => (
          <Handle
            key={`out-${port.name}`}
            type="source"
            position={Position.Right}
            id={port.name}
            title={port.name}
            className="!w-3 !h-3 !bg-pine !border-2 !border-surface !rounded-full"
            style={{
              top: `${((index + 1) / (outboundPorts.length + 1)) * 100}%`,
            }}
            data-testid={`port-out-${port.name}`}
            data-port-name={port.name}
            data-port-direction="outbound"
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-pine !border-2 !border-surface !rounded-full"
          id="out"
          title="out"
          data-testid="port-out-default"
          data-port-name="out"
          data-port-direction="outbound"
        />
      )}
    </div>
  );
}

export const GenericNode = memo(GenericNodeComponent);

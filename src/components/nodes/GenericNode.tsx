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
import { getEffectiveNodeColor, colorToBackground } from '@/utils/nodeColors';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';
import {
  Box, Server, Database, HardDrive, Radio, Globe, Shield, Cpu, Layers,
  Inbox, GitFork, Activity, BarChart3, FileText, Cog, Zap, Archive,
  ExternalLink,
} from 'lucide-react';

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
    () => ({ backgroundColor: colorToBackground(effectiveColor, 0.1) }),
    [effectiveColor],
  );

  const accentBarStyle = useMemo(
    () => ({ backgroundColor: effectiveColor }),
    [effectiveColor],
  );

  const borderStyle = useMemo(
    () => ({
      borderColor: selected ? '#3B82F6' : `${effectiveColor}66`,
    }),
    [effectiveColor, selected],
  );

  return (
    <div
      className={`
        border-2 rounded-lg shadow-sm min-w-[200px] max-w-[280px]
        transition-shadow relative overflow-hidden
        ${isRef ? 'border-dashed' : ''}
        ${selected ? 'shadow-md ring-2 ring-blue-200' : 'hover:shadow-md'}
      `}
      style={{
        ...borderStyle,
        backgroundColor: isRef ? '#FAF5FF' : '#FFFFFF',
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
            className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white !rounded-full"
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
          className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white !rounded-full"
          id="in"
          title="in"
          data-testid="port-in-default"
          data-port-name="in"
          data-port-direction="inbound"
        />
      )}

      {/* Node header with tinted background */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-gray-100"
        style={headerBgStyle}
        data-testid="node-header"
      >
        <Icon
          className="w-4 h-4 shrink-0"
          style={{ color: effectiveColor }}
          data-testid="node-icon"
        />
        <div className="min-w-0 flex-1">
          {isInlineEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="text-sm font-medium text-gray-900 w-full bg-white border border-blue-400 rounded px-1 py-0 outline-none ring-2 ring-blue-200 nodrag"
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
            <div className="text-sm font-medium text-gray-900 truncate" data-testid="node-display-name">
              {nodeData.displayName}
            </div>
          )}
          <div className="text-xs text-gray-400 truncate" data-testid="node-type-label">
            {nodeData.nodedefType}
          </div>
        </div>
        {isRef && (
          <span
            className="shrink-0"
            data-testid="ref-indicator"
            title={`Reference to: ${nodeData.refSource}`}
          >
            <ExternalLink className="w-3.5 h-3.5 text-purple-500" />
          </span>
        )}
        {nodeData.hasChildren && (
          <div className="text-xs text-blue-500 cursor-pointer" title="Has children - double click to zoom in">
            ▶
          </div>
        )}
      </div>

      {/* Reference source indicator */}
      {isRef && (
        <div
          className="flex items-center gap-1 px-3 py-1 text-xs text-purple-600 bg-purple-50 border-b border-purple-100"
          data-testid="ref-source-indicator"
          title={`References: ${nodeData.refSource}`}
        >
          <span className="font-medium">ref:</span>
          <span className="truncate font-mono">{nodeData.refSource}</span>
        </div>
      )}

      {/* Node body - show key args */}
      {Object.keys(nodeData.args).length > 0 && (
        <div className="px-3 py-1.5 text-xs text-gray-500">
          {Object.entries(nodeData.args).slice(0, 3).map(([key, value]) => (
            <div key={key} className="truncate">
              <span className="font-mono text-gray-400">{key}:</span>{' '}
              <span>{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Badges */}
      {(nodeData.noteCount > 0 || nodeData.pendingSuggestionCount > 0 || nodeData.codeRefCount > 0) && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100 text-xs" data-testid="node-badges">
          {nodeData.noteCount > 0 && (
            <span className="text-gray-400" title={`${nodeData.noteCount} notes`} data-testid="badge-notes">
              📝 {nodeData.noteCount}
            </span>
          )}
          {nodeData.pendingSuggestionCount > 0 && (
            <span className="text-amber-500" title={`${nodeData.pendingSuggestionCount} pending suggestions`} data-testid="badge-suggestions">
              💡 {nodeData.pendingSuggestionCount}
            </span>
          )}
          {nodeData.codeRefCount > 0 && (
            <span className="text-gray-400" title={`${nodeData.codeRefCount} code references`} data-testid="badge-coderefs">
              📎 {nodeData.codeRefCount}
            </span>
          )}
        </div>
      )}

      {/* Outbound port handles (right side) */}
      {hasDefinedOutboundPorts ? (
        outboundPorts.map((port, index) => (
          <Handle
            key={`out-${port.name}`}
            type="source"
            position={Position.Right}
            id={port.name}
            title={port.name}
            className="!w-3 !h-3 !bg-green-400 !border-2 !border-white !rounded-full"
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
          className="!w-3 !h-3 !bg-green-400 !border-2 !border-white !rounded-full"
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

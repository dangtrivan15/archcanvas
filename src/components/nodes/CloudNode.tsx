/**
 * CloudNode - A cloud-shaped node component for CDN and external/distributed
 * service nodes in architecture diagrams.
 *
 * Uses NodeShell with shape='cloud' for the SVG background.
 * Maps to: network/cdn
 */

import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CanvasNodeData } from '@/types/canvas';
import { getEffectiveNodeColor, colorToBackground } from '@/utils/nodeColors';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';
import { iconMap } from './GenericNode';
import { NodeShell } from './shapes/NodeShell';
import { Box, ExternalLink } from 'lucide-react';
import { getHandlePosition } from './shapes/handlePositions';
import { useNodeHeight } from './shapes/useNodeHeight';

const CLOUD_WIDTH = 260;

function CloudNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const Icon = iconMap[nodeData.icon] ?? Box;
  const isRef = !!nodeData.refSource;
  const [outerRef, nodeHeight] = useNodeHeight();

  const inboundPorts = nodeData.ports?.inbound ?? [];
  const outboundPorts = nodeData.ports?.outbound ?? [];
  const hasDefinedInboundPorts = inboundPorts.length > 0;
  const hasDefinedOutboundPorts = outboundPorts.length > 0;

  // ── Inline edit state ──────────────────────────────────────────────
  const inlineEditNodeId = useUIStore((s) => s.inlineEditNodeId);
  const isInlineEditing = inlineEditNodeId === nodeData.archNodeId;
  const [editValue, setEditValue] = useState(nodeData.displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isInlineEditing) {
      setEditValue(nodeData.displayName);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, [isInlineEditing, nodeData.displayName]);

  const confirmEdit = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== nodeData.displayName) {
      useCoreStore.getState().updateNode(nodeData.archNodeId, {
        displayName: trimmedValue,
      });
    }
    useUIStore.getState().clearInlineEdit();
  }, [editValue, nodeData.displayName, nodeData.archNodeId]);

  const revertEdit = useCallback(() => {
    setEditValue(nodeData.displayName);
    useUIStore.getState().clearInlineEdit();
  }, [nodeData.displayName]);

  const handleInlineKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
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

  const effectiveColor = useMemo(
    () => isRef ? '#A855F7' : getEffectiveNodeColor(nodeData.color, nodeData.nodedefType),
    [nodeData.color, nodeData.nodedefType, isRef],
  );

  const headerBgStyle = useMemo(
    () => ({ background: `linear-gradient(to bottom, ${colorToBackground(effectiveColor, 0.15)}, ${colorToBackground(effectiveColor, 0.03)})` }),
    [effectiveColor],
  );

  return (
    <div
      ref={outerRef}
      className="relative"
      data-testid={`node-${nodeData.archNodeId}`}
      data-node-id={nodeData.archNodeId}
      data-node-type={nodeData.nodedefType}
      data-node-name={nodeData.displayName}
      data-node-color={effectiveColor}
      data-ref-source={nodeData.refSource || undefined}
    >
      {/* Inbound port handles - positioned at widest left cloud bump */}
      {hasDefinedInboundPorts ? (
        inboundPorts.map((port, index) => (
          <Handle
            key={`in-${port.name}`}
            type="target"
            position={Position.Left}
            id={port.name}
            title={port.name}
            className="!w-3 !h-3 !bg-foam !border-2 !border-surface !rounded-full"
            style={getHandlePosition('cloud', 'left', index, inboundPorts.length, CLOUD_WIDTH, nodeHeight)}
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
          style={getHandlePosition('cloud', 'left', 0, 1, CLOUD_WIDTH, nodeHeight)}
          data-testid="port-in-default"
          data-port-name="in"
          data-port-direction="inbound"
        />
      )}

      <NodeShell
        shape="cloud"
        width={CLOUD_WIDTH}
        color={effectiveColor}
        selected={selected ?? false}
      >
        {/* Inner content - extra padding for cloud bumps */}
        <div className="flex flex-col items-center text-center px-6 py-3">
          {/* Header with icon and name */}
          <div
            className="flex items-center gap-2 w-full justify-center py-1"
            style={headerBgStyle}
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
                  className="text-sm font-medium text-text w-full bg-surface border border-iris rounded px-1 py-0 outline-none ring-2 ring-iris/30 nodrag text-center"
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
              <div className="text-xs text-muted-foreground truncate" data-testid="node-type-label">
                {nodeData.nodedefType}
              </div>
            </div>
            {isRef && (
              <span className="shrink-0" data-testid="ref-indicator" title={`Reference to: ${nodeData.refSource}`}>
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
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-iris bg-iris/10 rounded mt-1 w-full justify-center"
              data-testid="ref-source-indicator"
              title={`References: ${nodeData.refSource}`}
            >
              <span className="font-medium">ref:</span>
              <span className="truncate font-mono">{nodeData.refSource}</span>
            </div>
          )}

          {/* Args */}
          {Object.keys(nodeData.args).length > 0 && (
            <div className="text-xs text-subtle mt-1 w-full text-center">
              {Object.entries(nodeData.args).slice(0, 3).map(([key, value]) => (
                <div key={key} className="truncate">
                  <span className="font-mono text-muted-foreground">{key}:</span>{' '}
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Badges */}
          {(nodeData.noteCount > 0 || nodeData.pendingSuggestionCount > 0 || nodeData.codeRefCount > 0) && (
            <div className="flex items-center gap-2 mt-1 text-xs justify-center" data-testid="node-badges">
              {nodeData.noteCount > 0 && (
                <span className="text-muted-foreground" title={`${nodeData.noteCount} notes`} data-testid="badge-notes">
                  📝 {nodeData.noteCount}
                </span>
              )}
              {nodeData.pendingSuggestionCount > 0 && (
                <span className="text-amber-500" title={`${nodeData.pendingSuggestionCount} pending suggestions`} data-testid="badge-suggestions">
                  💡 {nodeData.pendingSuggestionCount}
                </span>
              )}
              {nodeData.codeRefCount > 0 && (
                <span className="text-muted-foreground" title={`${nodeData.codeRefCount} code references`} data-testid="badge-coderefs">
                  📎 {nodeData.codeRefCount}
                </span>
              )}
            </div>
          )}
        </div>
      </NodeShell>

      {/* Outbound port handles - positioned at widest right cloud bump */}
      {hasDefinedOutboundPorts ? (
        outboundPorts.map((port, index) => (
          <Handle
            key={`out-${port.name}`}
            type="source"
            position={Position.Right}
            id={port.name}
            title={port.name}
            className="!w-3 !h-3 !bg-pine !border-2 !border-surface !rounded-full"
            style={getHandlePosition('cloud', 'right', index, outboundPorts.length, CLOUD_WIDTH, nodeHeight)}
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
          style={getHandlePosition('cloud', 'right', 0, 1, CLOUD_WIDTH, nodeHeight)}
          data-testid="port-out-default"
          data-port-name="out"
          data-port-direction="outbound"
        />
      )}
    </div>
  );
}

export const CloudNode = memo(CloudNodeComponent);

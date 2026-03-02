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
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CanvasNodeData } from '@/types/canvas';
import {
  Box, Server, Database, HardDrive, Radio, Globe, Shield, Cpu, Layers,
  Inbox, GitFork, Activity, BarChart3, FileText, Cog, Zap, Archive,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
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

  const inboundPorts = nodeData.ports?.inbound ?? [];
  const outboundPorts = nodeData.ports?.outbound ?? [];
  const hasDefinedInboundPorts = inboundPorts.length > 0;
  const hasDefinedOutboundPorts = outboundPorts.length > 0;

  return (
    <div
      className={`
        bg-white border-2 rounded-lg shadow-sm min-w-[200px] max-w-[280px]
        transition-shadow relative
        ${selected ? 'border-blue-500 shadow-md ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}
      `}
      data-testid={`node-${nodeData.archNodeId}`}
      data-node-id={nodeData.archNodeId}
      data-node-type={nodeData.nodedefType}
      data-node-name={nodeData.displayName}
    >
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

      {/* Node header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <Icon className="w-4 h-4 text-gray-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900 truncate" data-testid="node-display-name">
            {nodeData.displayName}
          </div>
          <div className="text-xs text-gray-400 truncate" data-testid="node-type-label">
            {nodeData.nodedefType}
          </div>
        </div>
        {nodeData.hasChildren && (
          <div className="text-xs text-blue-500 cursor-pointer" title="Has children - double click to zoom in">
            ▶
          </div>
        )}
      </div>

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
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100 text-xs">
          {nodeData.noteCount > 0 && (
            <span className="text-gray-400" title={`${nodeData.noteCount} notes`}>
              📝 {nodeData.noteCount}
            </span>
          )}
          {nodeData.pendingSuggestionCount > 0 && (
            <span className="text-amber-500" title={`${nodeData.pendingSuggestionCount} pending suggestions`}>
              💡 {nodeData.pendingSuggestionCount}
            </span>
          )}
          {nodeData.codeRefCount > 0 && (
            <span className="text-gray-400" title={`${nodeData.codeRefCount} code references`}>
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

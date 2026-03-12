import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Node as RFNode } from '@xyflow/react';
import type { CanvasNodeData } from '../canvas/types';
import type { PortDef } from '@/types/nodeDefSchema';
import { useFileStore } from '@/store/fileStore';
import { resolveIcon } from './iconMap';
import './nodeShapes.css';

type NodeRendererProps = NodeProps<RFNode<CanvasNodeData>>;

export function NodeRenderer({ data }: NodeRendererProps) {
  const { node, nodeDef, isSelected, isRef } = data;

  // Determine display name
  const displayName = (() => {
    if (isRef && 'ref' in node) {
      const refCanvas = useFileStore.getState().getCanvas(node.ref);
      return refCanvas?.data.displayName ?? node.ref;
    }
    return ('displayName' in node && node.displayName) ? node.displayName : node.id;
  })();

  const shape = nodeDef?.metadata.shape ?? 'rectangle';
  const icon = nodeDef?.metadata.icon ?? (isRef ? '↗' : '□');
  const typeLabel = !isRef && 'type' in node ? node.type : undefined;

  const ports: PortDef[] = nodeDef?.spec.ports ?? [];
  const inboundPorts = ports.filter((p) => p.direction === 'inbound');
  const outboundPorts = ports.filter((p) => p.direction === 'outbound');

  const classNames = [
    'arch-node',
    `node-shape-${shape}`,
    isSelected ? 'selected' : '',
    isRef ? 'ref-node' : '',
    nodeDef === undefined && !isRef ? 'unknown-type' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      {/* Default target handle — always present so edges can connect */}
      {inboundPorts.length === 0 && (
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          style={{ top: '50%' }}
        />
      )}

      {/* Named inbound port handles */}
      {inboundPorts.map((port, idx) => (
        <Handle
          key={port.name}
          type="target"
          position={Position.Left}
          id={port.name}
          style={{
            top: `${((idx + 1) / (inboundPorts.length + 1)) * 100}%`,
          }}
          title={port.name}
        />
      ))}

      {/* Header: icon + display name */}
      <div className="arch-node-header">
        <span className="arch-node-header-icon" aria-hidden="true">
          {(() => {
            const IconComponent = resolveIcon(nodeDef?.metadata.icon);
            return IconComponent
              ? <IconComponent className="h-4 w-4 inline-block" />
              : icon;
          })()}
        </span>
        <span className="arch-node-header-name" title={displayName}>
          {displayName}
        </span>
      </div>

      {/* Type label (inline nodes only) */}
      {typeLabel !== undefined && (
        <div className="arch-node-type">{typeLabel}</div>
      )}

      {/* Warning badge for unknown types */}
      {nodeDef === undefined && !isRef && (
        <div className="arch-node-warning" role="alert">
          <span aria-hidden="true">⚠</span>
          Unknown type
        </div>
      )}

      {/* Default source handle — always present so edges can connect */}
      {outboundPorts.length === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          style={{ top: '50%' }}
        />
      )}

      {/* Named outbound port handles */}
      {outboundPorts.map((port, idx) => (
        <Handle
          key={port.name}
          type="source"
          position={Position.Right}
          id={port.name}
          style={{
            top: `${((idx + 1) / (outboundPorts.length + 1)) * 100}%`,
          }}
          title={port.name}
        />
      ))}
    </div>
  );
}

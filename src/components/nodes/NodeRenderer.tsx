import { useContext } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import type { Node as RFNode } from '@xyflow/react';
import type { CanvasNodeData } from '../canvas/types';
import type { PortDef } from '@/types/nodeDefSchema';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useNavigationStore } from '@/store/navigationStore';
import { resolveIcon } from './iconMap';
import { SubsystemPreview } from './SubsystemPreview';
import { PreviewModeContext } from './PreviewModeContext';
import './nodeShapes.css';

type NodeRendererProps = NodeProps<RFNode<CanvasNodeData>>;

export function NodeRenderer({ data }: NodeRendererProps) {
  const { node, nodeDef, isSelected, isRef } = data;
  const isPreview = useContext(PreviewModeContext);

  // Determine display name
  const displayName = (() => {
    if (isRef && 'ref' in node) {
      // Canvas map is keyed by node.id, not the ref filename
      const refCanvas = useFileStore.getState().getCanvas(node.id);
      return refCanvas?.data.displayName ?? node.id;
    }
    return ('displayName' in node && node.displayName) ? node.displayName : node.id;
  })();

  const shape = isRef ? 'container' : (nodeDef?.metadata.shape ?? 'rectangle');
  const icon = nodeDef?.metadata.icon ?? (isRef ? '↗' : '□');
  const typeLabel = !isRef && 'type' in node ? node.type : undefined;

  const handleResize = (_: unknown, params: { width: number; height: number }) => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const existingPos = node.position ?? { x: 0, y: 0 };
    useGraphStore.getState().updateNodePosition(canvasId, node.id, {
      ...existingPos,
      width: params.width,
      height: params.height,
      autoSize: false,
    });
  };

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
      {/* NodeResizer for container RefNodes */}
      {isRef && (
        <NodeResizer
          isVisible={isSelected}
          minWidth={180}
          minHeight={120}
          onResizeEnd={handleResize}
        />
      )}

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

      {/* Mini-node preview for container RefNodes (skipped in preview mode to prevent recursion) */}
      {isRef && !isPreview && <SubsystemPreview canvasId={node.id} />}

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

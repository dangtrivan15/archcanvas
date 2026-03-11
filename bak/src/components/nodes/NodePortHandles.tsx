/**
 * NodePortHandles - Shared component for rendering inbound/outbound port handles.
 *
 * Consolidates the duplicated port handle rendering logic from all shaped node
 * components (HexagonNode, CloudNode, CylinderNode, DocumentNode, ParallelogramNode,
 * StadiumNode). Each of these components had identical logic for rendering
 * inbound/outbound handles with shape-aware positioning.
 *
 * For GenericNode, use the simpler `GenericPortHandles` which uses percentage-based
 * positioning without shape-aware math.
 */

import { Handle, Position } from '@xyflow/react';
import type { ShapeName } from './shapes/shapeRegistry';
import { getHandlePosition } from './shapes/handlePositions';

export interface PortDefinition {
  name: string;
}

export interface ShapedPortHandlesProps {
  /** Shape name for position calculation */
  shape: ShapeName;
  /** Node width for position calculation */
  width: number;
  /** Node height for position calculation */
  nodeHeight: number;
  /** Inbound port definitions */
  inboundPorts: PortDefinition[];
  /** Outbound port definitions */
  outboundPorts: PortDefinition[];
}

/**
 * Renders shape-aware inbound and outbound port handles.
 * Used by all shaped nodes (hexagon, cloud, cylinder, document, parallelogram, stadium).
 */
export function ShapedPortHandles({
  shape,
  width,
  nodeHeight,
  inboundPorts,
  outboundPorts,
}: ShapedPortHandlesProps) {
  const hasDefinedInboundPorts = inboundPorts.length > 0;
  const hasDefinedOutboundPorts = outboundPorts.length > 0;

  return (
    <>
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
            style={getHandlePosition(shape, 'left', index, inboundPorts.length, width, nodeHeight)}
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
          style={getHandlePosition(shape, 'left', 0, 1, width, nodeHeight)}
          data-testid="port-in-default"
          data-port-name="in"
          data-port-direction="inbound"
        />
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
            className="!w-3 !h-3 !bg-pine !border-2 !border-surface !rounded-full"
            style={getHandlePosition(shape, 'right', index, outboundPorts.length, width, nodeHeight)}
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
          style={getHandlePosition(shape, 'right', 0, 1, width, nodeHeight)}
          data-testid="port-out-default"
          data-port-name="out"
          data-port-direction="outbound"
        />
      )}
    </>
  );
}

export interface GenericPortHandlesProps {
  /** Inbound port definitions */
  inboundPorts: PortDefinition[];
  /** Outbound port definitions */
  outboundPorts: PortDefinition[];
}

/**
 * Renders simple percentage-based inbound and outbound port handles.
 * Used by GenericNode which doesn't use shape-aware positioning.
 */
export function GenericPortHandles({ inboundPorts, outboundPorts }: GenericPortHandlesProps) {
  const hasDefinedInboundPorts = inboundPorts.length > 0;
  const hasDefinedOutboundPorts = outboundPorts.length > 0;

  return (
    <>
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
    </>
  );
}

/**
 * HexagonNode - A hexagonal node component for API gateways, load balancers,
 * and other routing/decision-point nodes in architecture diagrams.
 *
 * Uses NodeShell with shape='hexagon' for the SVG background.
 * Reuses shared NodeContent for inner layout and NodePortHandles for ports.
 * Maps to: compute/api-gateway, network/load-balancer
 */

import { memo, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { CanvasNode, CanvasNodeData } from '@/types/canvas';
import { getEffectiveNodeColor } from '@/utils/nodeColors';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { iconMap, DefaultNodeIcon } from './iconMap';
import { NodeShell } from './shapes/NodeShell';
import { ShapedPortHandles } from './NodePortHandles';
import { NodeContent } from './NodeContent';
import { useNodeHeight } from './shapes/useNodeHeight';

const HEXAGON_WIDTH = 240;

function HexagonNodeComponent({ data, selected }: NodeProps<CanvasNode>) {
  const nodeData: CanvasNodeData = data;
  const Icon = iconMap[nodeData.icon] ?? DefaultNodeIcon;
  const isRef = !!nodeData.refSource;
  const [outerRef, nodeHeight] = useNodeHeight();
  const inlineEdit = useInlineEdit(nodeData.archNodeId, nodeData.displayName);

  const inboundPorts = nodeData.ports?.inbound ?? [];
  const outboundPorts = nodeData.ports?.outbound ?? [];

  const effectiveColor = useMemo(
    () => (isRef ? '#A855F7' : getEffectiveNodeColor(nodeData.color, nodeData.nodedefType)),
    [nodeData.color, nodeData.nodedefType, isRef],
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
      data-node-shape="hexagon"
      data-ref-source={nodeData.refSource || undefined}
    >
      <ShapedPortHandles
        shape="hexagon"
        width={HEXAGON_WIDTH}
        nodeHeight={nodeHeight}
        inboundPorts={inboundPorts}
        outboundPorts={outboundPorts}
      />

      <NodeShell
        shape="hexagon"
        width={HEXAGON_WIDTH}
        color={effectiveColor}
        selected={selected ?? false}
      >
        <div className="flex flex-col items-center text-center px-4 py-2">
          <NodeContent
            nodeData={nodeData}
            Icon={Icon}
            effectiveColor={effectiveColor}
            isRef={isRef}
            inlineEdit={inlineEdit}
            centered
          />
        </div>
      </NodeShell>
    </div>
  );
}

export const HexagonNode = memo(HexagonNodeComponent);

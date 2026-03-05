/**
 * StadiumNode - A pill/stadium-shaped node component for Event Bus
 * and broadcast hub nodes in architecture diagrams.
 *
 * Uses NodeShell with shape='stadium' for the SVG background.
 * Maps to: messaging/event-bus
 */

import { memo, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { CanvasNodeData } from '@/types/canvas';
import { getEffectiveNodeColor } from '@/utils/nodeColors';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { iconMap, DefaultNodeIcon } from './iconMap';
import { NodeShell } from './shapes/NodeShell';
import { ShapedPortHandles } from './NodePortHandles';
import { NodeContent } from './NodeContent';
import { useNodeHeight } from './shapes/useNodeHeight';

const STADIUM_WIDTH = 240;

function StadiumNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
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
      data-ref-source={nodeData.refSource || undefined}
    >
      <ShapedPortHandles
        shape="stadium"
        width={STADIUM_WIDTH}
        nodeHeight={nodeHeight}
        inboundPorts={inboundPorts}
        outboundPorts={outboundPorts}
      />

      <NodeShell
        shape="stadium"
        width={STADIUM_WIDTH}
        color={effectiveColor}
        selected={selected ?? false}
      >
        {/* Extra horizontal padding for rounded ends */}
        <div className="flex flex-col items-center text-center px-6 py-2">
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

export const StadiumNode = memo(StadiumNodeComponent);

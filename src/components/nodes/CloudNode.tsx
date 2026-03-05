/**
 * CloudNode - A cloud-shaped node component for CDN and external/distributed
 * service nodes in architecture diagrams.
 *
 * Uses NodeShell with shape='cloud' for the SVG background.
 * Maps to: network/cdn
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

const CLOUD_WIDTH = 260;

function CloudNodeComponent({ data, selected }: NodeProps) {
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
        shape="cloud"
        width={CLOUD_WIDTH}
        nodeHeight={nodeHeight}
        inboundPorts={inboundPorts}
        outboundPorts={outboundPorts}
      />

      <NodeShell
        shape="cloud"
        width={CLOUD_WIDTH}
        color={effectiveColor}
        selected={selected ?? false}
      >
        {/* Extra padding for cloud bumps */}
        <div className="flex flex-col items-center text-center px-6 py-3">
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

export const CloudNode = memo(CloudNodeComponent);

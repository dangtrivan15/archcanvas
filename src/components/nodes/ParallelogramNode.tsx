/**
 * ParallelogramNode - A parallelogram-shaped node for async buffer and
 * stream processing components in architecture diagrams.
 *
 * Uses NodeShell with shape='parallelogram' for the SVG background.
 * Maps to: messaging/message-queue, messaging/stream-processor
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

const PARALLELOGRAM_WIDTH = 240;

function ParallelogramNodeComponent({ data, selected }: NodeProps) {
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
      data-node-shape="parallelogram"
      data-ref-source={nodeData.refSource || undefined}
    >
      <ShapedPortHandles
        shape="parallelogram"
        width={PARALLELOGRAM_WIDTH}
        nodeHeight={nodeHeight}
        inboundPorts={inboundPorts}
        outboundPorts={outboundPorts}
      />

      <NodeShell
        shape="parallelogram"
        width={PARALLELOGRAM_WIDTH}
        color={effectiveColor}
        selected={selected ?? false}
      >
        {/* Extra horizontal padding for slant */}
        <div className="flex flex-col px-6 py-2" style={{ minWidth: 0 }}>
          <NodeContent
            nodeData={nodeData}
            Icon={Icon}
            effectiveColor={effectiveColor}
            isRef={isRef}
            inlineEdit={inlineEdit}
            headerClassName="flex items-center gap-2 py-1 pb-1.5"
            argsClassName="px-1 py-1"
            badgesClassName="pt-1"
            refClassName="flex items-center gap-1 px-2 py-0.5 text-xs text-iris mt-1"
          />
        </div>
      </NodeShell>
    </div>
  );
}

export const ParallelogramNode = memo(ParallelogramNodeComponent);

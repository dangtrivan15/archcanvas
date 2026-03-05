/**
 * CylinderNode - A cylinder-shaped node for data-layer components.
 *
 * Uses NodeShell with shape='cylinder' to render the classic database cylinder shape.
 * Maps to: data/database, data/cache, data/object-storage, data/repository
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

const CYLINDER_WIDTH = 220;

function CylinderNodeComponent({ data, selected }: NodeProps<CanvasNode>) {
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
      data-node-shape="cylinder"
      data-ref-source={nodeData.refSource || undefined}
    >
      <ShapedPortHandles
        shape="cylinder"
        width={CYLINDER_WIDTH}
        nodeHeight={nodeHeight}
        inboundPorts={inboundPorts}
        outboundPorts={outboundPorts}
      />

      <NodeShell
        shape="cylinder"
        width={CYLINDER_WIDTH}
        color={effectiveColor}
        selected={selected ?? false}
      >
        <div className="flex flex-col" style={{ minWidth: 0 }}>
          <NodeContent
            nodeData={nodeData}
            Icon={Icon}
            effectiveColor={effectiveColor}
            isRef={isRef}
            inlineEdit={inlineEdit}
            headerClassName="flex items-center gap-2 px-2 py-1.5"
            argsClassName="px-2 py-1"
            badgesClassName="px-2 py-1"
            refClassName="flex items-center gap-1 px-2 py-1 text-xs text-iris"
          />
        </div>
      </NodeShell>
    </div>
  );
}

export const CylinderNode = memo(CylinderNodeComponent);

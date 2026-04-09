import { useContext, useMemo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import type { Node as RFNode } from '@xyflow/react';
import type { CanvasNodeData } from '../canvas/types';
import type { PortDef } from '@/types/nodeDefSchema';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useDiffStore } from '@/store/diffStore';
import { resolveIcon } from './iconMap';
import { StickyNote, Code2 } from 'lucide-react';
import { SubsystemPreview } from './SubsystemPreview';
import { PreviewModeContext } from './PreviewModeContext';
import { DiffTooltip } from './DiffTooltip';
import { NODE_MIN_WIDTH_LG, NODE_MIN_HEIGHT } from '@/lib/nodeTokens';
import { extractNamespace } from '@/core/namespaceColors';
import './nodeShapes.css';

type NodeRendererProps = NodeProps<RFNode<CanvasNodeData>>;

/** Compact badge showing child canvas diff summary on RefNode containers */
function SubsystemDiffBadge({ canvasId }: { canvasId: string }) {
  const diff = useDiffStore((s) => s.enabled ? s.canvasDiffs.get(canvasId) : undefined);
  if (!diff) return null;

  const { nodesAdded, nodesRemoved, nodesModified } = diff.summary;
  const total = nodesAdded + nodesRemoved + nodesModified;
  if (total === 0) return null;

  const parts: string[] = [];
  if (nodesAdded > 0) parts.push(`+${nodesAdded}`);
  if (nodesRemoved > 0) parts.push(`−${nodesRemoved}`);
  if (nodesModified > 0) parts.push(`~${nodesModified}`);

  return (
    <div className="arch-node-diff-badge diff-badge-modified" style={{ fontSize: '8px' }}>
      {parts.join(' ')}
    </div>
  );
}

export function NodeRenderer({ data }: NodeRendererProps) {
  const { node, nodeDef, isSelected, isRef, diffStatus, keyArgs, badges, childSummary } = data;
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

  const rawShape = isRef ? 'container' : (nodeDef?.metadata.shape ?? 'rectangle');
  const isCustomShape = typeof rawShape === 'object' && rawShape !== null && 'clipPath' in rawShape;
  const shape = isCustomShape ? 'custom' : rawShape;
  const customClipPath = isCustomShape ? (rawShape as { clipPath: string }).clipPath : undefined;
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

  // Namespace tinting — only for inline nodes (not RefNodes)
  const namespace = !isRef && 'type' in node ? extractNamespace(node.type) : undefined;

  // Per-instance color override — set via CSS custom properties so the CSS cascade
  // can still let diff overlay classes win (inline bg/border would beat everything).
  const instanceColor = !isRef && 'color' in node ? (node as { color?: string }).color : undefined;
  const nodeStyle = useMemo(() => {
    const style: Record<string, string> = {};
    if (instanceColor) {
      style['--node-instance-bg'] = instanceColor;
      style['--node-instance-border'] = instanceColor;
    }
    if (customClipPath) {
      style['clipPath'] = customClipPath;
    }
    return Object.keys(style).length > 0 ? (style as unknown as React.CSSProperties) : undefined;
  }, [instanceColor, customClipPath]);

  const classNames = [
    'arch-node',
    `node-shape-${shape}`,
    isSelected ? 'selected' : '',
    isRef ? 'ref-node' : '',
    nodeDef === undefined && !isRef ? 'unknown-type' : '',
    diffStatus ? `diff-${diffStatus}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} data-ns={namespace} style={nodeStyle}>
      {/* NodeResizer for container RefNodes */}
      {isRef && (
        <NodeResizer
          isVisible={isSelected}
          minWidth={NODE_MIN_WIDTH_LG}
          minHeight={NODE_MIN_HEIGHT}
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

      {/* Multi-scope diff badge for RefNode containers */}
      {isRef && !isPreview && <SubsystemDiffBadge canvasId={node.id} />}

      {/* Type label (inline nodes only) */}
      {typeLabel !== undefined && (
        <div className="arch-node-type">{typeLabel}</div>
      )}

      {/* Key arguments — first 2 args with non-default values */}
      {keyArgs && keyArgs.length > 0 && (
        <div className="arch-node-key-args">
          {keyArgs.map((arg) => (
            <div key={arg.name} className="arch-node-key-arg">
              <span className="arch-node-key-arg-name">{arg.name}</span>
              <span className="arch-node-key-arg-value">{String(arg.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Container mini-summary — namespace-grouped child count */}
      {isRef && childSummary && !isPreview && (
        <div className="arch-node-child-summary">{childSummary}</div>
      )}

      {/* Metadata badges — notes, code refs, child count */}
      {badges && (badges.hasNotes || badges.hasCodeRefs || badges.childCount > 0) && (
        <div className="arch-node-badges">
          {badges.hasNotes && (
            <span className="arch-node-badge" title="Has notes">
              <StickyNote className="h-3 w-3" />
            </span>
          )}
          {badges.hasCodeRefs && (
            <span className="arch-node-badge" title="Has code references">
              <Code2 className="h-3 w-3" />
            </span>
          )}
          {badges.childCount > 0 && (
            <span className="arch-node-badge arch-node-badge-count" title={`${badges.childCount} children`}>
              {badges.childCount}
            </span>
          )}
        </div>
      )}

      {/* Warning badge for unknown types */}
      {nodeDef === undefined && !isRef && (
        <div className="arch-node-warning" role="alert">
          <span aria-hidden="true">⚠</span>
          Unknown type
        </div>
      )}

      {/* Diff status badge with tooltip */}
      {diffStatus && diffStatus !== 'unchanged' && (
        <DiffTooltip nodeId={node.id}>
          <div className={`arch-node-diff-badge diff-badge-${diffStatus}`} role="status">
            {diffStatus === 'added' && '+ Added'}
            {diffStatus === 'removed' && '− Removed'}
            {diffStatus === 'modified' && '~ Modified'}
          </div>
        </DiffTooltip>
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

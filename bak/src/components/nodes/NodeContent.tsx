/**
 * NodeContent - Shared inner content layout for shaped node components.
 *
 * Consolidates the duplicated inner content (header with icon+name, inline edit,
 * ref indicator, args table, badges) that was repeated identically across
 * HexagonNode, CloudNode, CylinderNode, DocumentNode, ParallelogramNode,
 * and StadiumNode.
 *
 * Each shaped node still controls its own outer padding and alignment via
 * the `className` prop.
 */

import type { CanvasNodeData } from '@/types/canvas';
import { NodeIconBadge } from './NodeIconBadge';
import { NodeArgsTable } from './NodeArgsTable';
import { NodeBadges } from './NodeBadges';
import { ExternalLink } from 'lucide-react';
import type { UseInlineEditResult } from '@/hooks/useInlineEdit';

export interface NodeContentProps {
  /** Node data from canvas */
  nodeData: CanvasNodeData;
  /** The resolved icon component */
  Icon: React.ElementType;
  /** The computed effective color */
  effectiveColor: string;
  /** Whether this is a reference node */
  isRef: boolean;
  /** Inline edit hook result */
  inlineEdit: UseInlineEditResult;
  /** Additional className for the header div */
  headerClassName?: string;
  /** Whether to center text (for shaped nodes) */
  centered?: boolean;
  /** Additional className for the args table */
  argsClassName?: string;
  /** Additional className for the badges */
  badgesClassName?: string;
  /** Additional className for the ref source indicator */
  refClassName?: string;
}

/**
 * Renders the shared inner content for all node types:
 * header (icon + name + inline edit + type badge), ref indicator, args, and badges.
 */
export function NodeContent({
  nodeData,
  Icon,
  effectiveColor,
  isRef,
  inlineEdit,
  headerClassName = 'flex items-center gap-2 w-full justify-center py-1 pb-1.5',
  centered = false,
  argsClassName = 'mt-1 w-full',
  badgesClassName = 'mt-1 pt-1 justify-center',
  refClassName = 'flex items-center gap-1 px-2 py-0.5 text-xs text-iris mt-1 w-full justify-center',
}: NodeContentProps) {
  const { isInlineEditing, editValue, setEditValue, inputRef, confirmEdit, handleKeyDown } =
    inlineEdit;

  return (
    <>
      {/* Header with icon and name */}
      <div className={headerClassName} style={{ borderBottom: `1px solid ${effectiveColor}20` }}>
        <NodeIconBadge icon={Icon} color={effectiveColor} data-testid="node-icon" />
        <div className="min-w-0 flex-1">
          {isInlineEditing ? (
            <input
              ref={inputRef}
              type="text"
              className={`text-sm font-medium text-text w-full bg-surface border border-iris rounded px-1 py-0 outline-none ring-2 ring-iris/30 nodrag${centered ? ' text-center' : ''}`}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={confirmEdit}
              data-testid="inline-edit-input"
              aria-label="Edit node name"
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <div className="text-sm font-medium text-text truncate" data-testid="node-display-name">
              {nodeData.displayName}
            </div>
          )}
          <span
            className="inline-block mt-0.5 px-1.5 py-0 rounded-full bg-highlight-med text-[10px] leading-4 text-muted-foreground truncate max-w-full"
            data-testid="node-type-label"
          >
            {nodeData.nodedefType}
          </span>
        </div>
        {isRef && (
          <span
            className="shrink-0"
            data-testid="ref-indicator"
            title={`Reference to: ${nodeData.refSource}`}
          >
            <ExternalLink className="w-3.5 h-3.5 text-iris" />
          </span>
        )}
        {nodeData.hasChildren && (
          <div className="text-xs text-iris cursor-pointer" title="Has children - double click to zoom in">
            ▶
          </div>
        )}
      </div>

      {/* Reference source indicator */}
      {isRef && (
        <div
          className={refClassName}
          data-testid="ref-source-indicator"
          title={`References: ${nodeData.refSource}`}
        >
          <span className="font-medium">ref:</span>
          <span className="truncate font-mono">{nodeData.refSource}</span>
        </div>
      )}

      {/* Args */}
      {Object.keys(nodeData.args).length > 0 && (
        <NodeArgsTable args={nodeData.args} maxRows={3} className={argsClassName} centered={centered} />
      )}

      {/* Badges (footer) */}
      <NodeBadges
        noteCount={nodeData.noteCount}
        codeRefCount={nodeData.codeRefCount}
        className={badgesClassName}
        dividerColor={`${effectiveColor}20`}
      />
    </>
  );
}

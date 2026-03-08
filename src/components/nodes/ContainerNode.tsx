/**
 * ContainerNode - A container node component for nested .archc canvas references.
 *
 * Represents a child .archc file as a visually distinct container on the parent canvas.
 * Features:
 * - Layered/nested visual treatment with rounded border and layered shadow
 * - Live miniature SVG preview of the child graph (non-interactive)
 * - Lazy-loaded child graph data via Cross-File Loader Service
 * - Skeleton loading placeholder while child graph is loading
 * - LOD fallback: colored rectangle + node count badge at low zoom
 * - Entire preview surface is clickable to trigger dive-in animation
 * - Child file name display with node count badge
 * - Support for refSource pattern 'file://./relative-path.archc'
 * - Git repository references: shows repo name, ref/tag, node count, description
 * - Visual indicator distinguishing git-referenced nodes from local file references
 * - Error state display when remote fetch fails
 *
 * Maps to: meta/canvas-ref
 */

import { memo, useMemo, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { CanvasNode, CanvasNodeData } from '@/types/canvas';
import {
  getEffectiveNodeColor,
  colorToBackground,
  colorTintedShadow,
  colorGlowShadow,
} from '@/utils/nodeColors';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { useChildGraph, extractRepoName } from '@/hooks/useChildGraph';
import { useCanvasStore } from '@/store/canvasStore';
import { iconMap, DefaultNodeIcon } from './iconMap';
import { NodeIconBadge } from './NodeIconBadge';
import { NodeBadges } from './NodeBadges';
import { GenericPortHandles } from './NodePortHandles';
import { MiniCanvasPreview } from './MiniCanvasPreview';
import {
  FolderOpen,
  ChevronRight,
  Layers,
  GitBranch,
  AlertCircle,
  Loader2,
} from 'lucide-react';

/** Default container color - a teal/cyan tone for canvas references */
const CONTAINER_DEFAULT_COLOR = '#0EA5E9';

/** Preview area dimensions */
const PREVIEW_WIDTH = 260;
const PREVIEW_HEIGHT = 120;

/** Below this parent zoom level, replace full preview with LOD fallback */
const LOD_ZOOM_THRESHOLD = 0.35;

/**
 * Extract a display-friendly file name from a refSource or filePath arg.
 * Supports patterns like 'file://./child-system.archc' or plain paths.
 */
function extractFileName(refSource?: string, filePathArg?: string): string {
  const raw = refSource || filePathArg || '';
  // Strip 'file://' prefix
  const cleaned = raw.replace(/^file:\/\//, '');
  // Get the basename
  const parts = cleaned.split('/');
  const basename = parts[parts.length - 1] || cleaned;
  // Remove .archc extension for display
  return basename.replace(/\.archc$/, '') || 'Untitled Canvas';
}

/**
 * Loading skeleton placeholder shown while child graph is being loaded.
 */
function PreviewSkeleton({ width, height, color }: { width: number; height: number; color: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-md animate-pulse"
      style={{
        width,
        height,
        backgroundColor: `${color}10`,
        border: `1px dashed ${color}30`,
      }}
      data-testid="preview-skeleton"
    >
      <div className="flex flex-col items-center gap-1">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: `${color}50` }} />
        <span className="text-[9px] text-muted-foreground opacity-50">Loading preview…</span>
      </div>
    </div>
  );
}

/**
 * LOD (Level of Detail) fallback for low zoom levels.
 * Shows a simple colored rectangle with a node count badge.
 */
function LodPreviewFallback({
  width,
  height,
  color,
  nodeCount,
}: {
  width: number;
  height: number;
  color: string;
  nodeCount: number;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-md"
      style={{
        width,
        height,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}30`,
      }}
      data-testid="preview-lod-fallback"
    >
      {nodeCount > 0 && (
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${color}25`, color }}
        >
          {nodeCount} node{nodeCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

/**
 * Error state display when remote fetch fails.
 */
function ErrorPreview({
  width,
  height,
  color,
  error,
}: {
  width: number;
  height: number;
  color: string;
  error: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-md"
      style={{
        width,
        height,
        backgroundColor: '#FEF2F2',
        border: '1px solid #FECACA',
      }}
      data-testid="preview-error"
    >
      <AlertCircle className="w-4 h-4 text-red-500" />
      <span className="text-[9px] text-red-600 text-center px-2 leading-tight max-w-full truncate">
        {error.length > 60 ? error.slice(0, 57) + '...' : error}
      </span>
    </div>
  );
}

function ContainerNodeComponent({ data, selected }: NodeProps<CanvasNode>) {
  const nodeData: CanvasNodeData = data;
  const Icon = iconMap[nodeData.icon] ?? DefaultNodeIcon;

  const inboundPorts = nodeData.ports?.inbound ?? [];
  const outboundPorts = nodeData.ports?.outbound ?? [];

  const inlineEdit = useInlineEdit(nodeData.archNodeId, nodeData.displayName);

  // Detect source type: repoUrl vs filePath
  const repoUrlArg = nodeData.args?.repoUrl as string | undefined;
  const refArg = nodeData.args?.ref as string | undefined;
  const filePathArg = nodeData.args?.filePath as string | undefined;
  const descriptionArg = nodeData.args?.description as string | undefined;
  const isGitRef = Boolean(repoUrlArg && repoUrlArg.trim());

  // Load child graph lazily for the mini-preview
  const { graph: childGraph, loading: childLoading, error: childError, sourceType, refreshing: childRefreshing } = useChildGraph(
    nodeData.refSource,
    filePathArg,
    repoUrlArg,
    refArg,
  );

  // Get parent canvas zoom for LOD decision
  const parentZoom = useCanvasStore((s) => s.viewport.zoom);

  // Container nodes get a distinctive color
  const effectiveColor = useMemo(
    () => getEffectiveNodeColor(nodeData.color, nodeData.nodedefType) || CONTAINER_DEFAULT_COLOR,
    [nodeData.color, nodeData.nodedefType],
  );

  // Extract display name: repo name for git refs, file name for local
  const childFileName = useMemo(() => {
    if (isGitRef && repoUrlArg) {
      return extractRepoName(repoUrlArg);
    }
    return extractFileName(nodeData.refSource, filePathArg);
  }, [isGitRef, repoUrlArg, nodeData.refSource, filePathArg]);

  // Node count: from loaded graph if available, otherwise from args
  const nodeCount = childGraph ? childGraph.nodes.length : ((nodeData.args?.nodeCount as number) || 0);

  // Brief description: from loaded graph or args
  const briefDescription = childGraph?.description || descriptionArg || '';

  // Determine if we should show LOD fallback vs full preview
  const isLodMode = parentZoom < LOD_ZOOM_THRESHOLD;

  // Click handler for dive-in (the entire preview surface triggers navigation)
  const handleDiveIn = useCallback(() => {
    // Dispatch a custom event that Canvas.tsx can listen for
    // This is the same pattern used by other node interactions
    const event = new CustomEvent('archcanvas:container-dive-in', {
      detail: { nodeId: nodeData.archNodeId, refSource: nodeData.refSource },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }, [nodeData.archNodeId, nodeData.refSource]);

  // Style computations
  const headerBgStyle = useMemo(
    () => ({
      background: `linear-gradient(to bottom, ${colorToBackground(effectiveColor, 0.22)}, ${colorToBackground(effectiveColor, 0.08)})`,
    }),
    [effectiveColor],
  );

  const borderStyle = useMemo(
    () => ({
      borderColor: selected ? effectiveColor : `${effectiveColor}B3`,
    }),
    [effectiveColor, selected],
  );

  // Layered shadow effect - gives the impression of stacked canvases
  const shadowStyle = useMemo(
    () => ({
      boxShadow: selected
        ? `${colorTintedShadow(effectiveColor, 'hover')}, ${colorGlowShadow(effectiveColor)}, 4px 4px 0 0 ${effectiveColor}30, 8px 8px 0 0 ${effectiveColor}15`
        : `${colorTintedShadow(effectiveColor, 'default')}, 4px 4px 0 0 ${effectiveColor}20, 8px 8px 0 0 ${effectiveColor}10`,
    }),
    [effectiveColor, selected],
  );

  const topAccentStyle = useMemo(
    () => ({
      background: `linear-gradient(to right, ${effectiveColor}, ${effectiveColor}99)`,
    }),
    [effectiveColor],
  );

  const bodyBackgroundStyle = useMemo(
    () => ({
      background: `linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(0,0,0,0.02)), linear-gradient(to bottom, ${effectiveColor}18, ${effectiveColor}0A), hsl(var(--surface))`,
    }),
    [effectiveColor],
  );

  return (
    <div
      className={`
        border-2 rounded-xl min-w-[220px] max-w-[300px]
        relative overflow-hidden
      `}
      style={{
        ...borderStyle,
        ...shadowStyle,
        ...bodyBackgroundStyle,
        transition: 'box-shadow 180ms ease, transform 180ms ease',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.boxShadow = `${colorTintedShadow(effectiveColor, 'hover')}, 4px 4px 0 0 ${effectiveColor}30, 8px 8px 0 0 ${effectiveColor}15`;
        }
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.boxShadow = `${colorTintedShadow(effectiveColor, 'default')}, 4px 4px 0 0 ${effectiveColor}20, 8px 8px 0 0 ${effectiveColor}10`;
        }
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      data-testid={`node-${nodeData.archNodeId}`}
      data-node-id={nodeData.archNodeId}
      data-node-type={nodeData.nodedefType}
      data-node-name={nodeData.displayName}
      data-node-color={effectiveColor}
      data-node-shape="container"
      data-ref-source={nodeData.refSource || undefined}
      data-source-type={sourceType || undefined}
    >
      {/* Color accent strip (top edge) - thicker for container nodes */}
      <div
        className="absolute left-0 right-0 top-0 h-[4px] rounded-t-lg"
        style={topAccentStyle}
        data-testid="node-color-accent"
      />

      {/* Port handles */}
      <GenericPortHandles inboundPorts={inboundPorts} outboundPorts={outboundPorts} />

      {/* Node header with tinted background */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ ...headerBgStyle, borderBottom: `1px solid ${effectiveColor}20` }}
        data-testid="node-header"
      >
        <NodeIconBadge icon={Icon} color={effectiveColor} data-testid="node-icon" />
        <div className="min-w-0 flex-1">
          {inlineEdit.isInlineEditing ? (
            <input
              ref={inlineEdit.inputRef}
              type="text"
              className="text-sm font-medium text-text w-full bg-surface border border-iris rounded px-1 py-0 outline-none ring-2 ring-iris/30 nodrag"
              value={inlineEdit.editValue}
              onChange={(e) => inlineEdit.setEditValue(e.target.value)}
              onKeyDown={inlineEdit.handleKeyDown}
              onBlur={inlineEdit.confirmEdit}
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
      </div>

      {/* Container body - shows nested canvas info + preview */}
      <div className="px-3 py-2.5" data-testid="container-body">
        {/* Source reference: git icon+badge for remote, folder icon for local */}
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"
          data-testid="container-file-ref"
        >
          {isGitRef ? (
            <GitBranch className="w-3.5 h-3.5 shrink-0" style={{ color: effectiveColor }} data-testid="git-ref-icon" />
          ) : (
            <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: effectiveColor }} />
          )}
          <span className="truncate font-mono" title={repoUrlArg || nodeData.refSource || filePathArg || ''}>
            {childFileName}
          </span>
          {/* Git badge indicator */}
          {isGitRef && (
            <span
              className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[9px] font-semibold leading-4"
              style={{
                backgroundColor: '#8B5CF620',
                color: '#8B5CF6',
                border: '1px solid #8B5CF630',
              }}
              data-testid="git-badge"
            >
              git
            </span>
          )}
        </div>

        {/* Git ref/tag display */}
        {isGitRef && refArg && (
          <div
            className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"
            data-testid="container-git-ref"
          >
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] font-mono leading-4"
              style={{
                backgroundColor: `${effectiveColor}12`,
                color: effectiveColor,
                border: `1px solid ${effectiveColor}20`,
              }}
            >
              {refArg}
            </span>
          </div>
        )}

        {/* Brief description from architecture */}
        {briefDescription && (
          <div
            className="text-[10px] text-muted-foreground mb-2 leading-tight line-clamp-2"
            data-testid="container-description"
            title={briefDescription}
          >
            {briefDescription}
          </div>
        )}

        {/* Node count badge */}
        {nodeCount > 0 && (
          <div
            className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"
            data-testid="container-node-count"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: effectiveColor }} />
            <span>
              {nodeCount} node{nodeCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Live Mini-Preview or LOD Fallback — entire area is clickable for dive-in */}
        <div
          className="mb-2 cursor-pointer rounded-md overflow-hidden relative"
          style={{ border: `1px solid ${effectiveColor}20` }}
          onClick={handleDiveIn}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDiveIn();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open ${childFileName} canvas`}
          title="Click to dive into nested canvas"
          data-testid="container-preview-area"
        >
          {/* Refreshing overlay — shown when re-fetching after arg change */}
          {childRefreshing && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-md"
              style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
              data-testid="preview-refreshing"
            >
              <div className="flex flex-col items-center gap-1">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: effectiveColor }} />
                <span className="text-[9px] font-medium" style={{ color: effectiveColor }}>
                  Refreshing…
                </span>
              </div>
            </div>
          )}
          {isLodMode ? (
            <LodPreviewFallback
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              color={effectiveColor}
              nodeCount={nodeCount}
            />
          ) : childLoading ? (
            <PreviewSkeleton
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              color={effectiveColor}
            />
          ) : childError ? (
            <ErrorPreview
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              color={effectiveColor}
              error={childError}
            />
          ) : childGraph && childGraph.nodes.length > 0 ? (
            <MiniCanvasPreview
              nodes={childGraph.nodes}
              edges={childGraph.edges}
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              showLabels={parentZoom > 0.6}
            />
          ) : (
            <LodPreviewFallback
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              color={effectiveColor}
              nodeCount={nodeCount}
            />
          )}
        </div>

        {/* Dive-in affordance button */}
        <div
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors"
          style={{
            backgroundColor: `${effectiveColor}15`,
            color: effectiveColor,
            border: `1px solid ${effectiveColor}30`,
          }}
          onClick={handleDiveIn}
          data-testid="container-dive-in"
          title="Open nested canvas"
        >
          <span>Open Canvas</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Badges (footer) */}
      <NodeBadges
        noteCount={nodeData.noteCount}
        pendingSuggestionCount={nodeData.pendingSuggestionCount}
        codeRefCount={nodeData.codeRefCount}
        className="px-3 py-1.5"
        dividerColor={`${effectiveColor}20`}
      />
    </div>
  );
}

export const ContainerNode = memo(ContainerNodeComponent);

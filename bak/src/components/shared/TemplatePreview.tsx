/**
 * TemplatePreview - Modal preview of a template before loading it.
 *
 * Shows a read-only React Flow mini-canvas with ELK auto-layout alongside
 * template details (description, node types used, domain tags).
 * Users can confirm loading with "Use Template" or close the preview.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, Loader2, ChevronRight, Box } from 'lucide-react';
import { parse as parseYaml } from 'yaml';
import { instantiateStack, type StackTemplate } from '@/stacks/stackLoader';
import { computeElkLayout } from '@/core/layout/elkLayout';
import { nodeTypes } from '@/components/nodes/nodeTypeMap';
import { edgeTypes } from '@/components/edges/edgeTypeMap';
import type { TemplateRecord } from '@/templates/types';
import type { ArchGraph, ArchNode } from '@/types/graph';
import type { CanvasNode, CanvasNodeData, CanvasEdge, CanvasEdgeData } from '@/types/canvas';
import { protoToGraph } from '@/core/storage/fileIO';
import { Architecture } from '@/proto/archcanvas';

interface TemplatePreviewProps {
  record: TemplateRecord;
  onUseTemplate: () => void;
  onClose: () => void;
}

/** Minimal render: ArchNode → CanvasNode (no registry needed for preview). */
function archNodeToCanvas(node: ArchNode): CanvasNode {
  const namespace = node.type.split('/')[0];
  let nodeType = 'generic';

  // Simplified shape mapping for preview (subset of RenderApi logic)
  switch (namespace) {
    case 'data': {
      const name = node.type.split('/')[1];
      if (
        name === 'database' ||
        name === 'cache' ||
        name === 'object-storage' ||
        name === 'repository'
      )
        nodeType = name;
      break;
    }
    case 'messaging': {
      const name = node.type.split('/')[1];
      if (name === 'message-queue') nodeType = 'queue';
      else if (name === 'event-bus') nodeType = 'event-bus';
      else if (name === 'stream-processor') nodeType = 'stream-processor';
      break;
    }
    case 'compute': {
      const name = node.type.split('/')[1];
      if (name === 'api-gateway') nodeType = 'gateway';
      break;
    }
    case 'network': {
      const name = node.type.split('/')[1];
      if (name === 'load-balancer') nodeType = 'gateway';
      else if (name === 'cdn') nodeType = 'cdn';
      break;
    }
    case 'observability': {
      const name = node.type.split('/')[1];
      if (name === 'logging') nodeType = 'logging';
      break;
    }
  }

  const data: CanvasNodeData = {
    archNodeId: node.id,
    displayName: node.displayName,
    nodedefType: node.type,
    args: { ...node.args },
    ports: { inbound: [], outbound: [] },
    hasChildren: node.children.length > 0,
    noteCount: 0,
    codeRefCount: 0,
    properties: {},
    icon: 'Box',
  };

  return {
    id: node.id,
    type: nodeType,
    position: { x: node.position.x, y: node.position.y },
    data,
  };
}

/** Minimal render: ArchEdge → CanvasEdge. */
function archEdgeToCanvas(edge: ArchGraph['edges'][number]): CanvasEdge {
  const typeMap: Record<string, string> = {
    sync: 'sync',
    async: 'async',
    'data-flow': 'dataFlow',
  };

  const data: CanvasEdgeData = {
    archEdgeId: edge.id,
    edgeType: edge.type,
    label: edge.label,
    noteCount: 0,
  };

  return {
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    type: typeMap[edge.type] || 'sync',
    label: edge.label,
    data,
  };
}

/** Count unique node types in the graph. */
function getNodeTypeCounts(graph: ArchGraph): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    counts.set(node.type, (counts.get(node.type) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/** Extract a readable short name from a node type like "compute/service" → "Service". */
function shortTypeName(type: string): string {
  const parts = type.split('/');
  const name = parts[parts.length - 1] ?? type;
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function TemplatePreview({ record, onUseTemplate, onClose }: TemplatePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<CanvasEdge[]>([]);
  const [graph, setGraph] = useState<ArchGraph | null>(null);

  // Parse and layout the template
  useEffect(() => {
    let cancelled = false;

    async function preparePreview() {
      setLoading(true);

      try {
        // Parse template data
        let archGraph: ArchGraph;
        if (typeof record.data === 'string') {
          const parsed = parseYaml(record.data) as {
            metadata: StackTemplate['metadata'];
            nodes: StackTemplate['nodes'];
            edges: StackTemplate['edges'];
          };
          const stack: StackTemplate = {
            metadata: parsed.metadata,
            nodes: parsed.nodes || [],
            edges: parsed.edges || [],
          };
          archGraph = instantiateStack(stack);
        } else {
          // Imported template: decode Architecture proto bytes
          try {
            const archProto = Architecture.decode(record.data);
            archGraph = protoToGraph({ architecture: archProto });
          } catch (err) {
            console.error('[TemplatePreview] Failed to decode imported template:', err);
            if (!cancelled) setLoading(false);
            return;
          }
        }
        if (cancelled) return;

        // Apply ELK layout
        const layoutResult = await computeElkLayout(archGraph.nodes, archGraph.edges, 'horizontal');
        if (cancelled) return;

        // Apply layout positions
        const layoutNodes = archGraph.nodes.map((node) => {
          const pos = layoutResult.positions.get(node.id);
          if (pos) {
            return { ...node, position: { ...node.position, x: pos.x, y: pos.y } };
          }
          return node;
        });

        const layoutGraph: ArchGraph = { ...archGraph, nodes: layoutNodes };

        // Convert to React Flow nodes/edges
        const rfNodes = layoutNodes.map(archNodeToCanvas);
        const rfEdges = archGraph.edges.map(archEdgeToCanvas);

        if (!cancelled) {
          setGraph(layoutGraph);
          setCanvasNodes(rfNodes);
          setCanvasEdges(rfEdges);
          setLoading(false);
        }
      } catch (err) {
        console.error('[TemplatePreview] Error preparing preview:', err);
        if (!cancelled) setLoading(false);
      }
    }

    preparePreview();
    return () => {
      cancelled = true;
    };
  }, [record]);

  // Node type breakdown
  const nodeTypeCounts = useMemo(() => {
    if (!graph) return [];
    return getNodeTypeCounts(graph);
  }, [graph]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const tags = record.metadata.tags ?? [record.metadata.category];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      data-testid="template-preview-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg shadow-2xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col"
        data-testid="template-preview-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] truncate">
            {record.metadata.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Close template preview"
            data-testid="template-preview-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: canvas + sidebar */}
        <div className="flex-1 flex min-h-0">
          {/* Preview canvas area */}
          <div
            className="flex-1 min-w-0 relative bg-[hsl(var(--muted)/0.2)]"
            data-testid="template-preview-canvas"
          >
            {loading ? (
              <div
                className="absolute inset-0 flex items-center justify-center"
                data-testid="template-preview-loading"
              >
                <div className="flex flex-col items-center gap-2 text-[hsl(var(--muted-foreground))]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm">Preparing preview...</span>
                </div>
              </div>
            ) : (
              <ReactFlowProvider>
                <PreviewCanvas nodes={canvasNodes} edges={canvasEdges} />
              </ReactFlowProvider>
            )}
          </div>

          {/* Detail sidebar */}
          <div
            className="w-[260px] shrink-0 border-l border-[hsl(var(--border))] overflow-y-auto p-4 flex flex-col gap-4"
            data-testid="template-preview-sidebar"
          >
            {/* Description */}
            <div>
              <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
                Description
              </h3>
              <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">
                {record.metadata.description}
              </p>
            </div>

            {/* Stats */}
            <div>
              <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
                Statistics
              </h3>
              <div className="flex gap-3">
                <div className="px-2.5 py-1.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                  {record.metadata.nodeCount} nodes
                </div>
                <div className="px-2.5 py-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium">
                  {record.metadata.edgeCount} edges
                </div>
              </div>
            </div>

            {/* Node types used */}
            <div>
              <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
                Node Types ({nodeTypeCounts.length})
              </h3>
              <div className="space-y-1">
                {nodeTypeCounts.map(({ type, count }) => (
                  <div
                    key={type}
                    className="flex items-center gap-2 text-xs text-[hsl(var(--foreground))]"
                    data-testid={`template-preview-nodetype-${type}`}
                  >
                    <Box className="w-3 h-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                    <span className="truncate flex-1">{shortTypeName(type)}</span>
                    <span className="text-[hsl(var(--muted-foreground))] tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium"
                    data-testid={`template-preview-tag-${tag}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[hsl(var(--border))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            data-testid="template-preview-cancel"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onUseTemplate}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 font-medium"
            data-testid="template-preview-use"
          >
            Use Template
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Read-only React Flow preview canvas with fitView. */
function PreviewCanvas({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      preventScrolling={false}
      proOptions={{ hideAttribution: true }}
      data-testid="template-preview-reactflow"
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
    </ReactFlow>
  );
}

/**
 * useCanvasRenderer - Manages the render pipeline from RenderApi to React Flow state.
 * Handles: RenderApi.render() call, local rfNodes/rfEdges state, selection sync,
 * node count monitoring, and React Flow change handlers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react';
import { useGraphStore } from '@/store/graphStore';
import { useEngineStore } from '@/store/engineStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import { NODE_COUNT_WARNING } from '@/hooks/useCanvasPerformance';
import type { CanvasNode, CanvasEdge } from '@/types/canvas';
import type { CanvasPerformanceState } from '@/hooks/useCanvasPerformance';

export function useCanvasRenderer(perf: CanvasPerformanceState) {
  const graph = useGraphStore((s) => s.graph);
  const renderApi = useEngineStore((s) => s.renderApi);
  const navigationPath = useNavigationStore((s) => s.path);
  const showToast = useUIStore((s) => s.showToast);

  // Render the graph through RenderApi
  const rendered = useMemo(() => {
    if (!renderApi) return { nodes: [] as CanvasNode[], edges: [] as CanvasEdge[] };
    return renderApi.render(graph, navigationPath);
  }, [graph, renderApi, navigationPath]);

  // Local React Flow state
  const [rfNodes, setRfNodes] = useState<CanvasNode[]>(rendered.nodes);
  const [rfEdges, setRfEdges] = useState<CanvasEdge[]>(rendered.edges);

  // Monitor node count for performance warnings
  const nodeCountWarningShownRef = useRef(false);
  useEffect(() => {
    perf.setNodeCount(rendered.nodes.length);
    if (rendered.nodes.length > NODE_COUNT_WARNING && !nodeCountWarningShownRef.current) {
      nodeCountWarningShownRef.current = true;
      showToast(
        `${rendered.nodes.length} nodes visible — consider grouping nodes for better performance.`,
        6000,
      );
    } else if (rendered.nodes.length <= NODE_COUNT_WARNING) {
      nodeCountWarningShownRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered.nodes.length, perf.setNodeCount, showToast]);

  // Sync rendered → rfNodes/rfEdges (preserve selection)
  useEffect(() => {
    setRfNodes((prevNodes) => {
      const selectedIds = new Set(prevNodes.filter((n) => n.selected).map((n) => n.id));
      if (selectedIds.size === 0) return rendered.nodes;
      return rendered.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, selected: true } : n));
    });
    setRfEdges(rendered.edges);
  }, [rendered]);

  // Sync multi-selection from store → rfNodes
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds);

  useEffect(() => {
    const nodeIdSet = new Set(selectedNodeIds);
    setRfNodes((prevNodes) =>
      prevNodes.map((n) => {
        const shouldBeSelected = nodeIdSet.has(n.id);
        if (n.selected === shouldBeSelected) return n;
        return { ...n, selected: shouldBeSelected };
      }),
    );
  }, [selectedNodeIds]);

  useEffect(() => {
    const edgeIdSet = new Set(selectedEdgeIds);
    setRfEdges((prevEdges) =>
      prevEdges.map((e) => {
        const shouldBeSelected = edgeIdSet.has(e.id);
        if (e.selected === shouldBeSelected) return e;
        return { ...e, selected: shouldBeSelected };
      }),
    );
  }, [selectedEdgeIds]);

  // React Flow change handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds) as CanvasNode[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds) as CanvasEdge[]);
  }, []);

  return {
    rfNodes,
    rfEdges,
    onNodesChange,
    onEdgesChange,
    rendered,
  };
}

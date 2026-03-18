import { useState, useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useNavigationStore } from '@/store/navigationStore';
import { computeFitViewport } from '@/lib/computeFitViewport';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CapturedNode {
  id: string;
  rect: DOMRect;
  label: string;
  color: string;
}

interface CapturedEdge {
  sourceId: string;
  targetId: string;
}

export interface TransitionData {
  direction: 'in' | 'out' | 'dissolve';
  /** Where clones START (mini-node rects for dive-in, full-size rects for go-up) */
  sourceNodes: CapturedNode[];
  /** Where clones END (full-size rects for dive-in, mini-node rects for go-up) */
  targetNodes: CapturedNode[];
  /** Edges connecting animated nodes */
  edges: CapturedEdge[];
  /** Container rect at source phase */
  containerRect: DOMRect | null;
  /** Container rect at target phase (for go-up: where nodes shrink to) */
  targetContainerRect: DOMRect | null;
  /** Sibling nodes (for fade-out on dive-in, fade-in on go-up) */
  siblings: CapturedNode[];
  /** The canvas ID we're transitioning FROM */
  fromCanvasId: string;
  /** The canvas ID we're transitioning TO */
  toCanvasId: string;
  /** True when the second phase data (targets) has been provided */
  targetsReady: boolean;
  /** Callback to finalize the transition (called on animation end) */
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNavigationTransition() {
  const reactFlow = useReactFlow();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionData, setTransitionData] = useState<TransitionData | null>(null);
  const transitioningRef = useRef(false);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Read current screen rect for a ReactFlow node element */
  const getNodeRect = (nodeId: string): DOMRect | null => {
    const el = document.querySelector(`[data-id="${nodeId}"]`);
    return el ? el.getBoundingClientRect() : null;
  };

  /** Find the main canvas ReactFlow container (excludes mini ReactFlow in previews) */
  const getMainFlowContainer = (): Element | null => {
    const allFlows = document.querySelectorAll('.react-flow');
    for (const flow of allFlows) {
      if (!flow.closest('.subsystem-preview')) return flow;
    }
    return null;
  };

  /** Capture all visible node positions from the DOM, scoped to a container */
  const captureVisibleNodes = (container?: Element | null): CapturedNode[] => {
    const root = container ?? document;
    const nodes: CapturedNode[] = [];
    root.querySelectorAll('.react-flow__node').forEach((el) => {
      const id = el.getAttribute('data-id');
      if (!id || id.startsWith('__ghost__')) return;
      const rect = el.getBoundingClientRect();
      const nameEl = el.querySelector('.arch-node-header-name');
      nodes.push({
        id,
        rect,
        label: nameEl?.textContent ?? id,
        color: 'var(--color-node-border)',
      });
    });
    return nodes;
  };

  /** Capture visible edges, scoped to a container */
  const captureVisibleEdges = (container?: Element | null): CapturedEdge[] => {
    const root = container ?? document;
    const edges: CapturedEdge[] = [];
    root.querySelectorAll('.react-flow__edge').forEach((el) => {
      const id = el.getAttribute('data-testid') ?? el.id ?? '';
      const parts = id.replace('rf__edge-', '').split('-');
      if (parts.length >= 2) {
        edges.push({ sourceId: parts[0], targetId: parts[1] });
      }
    });
    return edges;
  };

  /** Compute fitted screen rects for target nodes using viewport math */
  const computeTargetRects = (rfNodes: { id: string; position: { x: number; y: number }; width?: number; height?: number; data?: { node: { displayName?: string; id: string } } }[]): CapturedNode[] => {
    const mainFlow = getMainFlowContainer();
    if (!mainFlow) return [];
    const vpRect = mainFlow.getBoundingClientRect();

    const fitNodes = rfNodes.map((n) => ({
      x: n.position.x,
      y: n.position.y,
      width: n.width ?? 150,
      height: n.height ?? 40,
    }));

    const { nodeScreenRects } = computeFitViewport({
      nodes: fitNodes,
      viewportWidth: vpRect.width,
      viewportHeight: vpRect.height,
    });

    return rfNodes.map((n, i) => ({
      id: n.id,
      rect: new DOMRect(
        vpRect.left + nodeScreenRects[i].x,
        vpRect.top + nodeScreenRects[i].y,
        nodeScreenRects[i].width,
        nodeScreenRects[i].height,
      ),
      label: n.data?.node?.displayName ?? n.data?.node?.id ?? n.id,
      color: 'var(--color-node-border)',
    }));
  };

  /** Set the viewport to the fitted position while overlay is still opaque */
  const setFittedViewport = () => {
    const mainFlowEl = getMainFlowContainer();
    if (!mainFlowEl) return;
    const rfNodes = reactFlow.getNodes();
    const vpRect = mainFlowEl.getBoundingClientRect();
    const fitNodes = rfNodes.map((n) => ({
      x: n.position.x,
      y: n.position.y,
      width: n.width ?? 150,
      height: n.height ?? 40,
    }));
    const { zoom, offsetX, offsetY } = computeFitViewport({
      nodes: fitNodes,
      viewportWidth: vpRect.width,
      viewportHeight: vpRect.height,
    });
    reactFlow.setViewport({ x: offsetX, y: offsetY, zoom });
  };

  /** Shared finalize callback — no fitView needed, viewport already set */
  const finalize = useCallback(() => {
    setTransitionData(null);
    setIsTransitioning(false);
    transitioningRef.current = false;
  }, []);

  // -----------------------------------------------------------------------
  // Dive In
  // -----------------------------------------------------------------------

  const diveIn = useCallback((refNodeId: string) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    const currentCanvasId = useNavigationStore.getState().currentCanvasId;
    const containerRect = getNodeRect(refNodeId);

    // Capture source: mini-node rects from the RefNode's mini ReactFlow
    const miniContainer = document.querySelector(`[data-id="${refNodeId}"] .react-flow`);
    const sourceNodes = captureVisibleNodes(miniContainer);

    // Capture siblings (all main canvas nodes except the target container)
    const mainFlow = getMainFlowContainer();
    const allNodes = captureVisibleNodes(mainFlow);
    const siblings = allNodes.filter((n) => n.id !== refNodeId);

    // Phase 1: Mount overlay with clones at mini-node positions
    setIsTransitioning(true);
    setTransitionData({
      direction: 'in',
      sourceNodes,
      targetNodes: [],
      edges: [],
      containerRect: containerRect ?? null,
      targetContainerRect: null,
      siblings,
      fromCanvasId: currentCanvasId,
      toCanvasId: refNodeId,
      targetsReady: false,
      onComplete: finalize,
    });

    // Switch canvas behind the overlay
    useNavigationStore.getState().diveIn(refNodeId);

    // Phase 2: Compute fitted viewport and set target positions
    requestAnimationFrame(() => {
      const rfNodes = reactFlow.getNodes();
      const targetNodes = computeTargetRects(rfNodes);
      const edges = captureVisibleEdges(mainFlow);

      // Set viewport to fitted position while overlay is still opaque
      setFittedViewport();

      setTransitionData((prev) =>
        prev ? { ...prev, targetNodes, edges, targetsReady: true } : null,
      );
    });
  }, [finalize, reactFlow]);

  // -----------------------------------------------------------------------
  // Go Up (reverse morph)
  // -----------------------------------------------------------------------

  const goUp = useCallback(() => {
    if (transitioningRef.current) return;
    const nav = useNavigationStore.getState();
    if (nav.breadcrumb.length <= 1) return;
    transitioningRef.current = true;

    const fromCanvasId = nav.currentCanvasId;

    // Capture source: full-size nodes from the current (child) canvas
    const mainFlow = getMainFlowContainer();
    const sourceNodes = captureVisibleNodes(mainFlow);
    const edges = captureVisibleEdges(mainFlow);

    // Phase 1: Mount overlay with full-size clones
    setIsTransitioning(true);
    setTransitionData({
      direction: 'out',
      sourceNodes,
      targetNodes: [],
      edges,
      containerRect: null,
      targetContainerRect: null,
      siblings: [],
      fromCanvasId,
      toCanvasId: '',
      targetsReady: false,
      onComplete: finalize,
    });

    // Switch canvas behind the overlay
    nav.goUp();

    // Phase 2: After parent canvas renders, capture target positions
    requestAnimationFrame(() => {
      const toCanvasId = useNavigationStore.getState().currentCanvasId;
      const targetContainerRect = getNodeRect(fromCanvasId);

      // Target: mini-node rects from the parent's RefNode mini ReactFlow
      const miniContainer = document.querySelector(`[data-id="${fromCanvasId}"] .react-flow`);
      const targetNodes = captureVisibleNodes(miniContainer);

      // Siblings: all parent canvas nodes except the container we came from
      const mainFlowEl = getMainFlowContainer();
      const parentNodes = captureVisibleNodes(mainFlowEl);
      const siblings = parentNodes.filter((n) => n.id !== fromCanvasId);

      // Set viewport to fitted position for the parent canvas
      setFittedViewport();

      setTransitionData((prev) =>
        prev
          ? { ...prev, targetNodes, targetContainerRect: targetContainerRect ?? null, siblings, toCanvasId, targetsReady: true }
          : null,
      );
    });
  }, [finalize, reactFlow]);

  // -----------------------------------------------------------------------
  // Breadcrumb Jump (dissolve) — unchanged logic, updated field names
  // -----------------------------------------------------------------------

  const goToBreadcrumb = useCallback((index: number) => {
    if (transitioningRef.current) return;
    const nav = useNavigationStore.getState();
    const fromCanvasId = nav.currentCanvasId;
    const target = nav.breadcrumb[index];
    if (!target) return;
    transitioningRef.current = true;

    setIsTransitioning(true);

    setTransitionData({
      direction: 'dissolve',
      sourceNodes: [],
      targetNodes: [],
      edges: [],
      containerRect: null,
      targetContainerRect: null,
      siblings: [],
      fromCanvasId,
      toCanvasId: target.canvasId,
      targetsReady: true,
      onComplete: finalize,
    });

    // Perform navigation after overlay renders
    requestAnimationFrame(() => {
      nav.goToBreadcrumb(index);
    });
  }, [finalize]);

  return {
    diveIn,
    goUp,
    goToBreadcrumb,
    isTransitioning,
    transitionData,
  };
}

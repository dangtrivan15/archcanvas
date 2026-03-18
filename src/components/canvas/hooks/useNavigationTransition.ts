import { useState, useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useNavigationStore } from '@/store/navigationStore';

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

  /** Capture all visible node positions from the DOM */
  const captureVisibleNodes = (): CapturedNode[] => {
    const nodes: CapturedNode[] = [];
    document.querySelectorAll('.react-flow__node').forEach((el) => {
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

  /** Capture visible edges */
  const captureVisibleEdges = (): CapturedEdge[] => {
    const edges: CapturedEdge[] = [];
    document.querySelectorAll('.react-flow__edge').forEach((el) => {
      const id = el.getAttribute('data-testid') ?? el.id ?? '';
      const parts = id.replace('rf__edge-', '').split('-');
      if (parts.length >= 2) {
        edges.push({ sourceId: parts[0], targetId: parts[1] });
      }
    });
    return edges;
  };

  /** Capture mini-node screen positions from a SubsystemPreview SVG */
  const captureMiniNodes = (refNodeId: string): CapturedNode[] => {
    const container = document.querySelector(`[data-id="${refNodeId}"]`);
    const svg = container?.querySelector('.subsystem-preview');
    if (!svg) return [];

    const nodes: CapturedNode[] = [];
    svg.querySelectorAll('g[data-node-id]').forEach((g) => {
      const id = g.getAttribute('data-node-id')!;
      const rect = g.querySelector('rect');
      if (!rect) return;
      const screenRect = rect.getBoundingClientRect();
      const text = g.querySelector('text')?.textContent ?? id;
      const fill = rect.getAttribute('fill') ?? '';
      nodes.push({ id, rect: screenRect, label: text, color: fill });
    });
    return nodes;
  };

  /** Shared finalize callback */
  const finalize = useCallback(() => {
    setTransitionData(null);
    setIsTransitioning(false);
    transitioningRef.current = false;
    requestAnimationFrame(() => {
      reactFlow.fitView({ duration: 300 });
    });
  }, [reactFlow]);

  // -----------------------------------------------------------------------
  // Dive In
  // -----------------------------------------------------------------------

  const diveIn = useCallback((refNodeId: string) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    const currentCanvasId = useNavigationStore.getState().currentCanvasId;
    const containerRect = getNodeRect(refNodeId);

    // Capture source positions: mini-nodes from the SubsystemPreview SVG
    const sourceNodes = captureMiniNodes(refNodeId);

    // Capture siblings (all nodes except the target container)
    const allNodes = captureVisibleNodes();
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

    // Switch canvas behind the overlay (batched with above in same React commit)
    useNavigationStore.getState().diveIn(refNodeId);

    // Phase 2: After ReactFlow renders the new canvas, capture target positions
    requestAnimationFrame(() => {
      const targetNodes = captureVisibleNodes();
      const edges = captureVisibleEdges();

      setTransitionData((prev) =>
        prev ? { ...prev, targetNodes, edges, targetsReady: true } : null,
      );
    });
  }, [finalize]);

  // -----------------------------------------------------------------------
  // Go Up (reverse morph)
  // -----------------------------------------------------------------------

  const goUp = useCallback(() => {
    if (transitioningRef.current) return;
    const nav = useNavigationStore.getState();
    if (nav.breadcrumb.length <= 1) return;
    transitioningRef.current = true;

    const fromCanvasId = nav.currentCanvasId;

    // Capture source positions: full-size nodes from the current canvas
    const sourceNodes = captureVisibleNodes();
    const edges = captureVisibleEdges();

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
      const targetNodes = captureMiniNodes(fromCanvasId);
      const parentNodes = captureVisibleNodes();
      const siblings = parentNodes.filter((n) => n.id !== fromCanvasId);

      setTransitionData((prev) =>
        prev
          ? { ...prev, targetNodes, targetContainerRect: targetContainerRect ?? null, siblings, toCanvasId, targetsReady: true }
          : null,
      );
    });
  }, [finalize]);

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

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
  /** Captured positions of nodes being animated */
  nodes: CapturedNode[];
  /** Edges connecting captured nodes */
  edges: CapturedEdge[];
  /** Bounding rect of the container being morphed (dive-in: the ref-node rect) */
  containerRect: DOMRect | null;
  /** Sibling nodes (for fade-out on dive-in, fade-in on go-up) */
  siblings: CapturedNode[];
  /** The canvas ID we're transitioning FROM */
  fromCanvasId: string;
  /** The canvas ID we're transitioning TO */
  toCanvasId: string;
  /** Callback to finalize the transition (called on animation end) */
  onComplete: () => void;
}

const TRANSITION_DURATION = 350; // ms

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNavigationTransition() {
  const reactFlow = useReactFlow();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionData, setTransitionData] = useState<TransitionData | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      // ReactFlow edge IDs are typically "source-target"
      const parts = id.replace('rf__edge-', '').split('-');
      if (parts.length >= 2) {
        edges.push({ sourceId: parts[0], targetId: parts[1] });
      }
    });
    return edges;
  };

  // -----------------------------------------------------------------------
  // Dive In
  // -----------------------------------------------------------------------

  const diveIn = useCallback((refNodeId: string) => {
    if (isTransitioning) return;

    const currentCanvasId = useNavigationStore.getState().currentCanvasId;
    const containerRect = getNodeRect(refNodeId);

    // Capture siblings (all nodes except the target)
    const allNodes = captureVisibleNodes();
    const siblings = allNodes.filter((n) => n.id !== refNodeId);

    // Now switch the canvas (behind the overlay)
    setIsTransitioning(true);

    const finalize = () => {
      setTransitionData(null);
      setIsTransitioning(false);
      requestAnimationFrame(() => {
        reactFlow.fitView({ duration: 300 });
      });
    };

    // Perform the actual navigation
    useNavigationStore.getState().diveIn(refNodeId);

    // After the canvas switches, read child node positions for morph targets
    // We need a frame for ReactFlow to render the new canvas
    requestAnimationFrame(() => {
      const childNodes = captureVisibleNodes();
      const childEdges = captureVisibleEdges();

      setTransitionData({
        direction: 'in',
        nodes: childNodes,
        edges: childEdges,
        containerRect: containerRect ?? null,
        siblings,
        fromCanvasId: currentCanvasId,
        toCanvasId: refNodeId,
        onComplete: finalize,
      });

      // Safety timeout in case transitionend doesn't fire
      timeoutRef.current = setTimeout(finalize, TRANSITION_DURATION + 100);
    });
  }, [isTransitioning, reactFlow]);

  // -----------------------------------------------------------------------
  // Go Up (reverse morph)
  // -----------------------------------------------------------------------

  const goUp = useCallback(() => {
    if (isTransitioning) return;
    const nav = useNavigationStore.getState();
    if (nav.breadcrumb.length <= 1) return;

    const fromCanvasId = nav.currentCanvasId;

    // Capture current full-sized nodes
    const currentNodes = captureVisibleNodes();
    const currentEdges = captureVisibleEdges();

    setIsTransitioning(true);

    const finalize = () => {
      setTransitionData(null);
      setIsTransitioning(false);
      requestAnimationFrame(() => {
        reactFlow.fitView({ duration: 300 });
      });
    };

    // Perform navigation
    nav.goUp();

    // After canvas switch, find the ref-node in the parent to get the container rect
    requestAnimationFrame(() => {
      const containerRect = getNodeRect(fromCanvasId);
      const parentNodes = captureVisibleNodes();
      const siblings = parentNodes.filter((n) => n.id !== fromCanvasId);

      setTransitionData({
        direction: 'out',
        nodes: currentNodes,
        edges: currentEdges,
        containerRect: containerRect ?? null,
        siblings,
        fromCanvasId,
        toCanvasId: nav.currentCanvasId,
        onComplete: finalize,
      });

      timeoutRef.current = setTimeout(finalize, TRANSITION_DURATION + 100);
    });
  }, [isTransitioning, reactFlow]);

  // -----------------------------------------------------------------------
  // Breadcrumb Jump (dissolve)
  // -----------------------------------------------------------------------

  const goToBreadcrumb = useCallback((index: number) => {
    if (isTransitioning) return;
    const nav = useNavigationStore.getState();
    const fromCanvasId = nav.currentCanvasId;
    const target = nav.breadcrumb[index];
    if (!target) return;

    setIsTransitioning(true);

    const finalize = () => {
      setTransitionData(null);
      setIsTransitioning(false);
      requestAnimationFrame(() => {
        reactFlow.fitView({ duration: 300 });
      });
    };

    setTransitionData({
      direction: 'dissolve',
      nodes: [],
      edges: [],
      containerRect: null,
      siblings: [],
      fromCanvasId,
      toCanvasId: target.canvasId,
      onComplete: finalize,
    });

    // Perform navigation after overlay renders
    requestAnimationFrame(() => {
      nav.goToBreadcrumb(index);
    });

    timeoutRef.current = setTimeout(finalize, TRANSITION_DURATION + 100);
  }, [isTransitioning, reactFlow]);

  return {
    diveIn,
    goUp,
    goToBreadcrumb,
    isTransitioning,
    transitionData,
  };
}

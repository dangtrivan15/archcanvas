import { useState, useCallback, useRef, type CSSProperties } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useNavigationStore } from '@/store/navigationStore';
import { computeZoomToRect } from '@/lib/computeZoomToRect';
import { computeMatchedViewport } from '@/lib/computeMatchedViewport';
import { computeFitViewport } from '@/lib/computeFitViewport';
import { animateViewport, easeInOut } from '@/lib/animateViewport';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE1_DURATION = 200; // ms
const PHASE2_DURATION = 250; // ms
const DISSOLVE_DURATION = 350; // ms

type TransitionState = 'idle' | 'zooming_in' | 'switching' | 'zooming_out';

interface ContainerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Overlay style factory
// ---------------------------------------------------------------------------

const COVER_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  backgroundColor: 'var(--color-background)',
  opacity: 1,
  pointerEvents: 'none',
};

function dissolveStyle(opacity: number): CSSProperties {
  return {
    ...COVER_STYLE,
    opacity,
    transition: `opacity ${DISSOLVE_DURATION}ms ease-out`,
  };
}

// ---------------------------------------------------------------------------
// Helper: get viewport dimensions from main ReactFlow container
// ---------------------------------------------------------------------------

function getViewportDimensions() {
  const el = document.querySelector('.react-flow:not(.subsystem-preview .react-flow)');
  if (!el) return { width: window.innerWidth, height: window.innerHeight };
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

// ---------------------------------------------------------------------------
// Helper: build FitNode array from ReactFlow nodes
// ---------------------------------------------------------------------------

function toFitNodes(rfNodes: Array<{ position: { x: number; y: number }; width?: number | null; height?: number | null }>) {
  return rfNodes.map((n) => ({
    x: n.position.x,
    y: n.position.y,
    width: n.width ?? 150,
    height: n.height ?? 40,
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNavigationTransition() {
  const reactFlow = useReactFlow();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties | null>(null);
  const stateRef = useRef<TransitionState>('idle');
  const cancelRef = useRef<(() => void) | null>(null);
  // Store the container's measured rect during dive-in so go-up can use it.
  // We capture from reactFlow.getNode() which has measured pixel dimensions.
  // Reading from fileStore wouldn't work — Position.width/height are optional
  // YAML fields, not ReactFlow's measured dimensions.
  const lastContainerRectRef = useRef<ContainerRect | null>(null);

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const reset = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    stateRef.current = 'idle';
    setIsTransitioning(false);
    setOverlayStyle(null);
  }, []);

  // -----------------------------------------------------------------------
  // Dissolve helpers (fallback + breadcrumb)
  // -----------------------------------------------------------------------

  // Dissolve helpers use double-rAF to ensure the browser paints opacity:1
  // before we set opacity:0 — required for the CSS transition to fire.
  // A safety timeout guarantees reset even if onTransitionEnd never fires
  // (possible under React 19 concurrent rendering or if element unmounts).

  const startDissolveOut = useCallback(() => {
    // Double rAF: first ensures React commits opacity:1, second triggers opacity:0
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOverlayStyle(dissolveStyle(0));
        // Safety: reset after duration + buffer, in case onTransitionEnd doesn't fire
        setTimeout(() => {
          if (stateRef.current === 'switching') reset();
        }, DISSOLVE_DURATION + 50);
      });
    });
  }, [reset]);

  const goToBreadcrumbDissolve = useCallback((refNodeId: string) => {
    stateRef.current = 'switching';
    setIsTransitioning(true);
    setOverlayStyle(dissolveStyle(1));

    requestAnimationFrame(() => {
      useNavigationStore.getState().diveIn(refNodeId);
      reactFlow.fitView({ duration: 0 });
      startDissolveOut();
    });
  }, [reactFlow, startDissolveOut]);

  const dissolveUp = useCallback(() => {
    stateRef.current = 'switching';
    setIsTransitioning(true);
    setOverlayStyle(dissolveStyle(1));

    requestAnimationFrame(() => {
      useNavigationStore.getState().goUp();
      reactFlow.fitView({ duration: 0 });
      startDissolveOut();
    });
  }, [reactFlow, startDissolveOut]);

  // -----------------------------------------------------------------------
  // Dive In
  // -----------------------------------------------------------------------

  const diveIn = useCallback((refNodeId: string) => {
    if (stateRef.current !== 'idle') return;

    // Capture state before anything changes
    const currentViewport = reactFlow.getViewport();
    const containerNode = reactFlow.getNode(refNodeId);
    if (!containerNode?.width || !containerNode?.height) {
      // Unmeasured — fall back to dissolve
      goToBreadcrumbDissolve(refNodeId);
      return;
    }

    const containerRect: ContainerRect = {
      x: containerNode.position.x,
      y: containerNode.position.y,
      width: containerNode.width,
      height: containerNode.height,
    };

    // Store for go-up to use later
    lastContainerRectRef.current = containerRect;

    const { width: vpW, height: vpH } = getViewportDimensions();
    const zoomedViewport = computeZoomToRect(containerRect, vpW, vpH);

    stateRef.current = 'zooming_in';
    setIsTransitioning(true);

    // Phase 1: zoom into container
    cancelRef.current = animateViewport(
      reactFlow, currentViewport, zoomedViewport, PHASE1_DURATION, easeInOut, () => {
        // Switch point
        stateRef.current = 'switching';
        setOverlayStyle(COVER_STYLE); // 1-frame cover

        useNavigationStore.getState().diveIn(refNodeId);

        // Next frame: React has rendered child nodes
        requestAnimationFrame(() => {
          const childRfNodes = reactFlow.getNodes();
          const childFitNodes = toFitNodes(childRfNodes);
          const matchedVp = computeMatchedViewport(childFitNodes, containerRect, vpW, vpH);
          reactFlow.setViewport(matchedVp);
          setOverlayStyle(null); // hide cover

          const fittedVp = computeFitViewport({
            nodes: childFitNodes,
            viewportWidth: vpW,
            viewportHeight: vpH,
          });
          const fittedViewport = { x: fittedVp.offsetX, y: fittedVp.offsetY, zoom: fittedVp.zoom };

          stateRef.current = 'zooming_out';

          // Phase 2: zoom out to fitted
          cancelRef.current = animateViewport(
            reactFlow, matchedVp, fittedViewport, PHASE2_DURATION, easeInOut, () => {
              reset();
            },
          );
        });
      },
    );
  }, [reactFlow, reset, goToBreadcrumbDissolve]);

  // -----------------------------------------------------------------------
  // Go Up
  // -----------------------------------------------------------------------

  const goUp = useCallback(() => {
    if (stateRef.current !== 'idle') return;
    const nav = useNavigationStore.getState();
    if (nav.breadcrumb.length <= 1) return;

    // Capture state before anything changes
    const currentViewport = reactFlow.getViewport();

    // Use the container rect captured during dive-in.
    // This has ReactFlow's measured pixel dimensions (not YAML position.width).
    const containerRect = lastContainerRectRef.current;
    if (!containerRect) {
      // No stored rect (e.g., navigated via breadcrumb, not dive-in) — fall back to dissolve
      dissolveUp();
      return;
    }

    const childRfNodes = reactFlow.getNodes();
    const childFitNodes = toFitNodes(childRfNodes);
    const { width: vpW, height: vpH } = getViewportDimensions();
    const matchedVp = computeMatchedViewport(childFitNodes, containerRect, vpW, vpH);

    stateRef.current = 'zooming_in';
    setIsTransitioning(true);

    // Phase 1: compress child nodes to preview scale
    cancelRef.current = animateViewport(
      reactFlow, currentViewport, matchedVp, PHASE1_DURATION, easeInOut, () => {
        // Switch point
        stateRef.current = 'switching';
        setOverlayStyle(COVER_STYLE);

        nav.goUp();

        requestAnimationFrame(() => {
          const zoomedViewport = computeZoomToRect(containerRect, vpW, vpH);
          reactFlow.setViewport(zoomedViewport);
          setOverlayStyle(null);

          const parentRfNodes = reactFlow.getNodes();
          const parentFitNodes = toFitNodes(parentRfNodes);
          const fittedVp = computeFitViewport({
            nodes: parentFitNodes,
            viewportWidth: vpW,
            viewportHeight: vpH,
          });
          const fittedViewport = { x: fittedVp.offsetX, y: fittedVp.offsetY, zoom: fittedVp.zoom };

          stateRef.current = 'zooming_out';

          cancelRef.current = animateViewport(
            reactFlow, zoomedViewport, fittedViewport, PHASE2_DURATION, easeInOut, () => {
              reset();
            },
          );
        });
      },
    );
  }, [reactFlow, reset, dissolveUp]);

  // -----------------------------------------------------------------------
  // Breadcrumb Jump (dissolve)
  // -----------------------------------------------------------------------

  const goToBreadcrumb = useCallback((index: number) => {
    if (stateRef.current !== 'idle') return;
    const nav = useNavigationStore.getState();
    const target = nav.breadcrumb[index];
    if (!target) return;

    stateRef.current = 'switching';
    setIsTransitioning(true);
    setOverlayStyle(dissolveStyle(1));

    requestAnimationFrame(() => {
      nav.goToBreadcrumb(index);
      reactFlow.fitView({ duration: 0 });
      startDissolveOut();
    });
  }, [reactFlow, startDissolveOut]);

  // -----------------------------------------------------------------------
  // Dissolve onTransitionEnd
  // -----------------------------------------------------------------------

  const onOverlayTransitionEnd = useCallback(() => {
    // Only reset if we're in a dissolve (overlayStyle has a transition)
    if (stateRef.current === 'switching' || stateRef.current === 'idle') {
      reset();
    }
  }, [reset]);

  return {
    diveIn,
    goUp,
    goToBreadcrumb,
    isTransitioning,
    overlayStyle,
    onOverlayTransitionEnd,
  };
}

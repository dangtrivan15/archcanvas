import { useState, useCallback, useRef, type CSSProperties } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { ReactFlowInstance } from '@xyflow/react';
import { useNavigationStore } from '@/store/navigationStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { computeFitViewport } from '@/lib/computeFitViewport';
import { animateOverlayTransition } from '@/lib/animateOverlayTransition';
import type { Inset, Viewport } from '@/lib/animateOverlayTransition';
import { mapCanvasNodes } from '../mapCanvasData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIVE_IN_DURATION = 350;  // ms
const GO_UP_DURATION = 300;    // ms
const DISSOLVE_DURATION = 350; // ms

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverlayConfig {
  canvasId: string;
  clipPath?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COVER_STYLE: CSSProperties = {
  position: 'absolute',
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

/** Build FitNode array from ReactFlow nodes. */
function toFitNodes(rfNodes: Array<{ position: { x: number; y: number }; width?: number | null; height?: number | null }>) {
  return rfNodes.map((n) => ({
    x: n.position.x,
    y: n.position.y,
    width: n.width ?? 150,
    height: n.height ?? 40,
  }));
}

/** Get the main ReactFlow container's bounding rect. */
function getMainCanvasRect(): DOMRect {
  const el = document.querySelector('.react-flow:not(.subsystem-preview .react-flow):not(.canvas-overlay .react-flow)');
  if (!el) return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  return el.getBoundingClientRect();
}

/** Build fit nodes for a canvas from the file store. */
function buildFitNodesForCanvas(canvasId: string) {
  const fileState = useFileStore.getState();
  const canvas = fileState.getCanvas(canvasId);
  if (!canvas?.data?.nodes?.length) return null;

  const canvasesRef = fileState.project?.canvases;
  const resolve = useRegistryStore.getState().resolve;
  const rfNodes = mapCanvasNodes({
    canvas: canvas.data,
    resolve,
    selectedNodeIds: new Set<string>(),
    canvasesRef,
  });
  return toFitNodes(rfNodes);
}

/** Compute clip-path inset from a DOMRect relative to a container DOMRect. */
function rectToInset(pr: DOMRect, cr: DOMRect): Inset {
  return {
    top: pr.top - cr.top,
    right: cr.right - pr.right,
    bottom: cr.bottom - pr.bottom,
    left: pr.left - cr.left,
  };
}

/** Format an inset as a clip-path string. */
function insetToClipPath(inset: Inset, radius = 8): string {
  return `inset(${inset.top}px ${inset.right}px ${inset.bottom}px ${inset.left}px round ${radius}px)`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNavigationTransition() {
  const reactFlow = useReactFlow();

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig | null>(null);
  const [backdropCanvasId, setBackdropCanvasId] = useState<string | null>(null);
  const [dissolveOverlayStyle, setDissolveOverlayStyle] = useState<CSSProperties | null>(null);

  const stateRef = useRef<'idle' | 'animating'>('idle');
  const cancelRef = useRef<(() => void) | null>(null);
  const lastPreviewRectRef = useRef<DOMRect | null>(null);
  const overlayElRef = useRef<HTMLDivElement>(null);
  const onRfReadyCallbackRef = useRef<((rf: ReactFlowInstance) => void) | null>(null);

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const reset = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    onRfReadyCallbackRef.current = null;
    stateRef.current = 'idle';
    setIsTransitioning(false);
    setOverlayConfig(null);
    setDissolveOverlayStyle(null);
  }, []);

  // -----------------------------------------------------------------------
  // Overlay ReactFlow ready callback
  // -----------------------------------------------------------------------

  const onOverlayReactFlowReady = useCallback((rf: ReactFlowInstance) => {
    const cb = onRfReadyCallbackRef.current;
    onRfReadyCallbackRef.current = null;
    if (cb) cb(rf);
  }, []);

  // -----------------------------------------------------------------------
  // Dissolve helpers (fallback + breadcrumb)
  // -----------------------------------------------------------------------

  const startDissolveOut = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDissolveOverlayStyle(dissolveStyle(0));
        setTimeout(() => {
          if (stateRef.current === 'animating') reset();
        }, DISSOLVE_DURATION + 50);
      });
    });
  }, [reset]);

  const dissolveUp = useCallback(() => {
    stateRef.current = 'animating';
    setIsTransitioning(true);
    setDissolveOverlayStyle(dissolveStyle(1));

    requestAnimationFrame(() => {
      const nav = useNavigationStore.getState();
      nav.goUp();
      reactFlow.fitView({ duration: 0 });
      setBackdropCanvasId(nav.parentCanvasId);
      lastPreviewRectRef.current = null;
      startDissolveOut();
    });
  }, [reactFlow, startDissolveOut]);

  const goToBreadcrumbDissolve = useCallback((refNodeId: string) => {
    stateRef.current = 'animating';
    setIsTransitioning(true);
    setDissolveOverlayStyle(dissolveStyle(1));

    requestAnimationFrame(() => {
      useNavigationStore.getState().diveIn(refNodeId);
      reactFlow.fitView({ duration: 0 });
      setBackdropCanvasId(useNavigationStore.getState().parentCanvasId);
      startDissolveOut();
    });
  }, [reactFlow, startDissolveOut]);

  const onDissolveTransitionEnd = useCallback(() => {
    if (stateRef.current === 'animating') {
      reset();
    }
  }, [reset]);

  // -----------------------------------------------------------------------
  // Dive In
  // -----------------------------------------------------------------------

  const diveIn = useCallback((refNodeId: string) => {
    if (stateRef.current !== 'idle') return;

    // Find the SubsystemPreview element for this ref node
    const previewEl = document.querySelector(
      `.subsystem-preview[data-canvas-id="${refNodeId}"]`
    );
    if (!previewEl) {
      // No preview element → dissolve fallback
      goToBreadcrumbDissolve(refNodeId);
      return;
    }

    // Measure the preview's screen rect
    const pr = previewEl.getBoundingClientRect();
    if (pr.width === 0 || pr.height === 0) {
      goToBreadcrumbDissolve(refNodeId);
      return;
    }

    // Store for go-up to use later
    lastPreviewRectRef.current = pr;

    // Build fit nodes for the child canvas
    const fitNodes = buildFitNodesForCanvas(refNodeId);
    if (!fitNodes || fitNodes.length === 0) {
      goToBreadcrumbDissolve(refNodeId);
      return;
    }

    // Get the main canvas container rect
    const cr = getMainCanvasRect();

    // Compute starting viewport (matches preview)
    const pvVp = computeFitViewport({
      nodes: fitNodes,
      viewportWidth: pr.width,
      viewportHeight: pr.height,
    });
    const startVp: Viewport = {
      x: pvVp.offsetX + (pr.left - cr.left),
      y: pvVp.offsetY + (pr.top - cr.top),
      zoom: pvVp.zoom,
    };

    // Compute ending viewport (fitted to canvas area)
    const endFit = computeFitViewport({
      nodes: fitNodes,
      viewportWidth: cr.width,
      viewportHeight: cr.height,
    });
    const endVp: Viewport = {
      x: endFit.offsetX,
      y: endFit.offsetY,
      zoom: endFit.zoom,
    };

    // Compute clip-path insets
    const startInset = rectToInset(pr, cr);
    const endInset: Inset = { top: 0, right: 0, bottom: 0, left: 0 };

    // Begin transition
    stateRef.current = 'animating';
    setIsTransitioning(true);

    // Mount overlay with initial clip-path
    setOverlayConfig({
      canvasId: refNodeId,
      clipPath: insetToClipPath(startInset),
    });

    // When the overlay's ReactFlow is ready, start the animation
    onRfReadyCallbackRef.current = (rf) => {
      const overlayEl = overlayElRef.current;
      if (!overlayEl) { reset(); return; }

      // Set initial viewport on overlay
      rf.setViewport(startVp);

      cancelRef.current = animateOverlayTransition({
        overlayEl,
        reactFlow: rf,
        startInset,
        endInset,
        startVp,
        endVp,
        startRadius: 8,
        endRadius: 0,
        duration: DIVE_IN_DURATION,
        onComplete: () => {
          // Swap the main canvas to the child
          useNavigationStore.getState().diveIn(refNodeId);

          // Set main canvas viewport to match overlay end state
          reactFlow.setViewport(endVp);

          // Update backdrop to show the parent
          setBackdropCanvasId(useNavigationStore.getState().parentCanvasId);

          // Clean up
          cancelRef.current = null;
          setOverlayConfig(null);
          stateRef.current = 'idle';
          setIsTransitioning(false);
        },
      });
    };
  }, [reactFlow, reset, goToBreadcrumbDissolve]);

  // -----------------------------------------------------------------------
  // Go Up
  // -----------------------------------------------------------------------

  const goUp = useCallback(() => {
    if (stateRef.current !== 'idle') return;
    const nav = useNavigationStore.getState();
    if (nav.breadcrumb.length <= 1) return;

    const lastRect = lastPreviewRectRef.current;
    if (!lastRect) {
      // No stored rect → dissolve fallback
      dissolveUp();
      return;
    }

    // Get current canvas data for overlay viewport
    const currentCanvasId = nav.currentCanvasId;
    const fitNodes = buildFitNodesForCanvas(currentCanvasId);
    if (!fitNodes || fitNodes.length === 0) {
      dissolveUp();
      return;
    }

    // Get the main canvas container rect
    const cr = getMainCanvasRect();

    // Compute overlay starting viewport (full canvas area, fitted)
    const fullFit = computeFitViewport({
      nodes: fitNodes,
      viewportWidth: cr.width,
      viewportHeight: cr.height,
    });
    const startVp: Viewport = {
      x: fullFit.offsetX,
      y: fullFit.offsetY,
      zoom: fullFit.zoom,
    };

    // Compute overlay ending viewport (matches preview rect)
    const previewFit = computeFitViewport({
      nodes: fitNodes,
      viewportWidth: lastRect.width,
      viewportHeight: lastRect.height,
    });
    const endVp: Viewport = {
      x: previewFit.offsetX + (lastRect.left - cr.left),
      y: previewFit.offsetY + (lastRect.top - cr.top),
      zoom: previewFit.zoom,
    };

    // Clip-path: start full screen, end at preview rect
    const startInset: Inset = { top: 0, right: 0, bottom: 0, left: 0 };
    const endInset = rectToInset(lastRect, cr);

    // Begin transition
    stateRef.current = 'animating';
    setIsTransitioning(true);

    // Mount overlay showing current (child) canvas at full screen
    setOverlayConfig({ canvasId: currentCanvasId });

    // When the overlay's ReactFlow is ready:
    onRfReadyCallbackRef.current = (rf) => {
      const overlayEl = overlayElRef.current;
      if (!overlayEl) { reset(); return; }

      // Set overlay to full-screen fitted viewport
      rf.setViewport(startVp);

      // Swap main canvas to parent (hidden behind full-screen overlay)
      nav.goUp();

      // Start the shrinking animation
      // (parent nodes will render behind overlay during animation)
      cancelRef.current = animateOverlayTransition({
        overlayEl,
        reactFlow: rf,
        startInset,
        endInset,
        startVp,
        endVp,
        startRadius: 0,
        endRadius: 8,
        duration: GO_UP_DURATION,
        onComplete: () => {
          // Fit the main canvas to parent nodes
          reactFlow.fitView({ duration: 0 });

          // Update backdrop
          setBackdropCanvasId(useNavigationStore.getState().parentCanvasId);

          // Clean up
          lastPreviewRectRef.current = null;
          cancelRef.current = null;
          setOverlayConfig(null);
          stateRef.current = 'idle';
          setIsTransitioning(false);
        },
      });
    };
  }, [reactFlow, reset, dissolveUp]);

  // -----------------------------------------------------------------------
  // Breadcrumb Jump (dissolve)
  // -----------------------------------------------------------------------

  const goToBreadcrumb = useCallback((index: number) => {
    if (stateRef.current !== 'idle') return;
    const nav = useNavigationStore.getState();
    const target = nav.breadcrumb[index];
    if (!target) return;

    stateRef.current = 'animating';
    setIsTransitioning(true);
    setDissolveOverlayStyle(dissolveStyle(1));

    requestAnimationFrame(() => {
      nav.goToBreadcrumb(index);
      reactFlow.fitView({ duration: 0 });
      setBackdropCanvasId(useNavigationStore.getState().parentCanvasId);
      lastPreviewRectRef.current = null;
      startDissolveOut();
    });
  }, [reactFlow, startDissolveOut]);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    diveIn,
    goUp,
    goToBreadcrumb,
    isTransitioning,
    overlayConfig,
    backdropCanvasId,
    overlayElRef,
    onOverlayReactFlowReady,
    dissolveOverlayStyle,
    onDissolveTransitionEnd,
  };
}

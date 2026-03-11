/**
 * useCanvasNavigation - Manages fractal canvas navigation:
 * container dive-in/out, escape zoom-out, enter dive-in, pinch-out gesture,
 * and auto-layout on zoom-in.
 */

import { useEffect, useRef } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import { useContainerDiveIn } from '@/hooks/useContainerDiveIn';
import { isActiveElementTextInput } from '@/core/input/focusZones';
import { getNodesAtLevel } from '@/core/graph/graphQuery';
import { needsAutoLayout } from '@/core/layout/positionDetection';
import type { CanvasNode } from '@/types/canvas';
import type { CanvasPerformanceState } from '@/hooks/useCanvasPerformance';

export function useCanvasNavigation(
  rfNodes: CanvasNode[],
  perf: CanvasPerformanceState,
) {
  const graph = useGraphStore((s) => s.graph);
  const autoLayout = useGraphStore((s) => s.autoLayout);
  const navigationPath = useNavigationStore((s) => s.path);
  const zoomOut = useNavigationStore((s) => s.zoomOut);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const deleteDialogOpen = useUIStore((s) => s.deleteDialogOpen);
  const connectStep = useUIStore((s) => s.connectStep);
  const placementMode = useUIStore((s) => s.placementMode);

  const [diveState, diveActions] = useContainerDiveIn();
  const nestedDepth = useNavigationStore((s) => s.fileStack.length);

  // Store-based dive-in request (replaces DOM event)
  const diveInNodeId = useCanvasStore((s) => s.diveInNodeId);
  const diveInRefSource = useCanvasStore((s) => s.diveInRefSource);
  const diveInCounter = useCanvasStore((s) => s.diveInCounter);
  const prevDiveInCounterRef = useRef(diveInCounter);

  // Auto-layout when zooming into a parent whose children lack positions
  const prevNavigationPathRef = useRef(navigationPath);
  useEffect(() => {
    const prevPath = prevNavigationPathRef.current;
    prevNavigationPathRef.current = navigationPath;

    // Only trigger on zoom-in (path grew longer)
    if (navigationPath.length <= prevPath.length) return;
    if (graph.nodes.length === 0) return;

    const nodesAtLevel = getNodesAtLevel(graph, navigationPath);
    if (nodesAtLevel.length > 0 && needsAutoLayout(nodesAtLevel)) {
      console.log('[Canvas] Children lack positions — triggering auto-layout on zoom-in');
      setTimeout(() => {
        autoLayout('horizontal', navigationPath)
          .then(() => {
            useCanvasStore.getState().requestFitView();
            console.log('[Canvas] Auto-layout on zoom-in complete');
          })
          .catch((err) => {
            console.warn('[Canvas] Auto-layout on zoom-in failed:', err);
          });
      }, 0);
    }
  }, [navigationPath, graph, autoLayout]);

  // Watch for dive-in requests (from ContainerNode via canvasStore counter)
  useEffect(() => {
    if (diveInCounter !== prevDiveInCounterRef.current) {
      prevDiveInCounterRef.current = diveInCounter;
      if (diveInNodeId && diveInRefSource) {
        diveActions.diveIn(diveInNodeId, diveInRefSource, rfNodes, perf.prefersReducedMotion);
      }
    }
  }, [diveInCounter, diveInNodeId, diveInRefSource, diveActions, rfNodes, perf.prefersReducedMotion]);

  // Escape key for nested file dive-out
  useEffect(() => {
    const handleEscapeDiveOut = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        nestedDepth > 0 &&
        !diveState.isAnimating &&
        !deleteDialogOpen &&
        !connectStep &&
        !placementMode &&
        !isActiveElementTextInput()
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (navigationPath.length > 0) {
          zoomOut();
        } else {
          diveActions.diveOut(perf.prefersReducedMotion);
        }
      }
    };
    // Use capture phase so we can intercept before other Escape handlers
    document.addEventListener('keydown', handleEscapeDiveOut, true);
    return () => document.removeEventListener('keydown', handleEscapeDiveOut, true);
  }, [nestedDepth, navigationPath, diveState.isAnimating, diveActions, perf.prefersReducedMotion, deleteDialogOpen, connectStep, placementMode, zoomOut]);

  // Ctrl+Shift+Home: jump directly to project root (pop entire file stack)
  useEffect(() => {
    const handleJumpToRoot = (e: KeyboardEvent) => {
      if (
        e.key === 'Home' &&
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        nestedDepth > 0 &&
        !diveState.isAnimating &&
        !isActiveElementTextInput()
      ) {
        e.preventDefault();
        e.stopPropagation();
        useNavigationStore.getState().popToRoot();
      }
    };
    document.addEventListener('keydown', handleJumpToRoot, true);
    return () => document.removeEventListener('keydown', handleJumpToRoot, true);
  }, [nestedDepth, diveState.isAnimating]);

  // Enter key on selected container node: trigger dive-in
  useEffect(() => {
    const handleEnterDiveIn = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey &&
        selectedNodeId &&
        !diveState.isAnimating &&
        !deleteDialogOpen &&
        !connectStep &&
        !placementMode &&
        !isActiveElementTextInput()
      ) {
        const targetNode = rfNodes.find((n) => n.id === selectedNodeId);
        if (targetNode?.data?.refSource) {
          e.preventDefault();
          e.stopPropagation();
          diveActions.diveIn(
            selectedNodeId,
            targetNode.data.refSource as string,
            rfNodes,
            perf.prefersReducedMotion,
          );
        }
      }
    };
    document.addEventListener('keydown', handleEnterDiveIn, true);
    return () => document.removeEventListener('keydown', handleEnterDiveIn, true);
  }, [selectedNodeId, rfNodes, diveState.isAnimating, diveActions, perf.prefersReducedMotion, deleteDialogOpen, connectStep, placementMode]);

  // Two-finger pinch-out gesture: pop file stack when spreading beyond threshold
  useEffect(() => {
    if (nestedDepth === 0) return;

    let initialDistance: number | null = null;
    const PINCH_OUT_THRESHOLD = 1.5;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
        const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
        initialDistance = Math.hypot(dx, dy);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance !== null && !diveState.isAnimating) {
        const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
        const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
        const currentDistance = Math.hypot(dx, dy);
        const ratio = currentDistance / initialDistance;

        if (ratio > PINCH_OUT_THRESHOLD) {
          initialDistance = null;
          if (navigationPath.length > 0) {
            zoomOut();
          } else {
            diveActions.diveOut(perf.prefersReducedMotion);
          }
        }
      }
    };

    const handleTouchEnd = () => {
      initialDistance = null;
    };

    const canvasEl = document.querySelector('[data-testid="canvas"]');
    if (canvasEl) {
      canvasEl.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true });
      canvasEl.addEventListener('touchmove', handleTouchMove as EventListener, { passive: true });
      canvasEl.addEventListener('touchend', handleTouchEnd as EventListener);
    }

    return () => {
      if (canvasEl) {
        canvasEl.removeEventListener('touchstart', handleTouchStart as EventListener);
        canvasEl.removeEventListener('touchmove', handleTouchMove as EventListener);
        canvasEl.removeEventListener('touchend', handleTouchEnd as EventListener);
      }
    };
  }, [nestedDepth, navigationPath, diveState.isAnimating, diveActions, perf.prefersReducedMotion, zoomOut]);

  return { diveState, diveActions, nestedDepth };
}

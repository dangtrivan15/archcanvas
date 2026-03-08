/**
 * useContainerDiveIn - Orchestrates the multi-phase zoom animation for diving
 * into/out of container nodes.
 *
 * Animation phases:
 * - **Dive in**: zoom viewport into container node bounds (300-400ms) → crossfade overlay
 *   (150ms) → push file & fitView child canvas → fade out overlay (150ms)
 * - **Dive out (Escape)**: crossfade overlay in (150ms) → pop file & restore parent
 *   viewport → zoom out from node bounds → fade out overlay (150ms)
 *
 * Respects `prefers-reduced-motion`: when enabled, skips all animations and
 * performs instant file switches.
 */

import { useCallback, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { TransitionPhase } from '@/components/canvas/TransitionOverlay';
import { useNestedCanvasStore } from '@/store/nestedCanvasStore';
import { useProjectStore } from '@/store/projectStore';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';
import type { CanvasNode } from '@/types/canvas';

// ─── Animation timing constants ────────────────────────────────

/** Duration (ms) of the zoom-into-node-bounds phase */
const ZOOM_IN_DURATION = 350;
/** Padding (fraction) around the node when zooming to fill screen */
const ZOOM_PADDING = 0.15;

// ─── Types ─────────────────────────────────────────────────────

export interface ContainerDiveInState {
  /** Current animation phase */
  phase: TransitionPhase;
  /** Color of the container node being transitioned (for overlay tinting) */
  transitionColor: string;
  /** Whether an animation is currently in progress */
  isAnimating: boolean;
}

export interface ContainerDiveInActions {
  /**
   * Initiate a dive-in animation targeting the given container node.
   * @param nodeId - The archNodeId of the container node
   * @param refSource - Bare filename in .archcanvas/ folder (e.g., '01JABCDEF.archc')
   * @param rfNodes - Current React Flow nodes (to find node position/dimensions)
   * @param prefersReducedMotion - Skip animations if true
   */
  diveIn: (
    nodeId: string,
    refSource: string | undefined,
    rfNodes: CanvasNode[],
    prefersReducedMotion: boolean,
  ) => void;

  /**
   * Initiate a zoom-out animation returning to the parent canvas.
   * @param prefersReducedMotion - Skip animations if true
   */
  diveOut: (prefersReducedMotion: boolean) => void;

  /** Callback for when the crossfade-in phase completes (overlay fully opaque) */
  onCrossfadeInComplete: () => void;

  /** Callback for when the crossfade-out phase completes (overlay fully transparent) */
  onCrossfadeOutComplete: () => void;
}

/**
 * Calculate the React Flow viewport that would make a given node fill the screen.
 *
 * React Flow viewport coordinates:
 * - `x` and `y` are the pixel offset of the flow coordinate origin from the
 *   top-left of the container, scaled by `zoom`.
 * - A node at flow position (px, py) appears at screen position (x + px * zoom, y + py * zoom).
 *
 * To center a node with given bounds (nodeX, nodeY, nodeW, nodeH) with padding:
 * 1. Compute the zoom so the node fills the container with padding.
 * 2. Compute x, y so the node center maps to the container center.
 */
function calculateNodeFillViewport(
  node: { position: { x: number; y: number }; measured?: { width?: number; height?: number }; width?: number; height?: number },
  containerWidth: number,
  containerHeight: number,
  padding: number,
): { x: number; y: number; zoom: number } {
  const nodeW = node.measured?.width ?? node.width ?? 280;
  const nodeH = node.measured?.height ?? node.height ?? 200;
  const nodeX = node.position.x;
  const nodeY = node.position.y;

  // Target: node + padding fills the container
  const availableW = containerWidth * (1 - 2 * padding);
  const availableH = containerHeight * (1 - 2 * padding);

  const zoom = Math.min(availableW / nodeW, availableH / nodeH, 2.0);

  // Center of node in flow coords
  const nodeCenterX = nodeX + nodeW / 2;
  const nodeCenterY = nodeY + nodeH / 2;

  // Viewport x, y: the flow origin offset such that nodeCenterX/Y maps to screen center
  const x = containerWidth / 2 - nodeCenterX * zoom;
  const y = containerHeight / 2 - nodeCenterY * zoom;

  return { x, y, zoom };
}

export function useContainerDiveIn(): [ContainerDiveInState, ContainerDiveInActions] {
  const { setViewport: rfSetViewport, getViewport } = useReactFlow();
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [transitionColor, setTransitionColor] = useState('#0EA5E9');
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs to hold state across animation phases
  const pendingDiveInRef = useRef<{
    refSource: string;
    nodeId: string;
    archNodeId: string;
  } | null>(null);
  const pendingDiveOutRef = useRef<boolean>(false);
  const savedViewportBeforeDiveRef = useRef<{ x: number; y: number; zoom: number } | null>(null);

  // ─── Dive In ─────────────────────────────────────────────────

  const diveIn = useCallback(
    (
      nodeId: string,
      refSource: string | undefined,
      rfNodes: CanvasNode[],
      prefersReducedMotion: boolean,
    ) => {
      if (isAnimating) return;
      if (!refSource) return;

      // Find the target node in the React Flow nodes
      const targetNode = rfNodes.find((n) => n.id === nodeId);
      if (!targetNode) return;

      // Extract node color for overlay
      const color = targetNode.data?.color || '#0EA5E9';
      setTransitionColor(color);

      // refSource is a bare filename (e.g. '01JABCDEF.archc')
      // resolved from the .archcanvas/ folder by projectStore.loadFile()
      const filePath = refSource;

      // Save for crossfade callback (nodeId is the archNodeId of the container)
      pendingDiveInRef.current = { refSource: filePath, nodeId, archNodeId: nodeId };

      if (prefersReducedMotion) {
        // Instant switch - no animation
        setIsAnimating(true);
        performDiveInSwitch(filePath, nodeId).then(() => {
          setIsAnimating(false);
        });
        return;
      }

      // Phase 1: Zoom into the container node's bounding box
      setIsAnimating(true);
      setPhase('zoom-in');

      // Save current viewport for potential zoom-out later
      savedViewportBeforeDiveRef.current = getViewport();

      // Calculate target viewport to fill screen with the node
      const canvasEl = document.querySelector('[data-testid="canvas"]');
      const containerWidth = canvasEl?.clientWidth ?? window.innerWidth;
      const containerHeight = canvasEl?.clientHeight ?? window.innerHeight;

      const targetViewport = calculateNodeFillViewport(
        targetNode,
        containerWidth,
        containerHeight,
        ZOOM_PADDING,
      );

      // Animate viewport to target
      rfSetViewport(targetViewport, { duration: ZOOM_IN_DURATION });

      // After zoom completes, start crossfade
      setTimeout(() => {
        setPhase('crossfade-in');
      }, ZOOM_IN_DURATION);
    },
    [isAnimating, getViewport, rfSetViewport],
  );

  // ─── Dive In: File Switch (called at crossfade peak) ──────────

  const performDiveInSwitch = useCallback(
    async (filePath: string, containerNodeId?: string) => {
      const projectStore = useProjectStore.getState();
      const nestedStore = useNestedCanvasStore.getState();

      try {
        // Load the child file
        const loaded = await projectStore.loadFile(filePath);
        if (loaded && loaded.graph) {
          // Push current state + switch to child graph
          // containerNodeId enables parent edge indicator capture
          // Pass the transition color for nesting frame tint
          nestedStore.pushFile(filePath, loaded.graph, containerNodeId, transitionColor);
        }
      } catch (err) {
        console.error('[ContainerDiveIn] Failed to load child file:', filePath, err);
        const message = err instanceof Error ? err.message : String(err);
        // Show user-friendly toast; loadFile throws 'Referenced file not found: ...' for missing files
        useUIStore.getState().showToast(message.startsWith('Referenced file not found')
          ? message
          : `Failed to open canvas: ${message}`);
      }
    },
    [transitionColor],
  );

  // ─── Auto-save child file on dive-out ───────────────────────

  /**
   * If the current child canvas is dirty, auto-save it before navigating back.
   * Returns a promise that resolves when the save completes (or immediately if clean).
   */
  const autoSaveChildIfDirty = useCallback(async () => {
    const { isDirty } = useCoreStore.getState();
    const nestedStore = useNestedCanvasStore.getState();
    const activeFilePath = nestedStore.activeFilePath;

    if (isDirty && activeFilePath) {
      const projectState = useProjectStore.getState();
      if (projectState.isProjectOpen) {
        try {
          await projectState.saveChildArchc(activeFilePath);
        } catch (err) {
          console.warn('[ContainerDiveIn] Auto-save on dive-out failed:', err);
          // Don't block dive-out if save fails — user can manually save later
        }
      }
    }
  }, []);

  // ─── Dive Out ────────────────────────────────────────────────

  const diveOut = useCallback(
    (prefersReducedMotion: boolean) => {
      if (isAnimating) return;

      const nestedStore = useNestedCanvasStore.getState();
      if (nestedStore.getDepth() === 0) return; // already at root

      if (prefersReducedMotion) {
        // Instant switch — auto-save then pop
        setIsAnimating(true);
        autoSaveChildIfDirty().then(() => {
          nestedStore.popFile();
          setIsAnimating(false);
        });
        return;
      }

      // Phase 1: Crossfade in (hide current canvas)
      setIsAnimating(true);
      pendingDiveOutRef.current = true;
      setPhase('zoom-out-fade');
    },
    [isAnimating, autoSaveChildIfDirty],
  );

  // ─── Crossfade Callbacks ─────────────────────────────────────

  const onCrossfadeInComplete = useCallback(() => {
    if (pendingDiveInRef.current) {
      // Dive-in: at peak opacity, swap the canvas
      const { refSource, archNodeId } = pendingDiveInRef.current;
      pendingDiveInRef.current = null;

      performDiveInSwitch(refSource, archNodeId).then(() => {
        // Brief delay to let React Flow render new nodes before fading out
        setTimeout(() => {
          setPhase('crossfade-out');
        }, 50);
      });
    } else if (pendingDiveOutRef.current) {
      // Dive-out: at peak opacity, auto-save child if dirty, then restore parent canvas
      pendingDiveOutRef.current = false;

      autoSaveChildIfDirty().then(() => {
        const nestedStore = useNestedCanvasStore.getState();
        nestedStore.popFile();

        // Brief delay to let React Flow render restored nodes
        setTimeout(() => {
          setPhase('zoom-out');
        }, 50);
      });
    }
  }, [performDiveInSwitch, autoSaveChildIfDirty]);

  const onCrossfadeOutComplete = useCallback(() => {
    setPhase('idle');
    setIsAnimating(false);
  }, []);

  return [
    { phase, transitionColor, isAnimating },
    { diveIn, diveOut, onCrossfadeInComplete, onCrossfadeOutComplete },
  ];
}

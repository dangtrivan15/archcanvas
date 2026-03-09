/**
 * useCanvasConnectMode - Manages keyboard-driven edge connection mode.
 * 'C' enters connect mode, arrows navigate targets, Enter advances to type picker,
 * 1/2/3 picks edge type, Escape cancels. Also provides node/edge decorations
 * for visual feedback during connect mode.
 */

import { useEffect, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { isActiveElementTextInput } from '@/core/input/focusZones';
import {
  findNearestNode,
  findTopLeftNode,
  extractPositions,
  type Direction,
} from '@/core/input/spatialNavigation';
import type { CanvasNode, CanvasEdge } from '@/types/canvas';

export function useCanvasConnectMode(rfNodes: CanvasNode[], rfEdges: CanvasEdge[]) {
  const addEdge = useCoreStore((s) => s.addEdge);
  const connectSource = useUIStore((s) => s.connectSource);
  const connectTarget = useUIStore((s) => s.connectTarget);
  const connectStep = useUIStore((s) => s.connectStep);
  const enterConnectMode = useUIStore((s) => s.enterConnectMode);
  const setConnectTarget = useUIStore((s) => s.setConnectTarget);
  const advanceToPickType = useUIStore((s) => s.advanceToPickType);
  const exitConnectMode = useUIStore((s) => s.exitConnectMode);
  const { setCenter, getViewport } = useReactFlow();

  // Keyboard handler for connect mode
  useEffect(() => {
    const handleConnectMode = (e: KeyboardEvent) => {
      if (isActiveElementTextInput()) return;

      const uiState = useUIStore.getState();
      const { connectSource: src, connectTarget: tgt, connectStep: step } = uiState;
      const inConnectMode = step !== null;

      // Enter connect mode with 'C'
      if (!inConnectMode && e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (
          uiState.deleteDialogOpen ||
          uiState.connectionDialogOpen ||
          uiState.unsavedChangesDialogOpen ||
          uiState.errorDialogOpen ||
          uiState.integrityWarningDialogOpen ||
          uiState.commandPaletteOpen ||
          uiState.quickSearchOpen ||
          uiState.placementMode
        ) {
          return;
        }

        const canvasState = useCanvasStore.getState();
        const currentSelected = canvasState.selectedNodeId;
        if (!currentSelected) return;

        e.preventDefault();
        enterConnectMode(currentSelected);

        // Auto-select first target candidate via spatial navigation
        const positions = extractPositions(rfNodes);
        const firstTarget =
          findNearestNode(currentSelected, 'right', positions) ||
          findNearestNode(currentSelected, 'down', positions) ||
          findTopLeftNode(positions.filter((p) => p.id !== currentSelected));
        if (firstTarget) {
          setConnectTarget(firstTarget);
          const targetPos = positions.find((p) => p.id === firstTarget);
          if (targetPos) {
            const currentViewport = getViewport();
            setCenter(targetPos.x, targetPos.y, { zoom: currentViewport.zoom, duration: 200 });
          }
        }
        return;
      }

      if (!inConnectMode) return;

      // Escape: cancel connect mode
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        exitConnectMode();
        return;
      }

      // In 'select-target' step: arrow keys navigate, Enter advances
      if (step === 'select-target') {
        const ARROW_MAP: Record<string, Direction> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        const direction = ARROW_MAP[e.key];
        if (direction) {
          e.preventDefault();
          e.stopPropagation();
          const positions = extractPositions(rfNodes);
          const fromId = tgt || src;
          if (!fromId) return;
          const nextTarget = findNearestNode(fromId, direction, positions);
          if (nextTarget && nextTarget !== src) {
            setConnectTarget(nextTarget);
            const targetPos = positions.find((p) => p.id === nextTarget);
            if (targetPos) {
              const currentViewport = getViewport();
              setCenter(targetPos.x, targetPos.y, { zoom: currentViewport.zoom, duration: 200 });
            }
          }
          return;
        }

        if (e.key === 'Enter' && tgt && tgt !== src) {
          e.preventDefault();
          e.stopPropagation();
          advanceToPickType();
          return;
        }
      }

      // In 'pick-type' step: 1/2/3 picks edge type
      if (step === 'pick-type') {
        const TYPE_MAP: Record<string, 'sync' | 'async' | 'data-flow'> = {
          '1': 'sync',
          '2': 'async',
          '3': 'data-flow',
        };
        const edgeType = TYPE_MAP[e.key];
        if (edgeType && src && tgt) {
          e.preventDefault();
          e.stopPropagation();
          const typeLabels: Record<string, string> = {
            sync: 'Sync',
            async: 'Async',
            'data-flow': 'Data Flow',
          };
          const newEdge = addEdge({ fromNode: src, toNode: tgt, type: edgeType });
          exitConnectMode();
          if (newEdge) {
            useCanvasStore.getState().selectEdge(newEdge.id);
            useUIStore.getState().showToast(`Created ${typeLabels[edgeType]} edge`);
          }
          return;
        }
      }
    };

    // Use capture phase to intercept before normal handlers
    document.addEventListener('keydown', handleConnectMode, true);
    return () => document.removeEventListener('keydown', handleConnectMode, true);
  }, [rfNodes, enterConnectMode, setConnectTarget, advanceToPickType, exitConnectMode, addEdge, setCenter, getViewport]);

  // Decorate nodes for connect mode visualization
  const connectNodes = useMemo(() => {
    if (!connectStep) return rfNodes;
    return rfNodes.map((n) => {
      if (n.id === connectSource) {
        return { ...n, className: `${n.className || ''} connect-mode-source`.trim() };
      }
      if (n.id === connectTarget && connectStep === 'select-target') {
        return { ...n, className: `${n.className || ''} connect-mode-target`.trim() };
      }
      return n;
    });
  }, [connectStep, connectSource, connectTarget, rfNodes]);

  // Decorate edges: add preview edge during connect mode
  const connectEdges = useMemo(() => {
    if (!connectStep || !connectSource || !connectTarget) return rfEdges;
    return [
      ...rfEdges,
      {
        id: '__connect-preview__',
        source: connectSource,
        target: connectTarget,
        type: 'default',
        animated: true,
        style: {
          strokeDasharray: '8 4',
          stroke: 'hsl(var(--pine))',
          strokeWidth: 2,
          opacity: 0.8,
        },
        data: {},
      } as CanvasEdge,
    ];
  }, [connectStep, connectSource, connectTarget, rfEdges]);

  return {
    connectStep,
    connectSource,
    connectTarget,
    connectNodes,
    connectEdges,
    exitConnectMode,
  };
}

/**
 * useCanvasViewport - Manages viewport sync between canvas store and React Flow.
 * Handles counter-diff pattern for fitView, zoomIn, zoomOut, zoom100, and centerOnNode.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow, type OnMoveEnd, type Viewport } from '@xyflow/react';
import { useCanvasStore, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_DURATION } from '@/store/canvasStore';
import type { CanvasNode } from '@/types/canvas';
import type { CanvasPerformanceState } from '@/hooks/useCanvasPerformance';

export function useCanvasViewport(
  rfNodes: CanvasNode[],
  perf: CanvasPerformanceState,
) {
  const { fitView, setCenter, getViewport, setViewport: rfSetViewport } = useReactFlow();
  const setViewport = useCanvasStore((s) => s.setViewport);

  // Counter-diff refs
  const fitViewCounter = useCanvasStore((s) => s.fitViewCounter);
  const zoomInCounter = useCanvasStore((s) => s.zoomInCounter);
  const zoomOutCounter = useCanvasStore((s) => s.zoomOutCounter);
  const zoom100Counter = useCanvasStore((s) => s.zoom100Counter);
  const centerOnNodeId = useCanvasStore((s) => s.centerOnNodeId);
  const centerOnNodeCounter = useCanvasStore((s) => s.centerOnNodeCounter);

  const prevFitViewCounterRef = useRef(fitViewCounter);
  const prevZoomInCounterRef = useRef(zoomInCounter);
  const prevZoomOutCounterRef = useRef(zoomOutCounter);
  const prevZoom100CounterRef = useRef(zoom100Counter);
  const prevCenterOnNodeCounterRef = useRef(centerOnNodeCounter);

  // Watch fitView requests
  useEffect(() => {
    if (fitViewCounter !== prevFitViewCounterRef.current) {
      prevFitViewCounterRef.current = fitViewCounter;
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 50);
    }
  }, [fitViewCounter, fitView]);

  // Watch zoom-in requests
  useEffect(() => {
    if (zoomInCounter !== prevZoomInCounterRef.current) {
      prevZoomInCounterRef.current = zoomInCounter;
      const vp = getViewport();
      const newZoom = Math.min(ZOOM_MAX, vp.zoom + ZOOM_STEP);
      rfSetViewport({ x: vp.x, y: vp.y, zoom: newZoom }, { duration: ZOOM_DURATION });
    }
  }, [zoomInCounter, getViewport, rfSetViewport]);

  // Watch zoom-out requests
  useEffect(() => {
    if (zoomOutCounter !== prevZoomOutCounterRef.current) {
      prevZoomOutCounterRef.current = zoomOutCounter;
      const vp = getViewport();
      const newZoom = Math.max(ZOOM_MIN, vp.zoom - ZOOM_STEP);
      rfSetViewport({ x: vp.x, y: vp.y, zoom: newZoom }, { duration: ZOOM_DURATION });
    }
  }, [zoomOutCounter, getViewport, rfSetViewport]);

  // Watch zoom-to-100% requests
  useEffect(() => {
    if (zoom100Counter !== prevZoom100CounterRef.current) {
      prevZoom100CounterRef.current = zoom100Counter;
      const vp = getViewport();
      rfSetViewport({ x: vp.x, y: vp.y, zoom: 1.0 }, { duration: ZOOM_DURATION });
    }
  }, [zoom100Counter, getViewport, rfSetViewport]);

  // Watch center-on-node requests (from QuickSearch)
  useEffect(() => {
    if (centerOnNodeCounter !== prevCenterOnNodeCounterRef.current) {
      prevCenterOnNodeCounterRef.current = centerOnNodeCounter;
      if (centerOnNodeId) {
        const targetNode = rfNodes.find((n) => n.id === centerOnNodeId);
        if (targetNode) {
          const vp = getViewport();
          setCenter(targetNode.position.x, targetNode.position.y, {
            zoom: vp.zoom,
            duration: 200,
          });
        }
      }
    }
  }, [centerOnNodeCounter, centerOnNodeId, rfNodes, getViewport, setCenter]);

  // onMoveEnd: sync viewport back to store + update LOD
  const onMoveEnd: OnMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
      perf.updateZoom(viewport.zoom);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setViewport, perf.updateZoom],
  );

  return { onMoveEnd };
}

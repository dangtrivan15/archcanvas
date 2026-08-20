import { useNavigationStore } from '@/store/navigationStore';
import { useCanvasStore } from '@/store/canvasStore';
import { getReactFlowInstance } from '@/lib/reactFlowRef';

/**
 * Navigate to `canvasId` (if not already active), select `nodeId`, and zoom
 * the canvas to it. Used by the Validation panel's click-to-reveal handler.
 */
export function revealNode(canvasId: string, nodeId: string): void {
  const needsNavigate = canvasId !== useNavigationStore.getState().currentCanvasId;
  if (needsNavigate) {
    useNavigationStore.getState().navigateTo(canvasId);
  }

  useCanvasStore.getState().selectNodes([nodeId]);

  const doFitView = () => {
    getReactFlowInstance()?.fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.3 });
  };

  // Defer a tick after navigation so React Flow has re-rendered the new
  // scope's nodes before we try to fit the view to one of them.
  if (needsNavigate) {
    setTimeout(doFitView, 0);
  } else {
    doFitView();
  }
}

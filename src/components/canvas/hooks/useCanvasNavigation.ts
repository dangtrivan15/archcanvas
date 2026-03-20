import { useReactFlow } from '@xyflow/react';
import { useNavigationStore } from '@/store/navigationStore';

export function useCanvasNavigation() {
  const reactFlow = useReactFlow();

  const saveCurrentViewport = () => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const viewport = reactFlow.getViewport();
    useNavigationStore.getState().saveViewport(canvasId, viewport);
  };

  const restoreOrFitView = () => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const saved = useNavigationStore.getState().getSavedViewport(canvasId);
    if (saved) {
      reactFlow.setViewport(saved, { duration: 300 });
    } else {
      reactFlow.fitView({ duration: 300 });
    }
  };

  const diveIn = (refNodeId: string, position?: { x: number; y: number }) => {
    // Save viewport BEFORE the zoom animation starts
    saveCurrentViewport();

    // Animate zoom-in toward the clicked node position
    if (position) {
      reactFlow.setViewport(
        { x: -position.x * 2, y: -position.y * 2, zoom: 2 },
        { duration: 300 },
      );
    }
    // After animation, switch canvas
    setTimeout(() => {
      useNavigationStore.getState().diveIn(refNodeId);
      restoreOrFitView();
    }, position ? 300 : 0);
  };

  const goUp = () => {
    const { breadcrumb } = useNavigationStore.getState();
    if (breadcrumb.length <= 1) return; // already at root

    saveCurrentViewport();

    reactFlow.setViewport({ x: 0, y: 0, zoom: 0.5 }, { duration: 300 });
    setTimeout(() => {
      useNavigationStore.getState().goUp();
      restoreOrFitView();
    }, 300);
  };

  const goToBreadcrumb = (index: number) => {
    const { breadcrumb } = useNavigationStore.getState();
    if (index < 0 || index >= breadcrumb.length) return;

    saveCurrentViewport();

    reactFlow.setViewport({ x: 0, y: 0, zoom: 0.5 }, { duration: 300 });
    setTimeout(() => {
      useNavigationStore.getState().goToBreadcrumb(index);
      restoreOrFitView();
    }, 300);
  };

  const goToRoot = () => {
    const { breadcrumb } = useNavigationStore.getState();
    if (breadcrumb.length <= 1) return; // already at root

    saveCurrentViewport();

    reactFlow.setViewport({ x: 0, y: 0, zoom: 0.5 }, { duration: 300 });
    setTimeout(() => {
      useNavigationStore.getState().goToRoot();
      restoreOrFitView();
    }, 300);
  };

  return { diveIn, goUp, goToBreadcrumb, goToRoot };
}

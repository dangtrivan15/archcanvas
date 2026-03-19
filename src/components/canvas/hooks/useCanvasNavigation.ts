import { useReactFlow } from '@xyflow/react';
import { useNavigationStore } from '@/store/navigationStore';

export function useCanvasNavigation() {
  const reactFlow = useReactFlow();

  const diveIn = (refNodeId: string, position?: { x: number; y: number }) => {
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
      reactFlow.fitView({ duration: 300 });
    }, position ? 300 : 0);
  };

  const goUp = () => {
    reactFlow.setViewport({ x: 0, y: 0, zoom: 0.5 }, { duration: 300 });
    setTimeout(() => {
      useNavigationStore.getState().goUp();
      reactFlow.fitView({ duration: 300 });
    }, 300);
  };

  return { diveIn, goUp };
}

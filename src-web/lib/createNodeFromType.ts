import type { Node } from '@/types';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { getReactFlowInstance } from './reactFlowRef';

/**
 * Compute a default position at the center of the current viewport
 * with a small random offset so rapid consecutive adds don't stack.
 */
function viewportCenterPosition(): { x: number; y: number } {
  const rf = getReactFlowInstance();
  const el = document.querySelector<HTMLElement>('[data-testid="main-canvas"]');

  if (rf && el) {
    const rect = el.getBoundingClientRect();
    const screenCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const flowCenter = rf.screenToFlowPosition(screenCenter);
    return {
      x: flowCenter.x + (Math.random() * 60 - 30),
      y: flowCenter.y + (Math.random() * 60 - 30),
    };
  }

  return { x: 0, y: 0 };
}

/**
 * Create a node from a NodeDef type key and add it to a canvas.
 * Generates a unique display name and either uses the provided position
 * or places it at the viewport center with a small random offset.
 */
export function createNodeFromType(
  canvasId: string,
  typeKey: string,
  position?: { x: number; y: number },
): void {
  const canvas = useFileStore.getState().getCanvas(canvasId);

  const nodeDef = useRegistryStore.getState().resolve(typeKey);
  const baseName = nodeDef?.metadata.displayName ?? typeKey.split('/').pop() ?? 'Node';

  const sameTypeCount = (canvas?.data.nodes ?? []).filter(
    (n) => 'type' in n && n.type === typeKey,
  ).length;
  const displayName = sameTypeCount === 0 ? baseName : `${baseName} ${sameTypeCount + 1}`;

  const finalPosition = position ?? viewportCenterPosition();

  const newNode: Node = {
    id: `node-${crypto.randomUUID().slice(0, 8)}`,
    type: typeKey,
    displayName,
    position: finalPosition,
  };

  useGraphStore.getState().addNode(canvasId, newNode);
}

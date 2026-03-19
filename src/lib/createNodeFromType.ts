import type { Node } from '@/types';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';

/**
 * Create a node from a NodeDef type key and add it to a canvas.
 * Generates a unique display name and either uses the provided position
 * or falls back to staggered grid placement.
 */
export function createNodeFromType(
  canvasId: string,
  typeKey: string,
  position?: { x: number; y: number },
): void {
  const canvas = useFileStore.getState().getCanvas(canvasId);
  const existingCount = canvas?.data.nodes?.length ?? 0;

  const nodeDef = useRegistryStore.getState().resolve(typeKey);
  const baseName = nodeDef?.metadata.displayName ?? typeKey.split('/').pop() ?? 'Node';

  const sameTypeCount = (canvas?.data.nodes ?? []).filter(
    (n) => 'type' in n && n.type === typeKey,
  ).length;
  const displayName = sameTypeCount === 0 ? baseName : `${baseName} ${sameTypeCount + 1}`;

  const finalPosition = position ?? {
    x: (existingCount % 2) * 300,
    y: Math.floor(existingCount / 2) * 200,
  };

  const newNode: Node = {
    id: `node-${crypto.randomUUID().slice(0, 8)}`,
    type: typeKey,
    displayName,
    position: finalPosition,
  };

  useGraphStore.getState().addNode(canvasId, newNode);
}

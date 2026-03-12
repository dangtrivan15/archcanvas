import { useCallback } from 'react';
import type { NodeChange, Connection } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { useGraphStore } from '@/store/graphStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

export function useCanvasInteractions() {
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (
        change.type === 'position' &&
        change.position &&
        change.dragging === false
      ) {
        useGraphStore
          .getState()
          .updateNodePosition(ROOT_CANVAS_KEY, change.id, change.position);
      }
    }
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    useCanvasStore.getState().selectNodes([node.id]);
  }, []);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { source: string; target: string }) => {
      useCanvasStore.getState().selectEdge(edge.source, edge.target);
    },
    [],
  );

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      useCanvasStore.getState().completeDraftEdge({ node: connection.target });
    }
  }, []);

  const onPaneClick = useCallback(() => {
    useCanvasStore.getState().clearSelection();
  }, []);

  return { onNodesChange, onNodeClick, onEdgeClick, onConnect, onPaneClick };
}

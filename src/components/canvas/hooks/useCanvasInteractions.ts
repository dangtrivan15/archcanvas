import { useCallback } from 'react';
import type { Node as RFNode, NodeChange, Connection } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { useGraphStore } from '@/store/graphStore';
import { useNavigationStore } from '@/store/navigationStore';
import type { CanvasNodeData } from '../types';

export function useCanvasInteractions() {
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    for (const change of changes) {
      if (
        change.type === 'position' &&
        change.position &&
        change.dragging === false
      ) {
        useGraphStore
          .getState()
          .updateNodePosition(canvasId, change.id, change.position);
      }
    }
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: RFNode<CanvasNodeData>) => {
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
      useCanvasStore.getState().completeDraftEdge(
        { node: connection.target },
        { node: connection.source },
      );
    }
  }, []);

  const onConnectStart = useCallback(
    (_: MouseEvent | TouchEvent, params: { nodeId: string | null }) => {
      if (params.nodeId) {
        useCanvasStore.getState().startDraftEdge({ node: params.nodeId });
      }
    },
    [],
  );

  const onConnectEnd = useCallback(() => {
    const { draftEdge } = useCanvasStore.getState();
    if (draftEdge) {
      useCanvasStore.getState().cancelDraftEdge();
    }
  }, []);

  const onPaneClick = useCallback(() => {
    useCanvasStore.getState().clearSelection();
  }, []);

  return {
    onNodesChange, onNodeClick, onEdgeClick,
    onConnect, onConnectStart, onConnectEnd, onPaneClick,
  };
}

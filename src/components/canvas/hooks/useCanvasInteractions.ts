import { useCallback } from 'react';
import type { Node as RFNode, Connection } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import type { CanvasNodeData } from '../types';

export function useCanvasInteractions() {
  // NOTE: onNodesChange is handled in Canvas.tsx (needs applyNodeChanges +
  // local state for smooth drag). This hook only handles click/connect events.

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
      const canvasId = useNavigationStore.getState().currentCanvasId;
      useCanvasStore.getState().completeDraftEdge(
        canvasId,
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
    useCanvasStore.getState().clearHighlight();
  }, []);

  return {
    onNodeClick, onEdgeClick,
    onConnect, onConnectStart, onConnectEnd, onPaneClick,
  };
}

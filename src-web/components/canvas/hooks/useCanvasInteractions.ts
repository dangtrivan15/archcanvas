import { useCallback } from 'react';
import type { Node as RFNode, Connection } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import type { CanvasNodeData } from '../types';

export function useCanvasInteractions() {
  // NOTE: onNodesChange is handled in Canvas.tsx (needs applyNodeChanges +
  // local state for smooth drag). This hook only handles click/connect events.

  const onNodeClick = useCallback((event: React.MouseEvent, node: RFNode<CanvasNodeData>) => {
    const isMulti = event.shiftKey || event.metaKey || event.ctrlKey;
    if (isMulti) {
      // Toggle-additive: add or remove this node from the current selection
      const { selectedNodeIds, selectedEdgeKeys } = useCanvasStore.getState();
      // If there are selected edges, clear them and start fresh with node selection
      if (selectedEdgeKeys.size > 0) {
        useCanvasStore.getState().selectNodes([node.id]);
        return;
      }
      const next = new Set(selectedNodeIds);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      useCanvasStore.getState().selectNodes([...next]);
    } else {
      useCanvasStore.getState().selectNodes([node.id]);
    }
  }, []);

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: { source: string; target: string }) => {
      const isMulti = event.shiftKey || event.metaKey || event.ctrlKey;
      if (isMulti) {
        // Toggle-additive: add or remove this edge from the current selection
        const { selectedEdgeKeys, selectedNodeIds } = useCanvasStore.getState();
        // If there are selected nodes, clear them and start fresh with edge selection
        if (selectedNodeIds.size > 0) {
          useCanvasStore.getState().selectEdge(edge.source, edge.target);
          return;
        }
        const edgeKey = `${edge.source}→${edge.target}`;
        const next = new Set(selectedEdgeKeys);
        if (next.has(edgeKey)) {
          next.delete(edgeKey);
        } else {
          next.add(edgeKey);
        }
        // Use setState directly for multi-edge selection (selectEdge only accepts a single edge)
        useCanvasStore.setState({ selectedEdgeKeys: next, selectedNodeIds: new Set() });
      } else {
        useCanvasStore.getState().selectEdge(edge.source, edge.target);
      }
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

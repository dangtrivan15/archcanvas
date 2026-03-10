/**
 * Graph store - manages the architecture graph state and all graph mutations.
 *
 * Owns: graph, isDirty, nodeCount, edgeCount
 * Actions: addNode, removeNode, updateNode, addEdge, updateEdge, removeEdge,
 *          addNote, removeNote, updateNote, addCodeRef, updateNodeColor,
 *          moveNode, moveNodes, duplicateSelection, addAnnotation,
 *          removeAnnotation, clearAnnotations, _setGraph, setDirty
 */

import { create } from 'zustand';
import type { ArchGraph, ArchNode, ArchEdge, Note, PropertyMap, Annotation } from '@/types/graph';
import type {
  AddNodeParams,
  AddEdgeParams,
  AddNoteParams,
  AddCodeRefParams,
  UpdateNodeParams,
} from '@/types/api';
import { createEmptyGraph, moveNode as engineMoveNode } from '@/core/graph/graphEngine';
import { countAllNodes } from '@/core/graph/graphQuery';
import { useEngineStore } from './engineStore';
import { useHistoryStore } from './historyStore';
import { useNavigationStore } from './navigationStore';
import { useCanvasStore } from './canvasStore';
import { applyElkLayout } from '@/core/layout/elkLayout';

export interface GraphStoreState {
  /** The current architecture graph (nodes, edges, annotations) */
  graph: ArchGraph;
  /** Whether the graph has unsaved changes since last save/open */
  isDirty: boolean;
  /** Total node count including nested children (derived, updated on mutations) */
  nodeCount: number;
  /** Total edge count (derived, updated on mutations) */
  edgeCount: number;

  // Graph mutations
  addNode: (params: AddNodeParams) => ArchNode | undefined;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, params: UpdateNodeParams) => void;
  addEdge: (params: AddEdgeParams) => ArchEdge | undefined;
  updateEdge: (
    edgeId: string,
    updates: Partial<Pick<ArchEdge, 'type' | 'label' | 'properties'>>,
    snapshotDescription?: string,
  ) => void;
  removeEdge: (edgeId: string) => void;
  addNote: (params: AddNoteParams) => Note | undefined;
  removeNote: (nodeId: string, noteId: string) => void;
  updateNote: (nodeId: string, noteId: string, content: string) => void;
  addCodeRef: (params: AddCodeRefParams) => void;
  updateNodeColor: (nodeId: string, color: string | undefined) => void;
  moveNode: (nodeId: string, x: number, y: number) => void;
  moveNodes: (
    moves: Array<{ nodeId: string; x: number; y: number }>,
    snapshotDescription?: string,
  ) => void;
  duplicateSelection: (nodeIds: string[]) => string[];

  // Annotations
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (annotationId: string) => void;
  clearAnnotations: (nodeId?: string) => void;

  // Layout
  autoLayout: (direction: 'horizontal' | 'vertical', navigationPath?: string[]) => Promise<void>;

  // Internal
  _setGraph: (graph: ArchGraph) => void;
  setDirty: (dirty: boolean) => void;
}

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  graph: createEmptyGraph(),
  isDirty: false,
  nodeCount: 0,
  edgeCount: 0,

  addNode: (params) => {
    const { textApi, undoManager, registry } = useEngineStore.getState();
    if (!textApi || !undoManager) return undefined;

    // Pre-fill default values from nodedef for args not explicitly provided
    if (registry) {
      const nodeDef = registry.resolve(params.type);
      if (nodeDef && nodeDef.spec.args.length > 0) {
        const defaults: PropertyMap = {};
        for (const argDef of nodeDef.spec.args) {
          if (argDef.default !== undefined) {
            defaults[argDef.name] = argDef.default;
          }
        }
        params = { ...params, args: { ...defaults, ...params.args } };
      }
    }

    const node = textApi.addNode(params);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Add node', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      nodeCount: countAllNodes(updatedGraph),
      edgeCount: updatedGraph.edges.length,
    });

    // Trigger auto-layout to incorporate the new node
    const navigationPath = useNavigationStore.getState().path;
    setTimeout(() => {
      get()
        .autoLayout('horizontal', navigationPath)
        .then(() => {
          useCanvasStore.getState().requestFitView();
          console.log('[GraphStore] Auto-layout after addNode complete');
        })
        .catch((err: unknown) => {
          console.warn('[GraphStore] Auto-layout after addNode failed:', err);
        });
    }, 0);

    return node;
  },

  removeNode: (nodeId) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    textApi.removeNode(nodeId);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Remove node', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      nodeCount: countAllNodes(updatedGraph),
      edgeCount: updatedGraph.edges.length,
    });
  },

  updateNode: (nodeId, params) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    textApi.updateNode(nodeId, params);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Update node', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
    });
  },

  addEdge: (params) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return undefined;

    const edge = textApi.addEdge(params);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Add edge', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      edgeCount: updatedGraph.edges.length,
    });

    return edge;
  },

  updateEdge: (edgeId, updates, snapshotDescription) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    textApi.updateEdge(edgeId, updates);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot(snapshotDescription || 'Update edge', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
    });
  },

  removeEdge: (edgeId) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    textApi.removeEdge(edgeId);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Remove edge', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      edgeCount: updatedGraph.edges.length,
    });
  },

  addNote: (params) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return undefined;

    const note = textApi.addNote(params);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Add note', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
    });

    return note;
  },

  removeNote: (nodeId, noteId) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    textApi.removeNote(nodeId, noteId);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Remove note', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
    });
  },

  updateNote: (nodeId, noteId, content) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    textApi.updateNote(nodeId, noteId, content);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Edit note', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
    });
  },

  addCodeRef: (params) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    textApi.addCodeRef(params);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Add code reference', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
    });
  },

  updateNodeColor: (nodeId, color) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    textApi.updateNodeColor(nodeId, color);
    const updatedGraph = textApi.getGraph();
    useHistoryStore.getState().pushSnapshot('Update node color', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
    });
  },

  moveNode: (nodeId, x, y) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    // Don't snapshot on move (too frequent), just update position
    const { graph } = get();
    const updatedGraph = engineMoveNode(graph, nodeId, x, y);
    textApi.setGraph(updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
    });
  },

  moveNodes: (moves, snapshotDescription) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi || moves.length === 0) return;

    let currentGraph = get().graph;
    for (const { nodeId, x, y } of moves) {
      const clampedX = Math.max(0, x);
      const clampedY = Math.max(0, y);
      currentGraph = engineMoveNode(currentGraph, nodeId, clampedX, clampedY);
    }
    textApi.setGraph(currentGraph);

    const desc = snapshotDescription || `Move ${moves.length} node(s)`;
    useHistoryStore.getState().pushSnapshot(desc, currentGraph);

    set({
      graph: currentGraph,
      isDirty: true,
    });
  },

  duplicateSelection: (nodeIds) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi || nodeIds.length === 0) return [];

    const { graph } = get();
    const OFFSET = 50;
    const nodeIdSet = new Set(nodeIds);

    function findNode(nodes: ArchNode[], id: string): ArchNode | undefined {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children.length > 0) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return undefined;
    }

    const sourceNodes: ArchNode[] = [];
    for (const id of nodeIds) {
      const node = findNode(graph.nodes, id);
      if (node) sourceNodes.push(node);
    }
    if (sourceNodes.length === 0) return [];

    const idMap = new Map<string, string>();
    const newNodeIds: string[] = [];

    for (const node of sourceNodes) {
      const newNode = textApi.addNode({
        type: node.type,
        displayName: `${node.displayName} (copy)`,
        position: {
          x: node.position.x + OFFSET,
          y: node.position.y + OFFSET,
        },
        args: { ...node.args },
      });
      if (newNode) {
        idMap.set(node.id, newNode.id);
        newNodeIds.push(newNode.id);
      }
    }

    // Duplicate internal edges
    if (nodeIds.length > 1) {
      for (const edge of graph.edges) {
        if (nodeIdSet.has(edge.fromNode) && nodeIdSet.has(edge.toNode)) {
          const newFromId = idMap.get(edge.fromNode);
          const newToId = idMap.get(edge.toNode);
          if (newFromId && newToId) {
            textApi.addEdge({
              fromNode: newFromId,
              toNode: newToId,
              type: edge.type,
              label: edge.label,
            });
          }
        }
      }
    }

    const updatedGraph = textApi.getGraph();
    const count = newNodeIds.length;
    useHistoryStore.getState().pushSnapshot(
      `Duplicate ${count} node${count === 1 ? '' : 's'}`,
      updatedGraph,
    );

    set({
      graph: updatedGraph,
      isDirty: true,
      nodeCount: countAllNodes(updatedGraph),
      edgeCount: updatedGraph.edges.length,
    });

    return newNodeIds;
  },

  // ─── Annotation Mutations ────────────────────────────────────

  addAnnotation: (annotation) => {
    const { graph } = get();
    const updatedGraph: ArchGraph = {
      ...graph,
      annotations: [...(graph.annotations ?? []), annotation],
    };
    set({ graph: updatedGraph, isDirty: true });
  },

  removeAnnotation: (annotationId) => {
    const { graph } = get();
    const updatedGraph: ArchGraph = {
      ...graph,
      annotations: (graph.annotations ?? []).filter((a) => a.id !== annotationId),
    };
    set({ graph: updatedGraph, isDirty: true });
  },

  clearAnnotations: (nodeId?: string) => {
    const { graph } = get();
    const updatedGraph: ArchGraph = {
      ...graph,
      annotations: nodeId ? (graph.annotations ?? []).filter((a) => a.nodeId !== nodeId) : [],
    };
    set({ graph: updatedGraph, isDirty: true });
  },

  /**
   * Auto-layout nodes using the ELK layered algorithm.
   */
  autoLayout: async (direction, navigationPath = []) => {
    const { textApi } = useEngineStore.getState();
    if (!textApi) return;

    const { graph } = get();

    try {
      const layoutSpacing = useCanvasStore.getState().layoutSpacing;
      const spacing = layoutSpacing
        ? {
            nodeSpacing: layoutSpacing.nodeSpacing,
            layerSpacing: layoutSpacing.layerSpacing,
          }
        : undefined;

      const updatedGraph = await applyElkLayout(graph, direction, navigationPath, spacing);
      textApi.setGraph(updatedGraph);
      useHistoryStore.getState().pushSnapshot('Auto-layout', updatedGraph);

      set({
        graph: updatedGraph,
        isDirty: true,
      });

      console.log('[GraphStore] Auto-layout applied:', direction, 'spacing:', spacing);
    } catch (error) {
      console.error('[GraphStore] Auto-layout failed:', error);
    }
  },

  _setGraph: (graph) => {
    const { textApi } = useEngineStore.getState();
    if (textApi) {
      textApi.setGraph(graph);
    }
    set({
      graph,
      nodeCount: countAllNodes(graph),
      edgeCount: graph.edges.length,
    });
  },

  setDirty: (dirty) => {
    set({ isDirty: dirty });
  },
}));

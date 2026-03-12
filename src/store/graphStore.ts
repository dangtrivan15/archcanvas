import { create } from 'zustand';
import type { Node, Edge, Entity, Position } from '@/types';
import type { EngineResult } from '@/core/graph/types';
import type { InlineNodeUpdates, EdgeUpdates, EntityUpdates } from '@/core/graph/engine';
import {
  addNode as engineAddNode,
  removeNode as engineRemoveNode,
  updateNode as engineUpdateNode,
  updateNodePosition as engineUpdateNodePosition,
  addEdge as engineAddEdge,
  removeEdge as engineRemoveEdge,
  updateEdge as engineUpdateEdge,
  addEntity as engineAddEntity,
  removeEntity as engineRemoveEntity,
  updateEntity as engineUpdateEntity,
} from '@/core/graph/engine';
import { useFileStore } from './fileStore';
import { useRegistryStore } from './registryStore';

interface GraphStoreState {
  addNode(canvasId: string, node: Node): EngineResult;
  removeNode(canvasId: string, nodeId: string): EngineResult;
  updateNode(canvasId: string, nodeId: string, updates: InlineNodeUpdates): EngineResult;
  updateNodePosition(canvasId: string, nodeId: string, position: Position): EngineResult;
  addEdge(canvasId: string, edge: Edge): EngineResult;
  removeEdge(canvasId: string, from: string, to: string): EngineResult;
  updateEdge(canvasId: string, from: string, to: string, updates: EdgeUpdates): EngineResult;
  addEntity(canvasId: string, entity: Entity): EngineResult;
  removeEntity(canvasId: string, entityName: string): EngineResult;
  updateEntity(canvasId: string, entityName: string, updates: EntityUpdates): EngineResult;
}

function getCanvas(canvasId: string): EngineResult | undefined {
  const canvas = useFileStore.getState().getCanvas(canvasId);
  if (!canvas) {
    return { ok: false, error: { code: 'CANVAS_NOT_FOUND', canvasId } };
  }
  return undefined;
}

function applyResult(canvasId: string, result: EngineResult): EngineResult {
  if (result.ok) {
    useFileStore.getState().updateCanvasData(canvasId, result.data);
  }
  return result;
}

export const useGraphStore = create<GraphStoreState>(() => ({
  addNode(canvasId, node) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const registry = useRegistryStore.getState().registry ?? undefined;
    const result = engineAddNode(canvas.data, node, registry);
    return applyResult(canvasId, result);
  },

  removeNode(canvasId, nodeId) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const result = engineRemoveNode(canvas.data, nodeId);
    return applyResult(canvasId, result);
  },

  updateNode(canvasId, nodeId, updates) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const registry = useRegistryStore.getState().registry ?? undefined;
    const result = engineUpdateNode(canvas.data, nodeId, updates, registry);
    return applyResult(canvasId, result);
  },

  updateNodePosition(canvasId, nodeId, position) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const result = engineUpdateNodePosition(canvas.data, nodeId, position);
    return applyResult(canvasId, result);
  },

  addEdge(canvasId, edge) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const registry = useRegistryStore.getState().registry ?? undefined;
    const result = engineAddEdge(canvas.data, edge, registry);
    return applyResult(canvasId, result);
  },

  removeEdge(canvasId, from, to) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const result = engineRemoveEdge(canvas.data, from, to);
    return applyResult(canvasId, result);
  },

  updateEdge(canvasId, from, to, updates) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const result = engineUpdateEdge(canvas.data, from, to, updates);
    return applyResult(canvasId, result);
  },

  addEntity(canvasId, entity) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const result = engineAddEntity(canvas.data, entity);
    return applyResult(canvasId, result);
  },

  removeEntity(canvasId, entityName) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const result = engineRemoveEntity(canvas.data, entityName);
    return applyResult(canvasId, result);
  },

  updateEntity(canvasId, entityName, updates) {
    const notFound = getCanvas(canvasId);
    if (notFound) return notFound;

    const canvas = useFileStore.getState().getCanvas(canvasId)!;
    const result = engineUpdateEntity(canvas.data, entityName, updates);
    return applyResult(canvasId, result);
  },
}));

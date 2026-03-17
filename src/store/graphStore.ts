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
import { useHistoryStore } from './historyStore';
import type { Canvas } from '@/types';

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
  createSubsystem(
    parentCanvasId: string,
    input: { id: string; type: string; displayName?: string },
  ): EngineResult;
}

type ResolveResult =
  | { data: Canvas; error?: undefined }
  | { data?: undefined; error: EngineResult };

function resolveCanvas(canvasId: string): ResolveResult {
  const canvas = useFileStore.getState().getCanvas(canvasId);
  if (!canvas) {
    return { error: { ok: false, error: { code: 'CANVAS_NOT_FOUND', canvasId } } };
  }
  return { data: canvas.data };
}

// null → undefined: engine accepts NodeDefRegistry | undefined
function getRegistry() {
  return useRegistryStore.getState().registry ?? undefined;
}

function applyResult(canvasId: string, result: EngineResult): EngineResult {
  if (result.ok) {
    useFileStore.getState().updateCanvasData(canvasId, result.data);
    useHistoryStore.getState().pushPatches(canvasId, result.patches, result.inversePatches);
  }
  return result;
}

export const useGraphStore = create<GraphStoreState>(() => ({
  addNode(canvasId, node) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineAddNode(resolved.data, node, getRegistry()));
  },

  removeNode(canvasId, nodeId) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineRemoveNode(resolved.data, nodeId));
  },

  updateNode(canvasId, nodeId, updates) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineUpdateNode(resolved.data, nodeId, updates, getRegistry()));
  },

  updateNodePosition(canvasId, nodeId, position) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineUpdateNodePosition(resolved.data, nodeId, position));
  },

  addEdge(canvasId, edge) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineAddEdge(resolved.data, edge, getRegistry()));
  },

  removeEdge(canvasId, from, to) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineRemoveEdge(resolved.data, from, to));
  },

  updateEdge(canvasId, from, to, updates) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineUpdateEdge(resolved.data, from, to, updates));
  },

  addEntity(canvasId, entity) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineAddEntity(resolved.data, entity));
  },

  removeEntity(canvasId, entityName) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineRemoveEntity(resolved.data, entityName));
  },

  updateEntity(canvasId, entityName, updates) {
    const resolved = resolveCanvas(canvasId);
    if (resolved.error) return resolved.error;
    return applyResult(canvasId, engineUpdateEntity(resolved.data, entityName, updates));
  },

  createSubsystem(parentCanvasId, input) {
    // 1. Resolve parent canvas
    const resolved = resolveCanvas(parentCanvasId);
    if (resolved.error) return resolved.error;

    // 2. Validate type against registry
    const registry = getRegistry();
    const nodeDef = registry?.resolve(input.type);
    if (!nodeDef) {
      return { ok: false, error: { code: 'UNKNOWN_SUBSYSTEM_TYPE' as const, type: input.type } };
    }
    const displayName = input.displayName ?? nodeDef.metadata.displayName;

    // 3. Register child canvas in fileStore (check canvas collision first)
    const childData = {
      id: input.id,
      type: input.type,
      displayName,
      nodes: [] as any[],
      edges: [] as any[],
    };
    const regResult = useFileStore.getState().registerCanvas(
      input.id,
      `.archcanvas/${input.id}.yaml`,
      childData,
    );
    if (!regResult.ok) {
      return { ok: false, error: regResult.error };
    }

    // 5. Add RefNode to parent canvas
    const refNode = { id: input.id, ref: `${input.id}.yaml` };
    const engineResult = engineAddNode(resolved.data, refNode, getRegistry());

    // 6. Apply result (marks parent dirty + pushes undo patches)
    const applied = applyResult(parentCanvasId, engineResult);

    // 7. Mark child dirty (for persistence on save)
    if (applied.ok) {
      useFileStore.getState().markDirty(input.id);
    }

    return applied;
  },
}));

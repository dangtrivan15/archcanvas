import { produceWithPatches } from 'immer';
import type {
  CanvasFile,
  InlineNode,
  Edge,
  Entity,
  Position,
  Node,
} from '@/types';
import type { NodeDefRegistry } from '@/core/registry/core';
import type { EngineResult, EngineWarning } from './types';
import { validateNode, validateEdge } from './validation';

// --- Node Operations ---

export function addNode(
  canvas: CanvasFile,
  node: Node,
  registry?: NodeDefRegistry,
): EngineResult {
  const nodes = canvas.nodes ?? [];

  if (nodes.some((n) => n.id === node.id)) {
    return { ok: false, error: { code: 'DUPLICATE_NODE_ID', nodeId: node.id } };
  }

  const warnings: EngineWarning[] = [];
  if (!('ref' in node) && registry) {
    warnings.push(...validateNode(node, registry));
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    (draft.nodes ??= []).push(node);
  });

  return { ok: true, data, patches, inversePatches, warnings };
}

export function removeNode(
  canvas: CanvasFile,
  nodeId: string,
): EngineResult {
  const nodes = canvas.nodes ?? [];

  if (!nodes.some((n) => n.id === nodeId)) {
    return { ok: false, error: { code: 'NODE_NOT_FOUND', nodeId } };
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    draft.nodes = (draft.nodes ?? []).filter((n) => n.id !== nodeId);
    draft.edges = (draft.edges ?? []).filter(
      (e) => e.from.node !== nodeId && e.to.node !== nodeId,
    );
  });

  return { ok: true, data, patches, inversePatches, warnings: [] };
}

export type InlineNodeUpdates = Partial<
  Pick<InlineNode, 'displayName' | 'description' | 'args' | 'position' | 'codeRefs' | 'notes'>
>;

export function updateNode(
  canvas: CanvasFile,
  nodeId: string,
  updates: InlineNodeUpdates,
  registry?: NodeDefRegistry,
): EngineResult {
  const nodes = canvas.nodes ?? [];
  const node = nodes.find((n) => n.id === nodeId);

  if (!node) {
    return { ok: false, error: { code: 'NODE_NOT_FOUND', nodeId } };
  }

  if ('ref' in node) {
    return { ok: false, error: { code: 'INVALID_REF_NODE_UPDATE' } };
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    const target = (draft.nodes ?? []).find((n) => n.id === nodeId)!;
    Object.assign(target, updates);
  });

  const warnings: EngineWarning[] = [];
  if (registry && 'args' in updates) {
    const updatedNode = (data.nodes ?? []).find((n) => n.id === nodeId)!;
    warnings.push(...validateNode(updatedNode, registry));
  }

  return { ok: true, data, patches, inversePatches, warnings };
}

export function updateNodePosition(
  canvas: CanvasFile,
  nodeId: string,
  position: Position,
): EngineResult {
  const nodes = canvas.nodes ?? [];

  if (!nodes.some((n) => n.id === nodeId)) {
    return { ok: false, error: { code: 'NODE_NOT_FOUND', nodeId } };
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    const target = (draft.nodes ?? []).find((n) => n.id === nodeId)!;
    target.position = position;
  });

  return { ok: true, data, patches, inversePatches, warnings: [] };
}

// --- Edge Operations ---

export function addEdge(
  canvas: CanvasFile,
  edge: Edge,
  registry?: NodeDefRegistry,
): EngineResult {
  const nodes = canvas.nodes ?? [];
  const edges = canvas.edges ?? [];

  // Check endpoints exist (skip @root/ prefixed ones)
  for (const side of ['from', 'to'] as const) {
    const endpoint = edge[side];
    if (!endpoint.node.startsWith('@root/')) {
      if (!nodes.some((n) => n.id === endpoint.node)) {
        return {
          ok: false,
          error: { code: 'EDGE_ENDPOINT_NOT_FOUND', endpoint: endpoint.node, side },
        };
      }
    }
  }

  // Self-loop check — raw string comparison is intentional. @root/svc-a and svc-a
  // are different nodes in different scopes (root vs local), so they are not a self-loop.
  if (edge.from.node === edge.to.node) {
    return { ok: false, error: { code: 'SELF_LOOP', nodeId: edge.from.node } };
  }

  // Duplicate check
  if (edges.some((e) => e.from.node === edge.from.node && e.to.node === edge.to.node)) {
    return {
      ok: false,
      error: { code: 'DUPLICATE_EDGE', from: edge.from.node, to: edge.to.node },
    };
  }

  const warnings: EngineWarning[] = [];
  if (registry) {
    warnings.push(...validateEdge(edge, canvas, registry));
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    (draft.edges ??= []).push(edge);
  });

  return { ok: true, data, patches, inversePatches, warnings };
}

export function removeEdge(
  canvas: CanvasFile,
  from: string,
  to: string,
): EngineResult {
  const edges = canvas.edges ?? [];

  if (!edges.some((e) => e.from.node === from && e.to.node === to)) {
    return { ok: false, error: { code: 'EDGE_NOT_FOUND', from, to } };
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    draft.edges = (draft.edges ?? []).filter(
      (e) => !(e.from.node === from && e.to.node === to),
    );
  });

  return { ok: true, data, patches, inversePatches, warnings: [] };
}

export type EdgeUpdates = Partial<Pick<Edge, 'protocol' | 'label' | 'entities' | 'notes'>>;

export function updateEdge(
  canvas: CanvasFile,
  from: string,
  to: string,
  updates: EdgeUpdates,
): EngineResult {
  const edges = canvas.edges ?? [];

  if (!edges.some((e) => e.from.node === from && e.to.node === to)) {
    return { ok: false, error: { code: 'EDGE_NOT_FOUND', from, to } };
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    const target = (draft.edges ?? []).find(
      (e) => e.from.node === from && e.to.node === to,
    )!;
    Object.assign(target, updates);
  });

  return { ok: true, data, patches, inversePatches, warnings: [] };
}

// --- Entity Operations ---

export function addEntity(
  canvas: CanvasFile,
  entity: Entity,
): EngineResult {
  const entities = canvas.entities ?? [];

  if (entities.some((e) => e.name === entity.name)) {
    return { ok: false, error: { code: 'DUPLICATE_ENTITY', name: entity.name } };
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    (draft.entities ??= []).push(entity);
  });

  return { ok: true, data, patches, inversePatches, warnings: [] };
}

export function removeEntity(
  canvas: CanvasFile,
  entityName: string,
): EngineResult {
  const entities = canvas.entities ?? [];

  if (!entities.some((e) => e.name === entityName)) {
    return { ok: false, error: { code: 'ENTITY_NOT_FOUND', name: entityName } };
  }

  // Check if any edges reference this entity
  const edges = canvas.edges ?? [];
  const referencedBy = edges
    .filter((e) => (e.entities ?? []).includes(entityName))
    .map((e) => ({ from: e.from.node, to: e.to.node }));

  if (referencedBy.length > 0) {
    return {
      ok: false,
      error: { code: 'ENTITY_IN_USE', name: entityName, referencedBy },
    };
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    draft.entities = (draft.entities ?? []).filter((e) => e.name !== entityName);
  });

  return { ok: true, data, patches, inversePatches, warnings: [] };
}

export type EntityUpdates = Partial<Pick<Entity, 'description' | 'codeRefs'>>;

export function updateEntity(
  canvas: CanvasFile,
  entityName: string,
  updates: EntityUpdates,
): EngineResult {
  const entities = canvas.entities ?? [];

  if (!entities.some((e) => e.name === entityName)) {
    return { ok: false, error: { code: 'ENTITY_NOT_FOUND', name: entityName } };
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    const target = (draft.entities ?? []).find((e) => e.name === entityName)!;
    Object.assign(target, updates);
  });

  return { ok: true, data, patches, inversePatches, warnings: [] };
}

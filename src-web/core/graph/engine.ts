import { produceWithPatches } from 'immer';
import type {
  Canvas,
  InlineNode,
  Edge,
  Entity,
  Position,
  Node,
} from '@/types';
import type { NodeDefRegistry } from '@/core/registry/core';
import type { EngineResult, EngineWarning } from './types';
import { validateNode, validateEdge } from './validation';
import { arePortsCompatible } from '../protocol/compatibility';

// --- Node Operations ---

export function addNode(
  canvas: Canvas,
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
  canvas: Canvas,
  nodeId: string,
): EngineResult {
  const nodes = canvas.nodes ?? [];

  if (!nodes.some((n) => n.id === nodeId)) {
    return { ok: false, error: { code: 'NODE_NOT_FOUND', nodeId } };
  }

  const [data, patches, inversePatches] = produceWithPatches(canvas, (draft) => {
    draft.nodes = (draft.nodes ?? []).filter((n) => n.id !== nodeId);
    draft.edges = (draft.edges ?? []).filter(
      (e) => e.from.node !== nodeId && e.to.node !== nodeId &&
        !e.from.node.startsWith(`@${nodeId}/`) && !e.to.node.startsWith(`@${nodeId}/`),
    );
  });

  return { ok: true, data, patches, inversePatches, warnings: [] };
}

export type InlineNodeUpdates = Partial<
  Pick<InlineNode, 'displayName' | 'description' | 'args' | 'position' | 'codeRefs' | 'notes'>
>;

export function updateNode(
  canvas: Canvas,
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
  canvas: Canvas,
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
  canvas: Canvas,
  edge: Edge,
  registry?: NodeDefRegistry,
): EngineResult {
  const nodes = canvas.nodes ?? [];
  const edges = canvas.edges ?? [];

  // Check endpoints exist (validate @ cross-scope refs against ref-nodes)
  for (const side of ['from', 'to'] as const) {
    const endpoint = edge[side];
    if (endpoint.node.startsWith('@')) {
      const slashIdx = endpoint.node.indexOf('/');
      if (slashIdx === -1) {
        return {
          ok: false,
          error: { code: 'INVALID_CROSS_SCOPE_REF', message: `Invalid cross-scope ref '${endpoint.node}' — missing /nodeId` },
        };
      }
      const refNodeId = endpoint.node.slice(1, slashIdx);
      const refNode = nodes.find((n) => n.id === refNodeId && 'ref' in n);
      if (!refNode) {
        return {
          ok: false,
          error: { code: 'CROSS_SCOPE_REF_NOT_FOUND', message: `Ref-node '${refNodeId}' not found in canvas` },
        };
      }
    } else {
      if (!nodes.some((n) => n.id === endpoint.node)) {
        return {
          ok: false,
          error: { code: 'EDGE_ENDPOINT_NOT_FOUND', endpoint: endpoint.node, side },
        };
      }
    }
  }

  // Protocol compatibility check (only when both ports specified and registry available)
  if (edge.from.port && edge.to.port && registry) {
    // Only check local nodes (cross-scope port resolution requires loading the remote canvas)
    if (!edge.from.node.startsWith('@') && !edge.to.node.startsWith('@')) {
      const fromNode = nodes.find((n) => n.id === edge.from.node);
      const toNode = nodes.find((n) => n.id === edge.to.node);

      if (fromNode && !('ref' in fromNode) && toNode && !('ref' in toNode)) {
        const fromDef = registry.resolve(fromNode.type);
        const toDef = registry.resolve(toNode.type);

        if (fromDef && toDef) {
          const fromPortDef = (fromDef.spec.ports ?? []).find(
            (p) => p.name === edge.from.port,
          );
          const toPortDef = (toDef.spec.ports ?? []).find(
            (p) => p.name === edge.to.port,
          );

          const compat = arePortsCompatible(fromPortDef, toPortDef);
          if (!compat.compatible) {
            return {
              ok: false,
              error: {
                code: 'PROTOCOL_MISMATCH',
                message: `Port '${compat.fromPortName}' [${compat.fromProtocols?.join(', ')}] → '${compat.toPortName}' [${compat.toProtocols?.join(', ')}] — no common protocol`,
              },
            };
          }
        }
      }
    }
  }

  // Self-loop check — raw string comparison is intentional. @ref/svc-a and svc-a
  // are different nodes in different scopes, so they are not a self-loop.
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
  canvas: Canvas,
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
  canvas: Canvas,
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
  canvas: Canvas,
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
  canvas: Canvas,
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
  canvas: Canvas,
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

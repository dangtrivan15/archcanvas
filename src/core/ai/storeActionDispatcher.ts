/**
 * Store action dispatcher — translates AI tool actions into Zustand store calls.
 *
 * Provider-agnostic: used by both the WebSocket bridge provider (Claude Code)
 * and future in-browser providers (API key, etc.) that handle tool execution
 * directly.
 *
 * Each action name maps to a function that reads/writes Zustand stores and
 * returns a result. Write actions mutate via graphStore; read actions query
 * fileStore/graphStore/registryStore.
 */

import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import type { Node, Edge, Entity } from '@/types/schema';
import { validateAndBuildNode } from '@/core/validation/addNodeValidation';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StoreActionError {
  ok: false;
  error: { code: string; message: string };
}

/**
 * Dispatch a named store action with the given args.
 * Returns the action result (shape varies per action), or an error object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dispatchStoreAction(action: string, args: Record<string, unknown>): unknown {
  switch (action) {
    // --- Write actions ---
    case 'addNode':
      return dispatchAddNode(args);
    case 'addEdge':
      return useGraphStore.getState().addEdge(args.canvasId as string, args.edge as any);
    case 'removeNode':
      return useGraphStore.getState().removeNode(args.canvasId as string, args.nodeId as string);
    case 'removeEdge':
      return useGraphStore.getState().removeEdge(args.canvasId as string, args.from as string, args.to as string);
    case 'import':
      return dispatchImport(args);
    case 'createSubsystem':
      return useGraphStore.getState().createSubsystem(
        args.canvasId as string,
        {
          id: args.id as string,
          type: args.type as string,
          displayName: args.name as string | undefined,
        },
      );

    // --- Read actions ---
    case 'list':
      return dispatchList(args);
    case 'describe':
      return dispatchDescribe(args);
    case 'search':
      return dispatchSearch(args);
    case 'catalog':
      return dispatchCatalog(args);

    default:
      return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } };
  }
}

// ---------------------------------------------------------------------------
// Write action dispatchers
// ---------------------------------------------------------------------------

/**
 * addNode with enrichment: validates type against registry (with fuzzy
 * matching), resolves displayName from NodeDef, constructs InlineNode.
 */
function dispatchAddNode(args: Record<string, unknown>): unknown {
  const canvasId = args.canvasId as string;

  const result = validateAndBuildNode(
    {
      id: args.id as string,
      type: args.type as string,
      name: args.name as string | undefined,
      args: args.args as string | undefined,
    },
    useRegistryStore.getState(),
  );
  if (!result.ok) {
    return { ok: false, error: { code: result.code, message: result.message } };
  }

  return useGraphStore.getState().addNode(canvasId, result.node);
}

/** Import pre-parsed nodes/edges/entities into a canvas. */
function dispatchImport(args: Record<string, unknown>): unknown {
  const canvasId = args.canvasId as string;
  const nodes = (args.nodes as Node[] | undefined) ?? [];
  const edges = (args.edges as Edge[] | undefined) ?? [];
  const entities = (args.entities as Entity[] | undefined) ?? [];

  // Validate canvas exists
  const canvas = useFileStore.getState().getCanvas(canvasId);
  if (!canvas) {
    return { ok: false, error: { code: 'CANVAS_NOT_FOUND', message: `Canvas '${canvasId}' not found.` } };
  }

  const added = { nodes: 0, edges: 0, entities: 0 };
  const errors: { type: string; item: unknown; error: string }[] = [];
  const gs = useGraphStore.getState();

  for (const node of nodes) {
    const result = gs.addNode(canvasId, node);
    if (result.ok) { added.nodes++; }
    else { errors.push({ type: 'node', item: node, error: `${result.error.code}` }); }
  }
  for (const edge of edges) {
    const result = gs.addEdge(canvasId, edge);
    if (result.ok) { added.edges++; }
    else { errors.push({ type: 'edge', item: edge, error: `${result.error.code}` }); }
  }
  for (const entity of entities) {
    const result = gs.addEntity(canvasId, entity);
    if (result.ok) { added.entities++; }
    else { errors.push({ type: 'entity', item: entity, error: `${result.error.code}` }); }
  }

  return { added, errors };
}

// ---------------------------------------------------------------------------
// Read action dispatchers
// ---------------------------------------------------------------------------

/** List nodes/edges/entities in a canvas. */
function dispatchList(args: Record<string, unknown>): unknown {
  const canvasId = (args.canvasId as string | undefined) ?? ROOT_CANVAS_KEY;
  const typeFilter = (args.type as string | undefined) ?? 'all';

  const canvas = useFileStore.getState().getCanvas(canvasId);
  if (!canvas) {
    return { ok: false, error: { code: 'CANVAS_NOT_FOUND', message: `Canvas '${canvasId}' not found.` } };
  }

  const data = canvas.data;
  const result: Record<string, unknown> = {};

  if (typeFilter === 'all' || typeFilter === 'nodes') {
    result.nodes = (data.nodes ?? []).map((n: Node) => ({
      id: n.id,
      type: 'type' in n ? n.type : `ref:${'ref' in n ? n.ref : ''}`,
      displayName: 'displayName' in n ? n.displayName : undefined,
    }));
  }
  if (typeFilter === 'all' || typeFilter === 'edges') {
    result.edges = (data.edges ?? []).map((e: Edge) => ({
      from: e.from.node,
      to: e.to.node,
      label: e.label,
      protocol: e.protocol,
    }));
  }
  if (typeFilter === 'all' || typeFilter === 'entities') {
    result.entities = (data.entities ?? []).map((e: Entity) => ({
      name: e.name,
      description: e.description,
    }));
  }

  return result;
}

/** Describe a node or the full architecture. */
function dispatchDescribe(args: Record<string, unknown>): unknown {
  const nodeId = args.id as string | undefined;

  if (nodeId) {
    const canvasId = (args.canvasId as string | undefined) ?? ROOT_CANVAS_KEY;
    const canvas = useFileStore.getState().getCanvas(canvasId);
    if (!canvas) {
      return { ok: false, error: { code: 'CANVAS_NOT_FOUND', message: `Canvas '${canvasId}' not found.` } };
    }

    const nodes = canvas.data.nodes ?? [];
    const node = nodes.find((n: Node) => n.id === nodeId);
    if (!node) {
      return { ok: false, error: { code: 'NODE_NOT_FOUND', message: `Node '${nodeId}' not found in canvas '${canvasId}'.` } };
    }

    const edges = canvas.data.edges ?? [];
    const connectedEdges = edges
      .filter((e: Edge) => e.from.node === nodeId || e.to.node === nodeId)
      .map((e: Edge) => ({ from: e.from.node, to: e.to.node, label: e.label, protocol: e.protocol }));

    const result: Record<string, unknown> = { id: node.id };
    if ('type' in node) {
      result.type = node.type;
      result.displayName = node.displayName;
      result.args = node.args;
      result.notes = node.notes;
      result.codeRefs = node.codeRefs;
      const nodeDef = useRegistryStore.getState().resolve(node.type);
      if (nodeDef) { result.ports = nodeDef.spec.ports; }
    } else if ('ref' in node) {
      result.ref = node.ref;
    }
    result.connectedEdges = connectedEdges;

    return { node: result };
  }

  // Describe full architecture
  const project = useFileStore.getState().project;
  if (!project) {
    return { ok: false, error: { code: 'PROJECT_LOAD_FAILED', message: 'No project loaded.' } };
  }

  const rootCanvas = project.canvases.get(ROOT_CANVAS_KEY);
  const projectName = rootCanvas?.data.project?.name ?? 'Unknown';
  const scopes: Record<string, unknown>[] = [];

  for (const [cid, cv] of project.canvases) {
    const d = cv.data;
    const scopeInfo: Record<string, unknown> = {
      canvasId: cid,
      nodeCount: (d.nodes ?? []).length,
      edgeCount: (d.edges ?? []).length,
      entityCount: (d.entities ?? []).length,
    };

    if (cid !== ROOT_CANVAS_KEY) {
      const refNodes = (d.nodes ?? []).filter((n: Node) => 'ref' in n);
      if (refNodes.length > 0) {
        scopeInfo.childRefs = refNodes.map((n: Node) => {
          const childCanvas = project.canvases.get(n.id);
          return {
            ref: 'ref' in n ? n.ref : '',
            nodeCount: childCanvas ? (childCanvas.data.nodes ?? []).length : 0,
            edgeCount: childCanvas ? (childCanvas.data.edges ?? []).length : 0,
          };
        });
      }
    }

    scopes.push(scopeInfo);
  }

  return { project: projectName, scopes };
}

/** Search across all canvases. */
function dispatchSearch(args: Record<string, unknown>): unknown {
  const query = (args.query as string).toLowerCase();
  const typeFilter = (args.type as string | undefined) ?? 'all';
  const project = useFileStore.getState().project;

  if (!project) {
    return { results: [] };
  }

  const results: { type: string; scope: string; item: Record<string, unknown> }[] = [];

  for (const [canvasId, canvas] of project.canvases) {
    const data = canvas.data;

    if (typeFilter === 'all' || typeFilter === 'nodes') {
      for (const node of data.nodes ?? []) {
        const fields = [node.id, 'displayName' in node ? node.displayName : undefined, 'type' in node ? node.type : undefined];
        if (fields.some((f) => f?.toLowerCase().includes(query))) {
          results.push({
            type: 'node', scope: canvasId,
            item: { id: node.id, type: 'type' in node ? node.type : `ref:${'ref' in node ? node.ref : ''}`, displayName: 'displayName' in node ? node.displayName : undefined },
          });
        }
      }
    }

    if (typeFilter === 'all' || typeFilter === 'edges') {
      for (const edge of data.edges ?? []) {
        const fields = [edge.label, edge.from.node, edge.to.node];
        if (fields.some((f) => f?.toLowerCase().includes(query))) {
          results.push({
            type: 'edge', scope: canvasId,
            item: { from: edge.from.node, to: edge.to.node, label: edge.label, protocol: edge.protocol },
          });
        }
      }
    }

    if (typeFilter === 'all' || typeFilter === 'entities') {
      for (const entity of data.entities ?? []) {
        const fields = [entity.name, entity.description];
        if (fields.some((f) => f?.toLowerCase().includes(query))) {
          results.push({
            type: 'entity', scope: canvasId,
            item: { name: entity.name, description: entity.description },
          });
        }
      }
    }
  }

  return { results };
}

/** List all registered node types. */
function dispatchCatalog(args: Record<string, unknown>): unknown {
  const namespace = args.namespace as string | undefined;
  const registry = useRegistryStore.getState();
  const allDefs = namespace ? registry.listByNamespace(namespace) : registry.list();

  const nodeTypes = allDefs.map((def) => ({
    type: `${def.metadata.namespace}/${def.metadata.name}`,
    displayName: def.metadata.displayName,
    namespace: def.metadata.namespace,
    description: def.metadata.description,
    tags: def.metadata.tags ?? [],
  }));

  return { nodeTypes };
}

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
import { validateRelativePath, isBinaryContent, truncateLines, globToRegex, DEFAULT_IGNORE } from './fileToolUtils';

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
export async function dispatchStoreAction(action: string, args: Record<string, unknown>): Promise<unknown> {
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
    case 'addEntity':
      return dispatchAddEntity(args);
    case 'removeEntity':
      return dispatchRemoveEntity(args);
    case 'updateEntity':
      return dispatchUpdateEntity(args);

    // --- Read actions ---
    case 'list':
      return dispatchList(args);
    case 'describe':
      return dispatchDescribe(args);
    case 'search':
      return dispatchSearch(args);
    case 'catalog':
      return dispatchCatalog(args);

    // --- Project file actions ---
    case 'readProjectFile':
      return dispatchReadProjectFile(args);
    case 'writeProjectFile':
      return dispatchWriteProjectFile(args);
    case 'updateProjectFile':
      return dispatchUpdateProjectFile(args);
    case 'listProjectFiles':
      return dispatchListProjectFiles(args);
    case 'globProjectFiles':
      return dispatchGlobProjectFiles(args);
    case 'searchProjectFiles':
      return dispatchSearchProjectFiles(args);
    case 'deleteProjectFile':
      return dispatchDeleteProjectFile(args);

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

// ---------------------------------------------------------------------------
// Entity action dispatchers
// ---------------------------------------------------------------------------

function dispatchAddEntity(args: Record<string, unknown>) {
  const canvasId = (args.canvasId as string) ?? ROOT_CANVAS_KEY;
  const name = args.name as string;
  const description = args.description as string | undefined;
  const codeRefs = args.codeRefs as string[] | undefined;
  const entity: { name: string; description?: string; codeRefs?: string[] } = { name };
  if (description !== undefined) entity.description = description;
  if (codeRefs !== undefined) entity.codeRefs = codeRefs;
  return useGraphStore.getState().addEntity(canvasId, entity);
}

function dispatchRemoveEntity(args: Record<string, unknown>) {
  const canvasId = (args.canvasId as string) ?? ROOT_CANVAS_KEY;
  const entityName = args.entityName as string;
  return useGraphStore.getState().removeEntity(canvasId, entityName);
}

function dispatchUpdateEntity(args: Record<string, unknown>) {
  const canvasId = (args.canvasId as string) ?? ROOT_CANVAS_KEY;
  const entityName = args.entityName as string;
  const updates: { description?: string; codeRefs?: string[] } = {};
  if (args.description !== undefined) updates.description = args.description as string;
  if (args.codeRefs !== undefined) updates.codeRefs = args.codeRefs as string[];
  return useGraphStore.getState().updateEntity(canvasId, entityName, updates);
}

// ---------------------------------------------------------------------------
// Project file action dispatchers
// ---------------------------------------------------------------------------

async function dispatchReadProjectFile(args: Record<string, unknown>) {
  let path: string;
  try { path = validateRelativePath(args.path as string); }
  catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  try {
    const content = await fs.readFile(path);
    if (isBinaryContent(content)) {
      return { ok: false, error: { code: 'BINARY_FILE', message: `'${path}' appears to be a binary file` } };
    }
    return { ok: true, data: truncateLines(content, 2000) };
  } catch {
    return { ok: false, error: { code: 'FILE_NOT_FOUND', message: `File '${path}' not found` } };
  }
}

async function dispatchWriteProjectFile(args: Record<string, unknown>) {
  let path: string;
  try { path = validateRelativePath(args.path as string); }
  catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  await fs.writeFile(path, args.content as string);
  return { ok: true, data: { path } };
}

async function dispatchUpdateProjectFile(args: Record<string, unknown>) {
  let path: string;
  try { path = validateRelativePath(args.path as string); }
  catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  let content: string;
  try { content = await fs.readFile(path); }
  catch { return { ok: false, error: { code: 'FILE_NOT_FOUND', message: `File '${path}' not found` } }; }

  const oldString = args.oldString as string;
  const newString = args.newString as string;
  const firstIdx = content.indexOf(oldString);
  if (firstIdx === -1) {
    return { ok: false, error: { code: 'STRING_NOT_FOUND', message: `String not found in '${path}'` } };
  }
  const secondIdx = content.indexOf(oldString, firstIdx + 1);
  if (secondIdx !== -1) {
    return { ok: false, error: { code: 'AMBIGUOUS_MATCH', message: `String matches multiple locations in '${path}'. Provide more surrounding context.` } };
  }

  const updated = content.slice(0, firstIdx) + newString + content.slice(firstIdx + oldString.length);
  await fs.writeFile(path, updated);
  return { ok: true, data: { path } };
}

async function dispatchListProjectFiles(args: Record<string, unknown>) {
  let path = (args.path as string) ?? '.';
  if (path !== '.') {
    try { path = validateRelativePath(path); }
    catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }
  }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  const entries = await fs.listEntries(path);
  return { entries: entries.map((e) => ({ name: e.name, type: e.type })) };
}

async function dispatchGlobProjectFiles(args: Record<string, unknown>) {
  const pattern = args.pattern as string;
  let basePath = (args.path as string) ?? '.';
  if (basePath !== '.') {
    try { basePath = validateRelativePath(basePath); }
    catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }
  }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  const allFiles = await fs.listFilesRecursive(basePath, DEFAULT_IGNORE);
  const regex = globToRegex(pattern);
  const matched = allFiles.filter((f) => {
    // Match against path relative to basePath
    const rel = basePath === '.' ? f : f.startsWith(basePath + '/') ? f.slice(basePath.length + 1) : f;
    return regex.test(rel);
  });

  return { files: matched.slice(0, 1000) };
}

async function dispatchSearchProjectFiles(args: Record<string, unknown>) {
  const query = args.query as string;
  let basePath = (args.path as string) ?? '.';
  if (basePath !== '.') {
    try { basePath = validateRelativePath(basePath); }
    catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }
  }
  const include = args.include as string | undefined;

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  let regex: RegExp;
  try { regex = new RegExp(query); }
  catch { return { ok: false, error: { code: 'INVALID_REGEX', message: `Invalid regex: ${query}` } }; }

  const includeRegex = include ? globToRegex(include) : null;
  const allFiles = await fs.listFilesRecursive(basePath, DEFAULT_IGNORE);

  const matches: { path: string; line: number; content: string }[] = [];

  for (const filePath of allFiles) {
    if (includeRegex && !includeRegex.test(filePath.split('/').pop()!)) continue;
    if (matches.length >= 100) break;

    let content: string;
    try { content = await fs.readFile(filePath); } catch { continue; }
    if (isBinaryContent(content)) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matches.push({ path: filePath, line: i + 1, content: lines[i] });
        if (matches.length >= 100) break;
      }
    }
  }

  return { matches };
}

async function dispatchDeleteProjectFile(args: Record<string, unknown>) {
  let path: string;
  try { path = validateRelativePath(args.path as string); }
  catch { return { ok: false, error: { code: 'INVALID_PATH', message: `Invalid path: ${args.path}` } }; }

  const fs = useFileStore.getState().fs;
  if (!fs) return { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No project open' } };

  try {
    await fs.deleteFile(path);
    return { ok: true, data: { path } };
  } catch {
    return { ok: false, error: { code: 'FILE_NOT_FOUND', message: `File '${path}' not found` } };
  }
}

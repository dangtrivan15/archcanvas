/**
 * MCP Tool handlers for ArchCanvas.
 * Each handler delegates to the Text API for actual operations.
 */

import type { TextApi } from '@/api/textApi';
import type { RegistryManager } from '@/core/registry/registryManager';
import type { GraphContext } from '@/cli/context';
import type { DescribeFormat } from '@/types/api';

export interface ToolHandlerContext {
  textApi: TextApi;
  registry: RegistryManager;
  /** Optional GraphContext for file-backed mode (auto-save, file_info). */
  graphContext?: GraphContext;
}

/** Mutation tool names that trigger auto-save when file-backed. */
export const MUTATION_TOOLS = new Set([
  'add_node',
  'add_edge',
  'add_note',
  'update_node',
  'remove_node',
  'remove_edge',
]);

/**
 * Auto-save after a mutation tool call (if file-backed).
 * Logs errors to stderr but does not throw (mutation already succeeded).
 */
export async function autoSave(ctx: ToolHandlerContext): Promise<void> {
  if (!ctx.graphContext) return;
  try {
    await ctx.graphContext.save();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[MCP] Auto-save failed: ${msg}`);
  }
}

/**
 * Handle the 'describe' tool call.
 */
export function handleDescribe(
  ctx: ToolHandlerContext,
  args: { format?: string; scope?: string; nodeId?: string; nodeIds?: string[] },
): string {
  const result = ctx.textApi.describe({
    format: (args.format ?? 'structured') as DescribeFormat,
    scope: (args.scope ?? 'full') as 'full' | 'node' | 'nodes',
    nodeId: args.nodeId,
    nodeIds: args.nodeIds,
  });
  return result;
}

/**
 * Handle the 'add_node' tool call.
 */
export function handleAddNode(
  ctx: ToolHandlerContext,
  args: {
    type: string;
    displayName: string;
    parentId?: string;
    x?: number;
    y?: number;
    args?: Record<string, string | number | boolean>;
  },
): string {
  const node = ctx.textApi.addNode({
    type: args.type,
    displayName: args.displayName,
    parentId: args.parentId,
    position: args.x !== undefined || args.y !== undefined
      ? { x: args.x ?? 0, y: args.y ?? 0 }
      : undefined,
    args: args.args,
  });
  return JSON.stringify({ success: true, nodeId: node.id, displayName: node.displayName });
}

/**
 * Handle the 'add_edge' tool call.
 * Returns error response if either node ID is invalid.
 */
export function handleAddEdge(
  ctx: ToolHandlerContext,
  args: {
    fromNode: string;
    toNode: string;
    type: 'sync' | 'async' | 'data-flow';
    fromPort?: string;
    toPort?: string;
    label?: string;
  },
): string {
  try {
    const edge = ctx.textApi.addEdge({
      fromNode: args.fromNode,
      toNode: args.toNode,
      type: args.type,
      fromPort: args.fromPort,
      toPort: args.toPort,
      label: args.label,
    });
    return JSON.stringify({ success: true, edgeId: edge.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ success: false, error: message });
  }
}

/**
 * Handle the 'add_note' tool call.
 */
export function handleAddNote(
  ctx: ToolHandlerContext,
  args: {
    nodeId?: string;
    edgeId?: string;
    author: string;
    content: string;
    tags?: string[];
  },
): string {
  const note = ctx.textApi.addNote({
    nodeId: args.nodeId,
    edgeId: args.edgeId,
    author: args.author,
    content: args.content,
    tags: args.tags,
  });
  return JSON.stringify({ success: true, noteId: note.id });
}

/**
 * Handle the 'update_node' tool call.
 */
export function handleUpdateNode(
  ctx: ToolHandlerContext,
  args: {
    nodeId: string;
    displayName?: string;
    args?: Record<string, string | number | boolean>;
    properties?: Record<string, string | number | boolean>;
  },
): string {
  ctx.textApi.updateNode(args.nodeId, {
    displayName: args.displayName,
    args: args.args,
    properties: args.properties,
  });
  return JSON.stringify({ success: true, nodeId: args.nodeId });
}

/**
 * Handle the 'remove_node' tool call.
 */
export function handleRemoveNode(
  ctx: ToolHandlerContext,
  args: { nodeId: string },
): string {
  ctx.textApi.removeNode(args.nodeId);
  return JSON.stringify({ success: true, nodeId: args.nodeId });
}

/**
 * Handle the 'remove_edge' tool call.
 */
export function handleRemoveEdge(
  ctx: ToolHandlerContext,
  args: { edgeId: string },
): string {
  ctx.textApi.removeEdge(args.edgeId);
  return JSON.stringify({ success: true, edgeId: args.edgeId });
}

/**
 * Handle the 'search' tool call.
 */
export function handleSearch(
  ctx: ToolHandlerContext,
  args: { query: string },
): string {
  const results = ctx.textApi.search(args.query);
  return JSON.stringify({ results, count: results.length });
}

/**
 * Handle the 'list_nodedefs' tool call.
 */
export function handleListNodedefs(
  ctx: ToolHandlerContext,
  args: { namespace?: string },
): string {
  if (args.namespace) {
    const defs = ctx.registry.listByNamespace(args.namespace);
    return JSON.stringify({
      namespace: args.namespace,
      nodedefs: defs.map((d) => ({
        name: d.metadata.name,
        namespace: d.metadata.namespace,
        type: `${d.metadata.namespace}/${d.metadata.name}`,
        displayName: d.metadata.displayName,
        description: d.metadata.description,
        icon: d.metadata.icon,
      })),
      count: defs.length,
    });
  }

  const allDefs = ctx.registry.listAll();
  return JSON.stringify({
    nodedefs: allDefs.map((d) => ({
      name: d.metadata.name,
      namespace: d.metadata.namespace,
      type: `${d.metadata.namespace}/${d.metadata.name}`,
      displayName: d.metadata.displayName,
      description: d.metadata.description,
      icon: d.metadata.icon,
    })),
    count: allDefs.length,
  });
}

/**
 * Handle the 'save' tool call (async).
 * Explicitly saves the current state to the .archc file.
 */
export async function handleSave(
  ctx: ToolHandlerContext,
  args: { force?: boolean },
): Promise<string> {
  if (!ctx.graphContext) {
    return JSON.stringify({
      success: false,
      error: 'No file loaded. Start the MCP server with --file <path> to enable file persistence.',
    });
  }

  try {
    const wasModified = ctx.graphContext.isModified();
    await ctx.graphContext.save(args.force ?? false);
    const filePath = ctx.graphContext.getFilePath();
    return JSON.stringify({
      success: true,
      filePath,
      message: wasModified || args.force ? 'File saved successfully.' : 'No changes to save.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ success: false, error: `Save failed: ${msg}` });
  }
}

/**
 * Handle the 'file_info' tool call.
 * Returns metadata about the loaded .archc file.
 */
export function handleFileInfo(ctx: ToolHandlerContext): string {
  const graph = ctx.textApi.getGraph();
  const filePath = ctx.graphContext?.getFilePath();
  const isFileBacked = !!ctx.graphContext;
  const isModified = ctx.graphContext?.isModified() ?? false;

  return JSON.stringify({
    fileBacked: isFileBacked,
    filePath: filePath ?? null,
    architectureName: graph.name,
    description: graph.description ?? null,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    isModified,
  });
}

/**
 * Dispatch a synchronous tool call to the appropriate handler.
 * Does NOT handle 'save' or 'file_info' — those are handled separately in server.ts.
 */
export function dispatchToolCall(
  ctx: ToolHandlerContext,
  toolName: string,
  args: Record<string, unknown>,
): string {
  switch (toolName) {
    case 'describe':
      return handleDescribe(ctx, args as Parameters<typeof handleDescribe>[1]);
    case 'add_node':
      return handleAddNode(ctx, args as Parameters<typeof handleAddNode>[1]);
    case 'add_edge':
      return handleAddEdge(ctx, args as Parameters<typeof handleAddEdge>[1]);
    case 'add_note':
      return handleAddNote(ctx, args as Parameters<typeof handleAddNote>[1]);
    case 'update_node':
      return handleUpdateNode(ctx, args as Parameters<typeof handleUpdateNode>[1]);
    case 'remove_node':
      return handleRemoveNode(ctx, args as Parameters<typeof handleRemoveNode>[1]);
    case 'remove_edge':
      return handleRemoveEdge(ctx, args as Parameters<typeof handleRemoveEdge>[1]);
    case 'search':
      return handleSearch(ctx, args as Parameters<typeof handleSearch>[1]);
    case 'list_nodedefs':
      return handleListNodedefs(ctx, args as Parameters<typeof handleListNodedefs>[1]);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

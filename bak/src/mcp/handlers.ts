/**
 * MCP Tool handlers for ArchCanvas.
 * Each handler delegates to the Text API for actual operations.
 */

import type { TextApi } from '@/api/textApi';
import type { RegistryManager } from '@/core/registry/registryManager';
import type { GraphContext } from '@/cli/context';
import type { DescribeFormat } from '@/types/api';
import type { PropertyMap } from '@/types/graph';
import { ExportApi } from '@/api/exportApi';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import type { AnalyzeProgress } from '@/analyze/pipeline';

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
  'update_edge',
  'remove_node',
  'remove_edge',
  'remove_note',
  'add_code_ref',
  'init_architecture',
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
    args?: PropertyMap;
  },
): string {
  const node = ctx.textApi.addNode({
    type: args.type,
    displayName: args.displayName,
    parentId: args.parentId,
    position:
      args.x !== undefined || args.y !== undefined ? { x: args.x ?? 0, y: args.y ?? 0 } : undefined,
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
    args?: PropertyMap;
    properties?: PropertyMap;
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
export function handleRemoveNode(ctx: ToolHandlerContext, args: { nodeId: string }): string {
  ctx.textApi.removeNode(args.nodeId);
  return JSON.stringify({ success: true, nodeId: args.nodeId });
}

/**
 * Handle the 'remove_edge' tool call.
 */
export function handleRemoveEdge(ctx: ToolHandlerContext, args: { edgeId: string }): string {
  ctx.textApi.removeEdge(args.edgeId);
  return JSON.stringify({ success: true, edgeId: args.edgeId });
}

/**
 * Handle the 'search' tool call.
 */
export function handleSearch(ctx: ToolHandlerContext, args: { query: string }): string {
  const results = ctx.textApi.search(args.query);
  return JSON.stringify({ results, count: results.length });
}

/**
 * Handle the 'list_nodedefs' tool call.
 */
export function handleListNodedefs(ctx: ToolHandlerContext, args: { namespace?: string }): string {
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
 * Handle the 'export_markdown' tool call.
 * Generates a markdown summary, optionally with a Mermaid diagram.
 */
export function handleExportMarkdown(
  ctx: ToolHandlerContext,
  args: { includeMermaid?: boolean },
): string {
  const exportApi = new ExportApi();
  const graph = ctx.textApi.getGraph();
  if (args.includeMermaid) {
    return exportApi.generateSummaryWithMermaid(graph);
  }
  return exportApi.generateMarkdownSummary(graph);
}

/**
 * Handle the 'export_mermaid' tool call.
 * Generates a Mermaid diagram of the architecture graph.
 */
export function handleExportMermaid(ctx: ToolHandlerContext): string {
  const exportApi = new ExportApi();
  const graph = ctx.textApi.getGraph();
  return exportApi.generateMermaid(graph);
}

/**
 * Handle the 'update_edge' tool call.
 */
export function handleUpdateEdge(
  ctx: ToolHandlerContext,
  args: {
    edgeId: string;
    type?: 'sync' | 'async' | 'data-flow';
    label?: string;
    properties?: PropertyMap;
  },
): string {
  try {
    const updates: Record<string, unknown> = {};
    if (args.type !== undefined) updates.type = args.type;
    if (args.label !== undefined) updates.label = args.label;
    if (args.properties !== undefined) updates.properties = args.properties;

    ctx.textApi.updateEdge(args.edgeId, updates);
    return JSON.stringify({ success: true, edgeId: args.edgeId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ success: false, error: message });
  }
}

/**
 * Handle the 'add_code_ref' tool call.
 */
export function handleAddCodeRef(
  ctx: ToolHandlerContext,
  args: {
    nodeId: string;
    path: string;
    role: 'source' | 'api-spec' | 'schema' | 'deployment' | 'config' | 'test';
  },
): string {
  try {
    ctx.textApi.addCodeRef({ nodeId: args.nodeId, path: args.path, role: args.role });
    return JSON.stringify({ success: true, nodeId: args.nodeId, path: args.path });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ success: false, error: message });
  }
}

/**
 * Handle the 'remove_note' tool call.
 */
export function handleRemoveNote(
  ctx: ToolHandlerContext,
  args: { nodeId: string; noteId: string },
): string {
  try {
    ctx.textApi.removeNote(args.nodeId, args.noteId);
    return JSON.stringify({ success: true, nodeId: args.nodeId, noteId: args.noteId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ success: false, error: message });
  }
}

/**
 * Handle the 'get_edges' tool call.
 */
export function handleGetEdges(ctx: ToolHandlerContext): string {
  const edges = ctx.textApi.getEdges();
  return JSON.stringify({ edges, count: edges.length });
}

/**
 * Handle the 'init_architecture' tool call.
 * Creates a fresh empty architecture, replacing the current graph.
 */
export function handleInitArchitecture(
  ctx: ToolHandlerContext,
  args: { name?: string; description?: string },
): string {
  const newGraph = createEmptyGraph(args.name ?? 'Untitled Architecture');
  if (args.description) {
    newGraph.description = args.description;
  }
  ctx.textApi.setGraph(newGraph);
  return JSON.stringify({
    success: true,
    name: newGraph.name,
    description: newGraph.description ?? null,
  });
}

/**
 * Handle the 'analyze_codebase' tool call (async).
 * Runs the full analysis pipeline on a directory and returns a summary.
 *
 * @param onProgress - Optional callback for MCP progress notifications
 */
export async function handleAnalyzeCodebase(
  _ctx: ToolHandlerContext,
  args: {
    directory: string;
    output_path?: string;
    depth?: 'quick' | 'standard' | 'deep';
    architecture_name?: string;
    merge?: boolean;
    strategy?: 'ai-wins' | 'manual-wins' | 'prompt';
  },
  onProgress?: (event: AnalyzeProgress) => void,
): Promise<string> {
  // Validate directory exists
  const fs = await import('node:fs');
  const path = await import('node:path');

  const resolvedDir = path.resolve(args.directory);

  try {
    const stat = fs.statSync(resolvedDir);
    if (!stat.isDirectory()) {
      return JSON.stringify({
        success: false,
        error: `Path is not a directory: ${resolvedDir}`,
      });
    }
  } catch {
    return JSON.stringify({
      success: false,
      error: `Directory not accessible: ${resolvedDir}. Ensure the path exists and the MCP server has filesystem access.`,
    });
  }

  try {
    const { analyzeCodebase } = await import('@/analyze/pipeline');
    const outputPath = args.output_path ?? path.join(resolvedDir, 'architecture.archc');

    // ── Merge mode ───────────────────────────────────────────────
    if (args.merge) {
      // Run pipeline in dry-run mode to get inference result
      const result = await analyzeCodebase(resolvedDir, {
        outputPath,
        analysisDepth: args.depth ?? 'standard',
        architectureName: args.architecture_name,
        dryRun: true,
        includeNotes: true,
        onProgress,
      });

      if (!result.inferenceResult) {
        return JSON.stringify({
          success: false,
          error: 'Merge mode requires an inference result, but inference returned nothing.',
        });
      }

      if (!fs.existsSync(outputPath)) {
        return JSON.stringify({
          success: false,
          error: `Merge mode requires an existing .archc file at: ${outputPath}. Run without merge first.`,
        });
      }

      const { GraphContext } = await import('@/cli/context');
      const ctx = await GraphContext.loadFromFile(outputPath);
      const existingGraph = ctx.getGraph();

      const { mergeAnalysis, applyMerge } = await import('@/analyze/merge');
      const strategy = args.strategy ?? 'manual-wins';
      const mergeResult = mergeAnalysis(existingGraph, result.inferenceResult, {
        conflictStrategy: strategy,
        addChangeNotes: true,
      });

      const mergedGraph = applyMerge(existingGraph, mergeResult, {
        conflictStrategy: strategy,
        addChangeNotes: true,
      });

      ctx.textApi.setGraph(mergedGraph);
      ctx.markModified();
      await ctx.save(true);

      try {
        await ctx.saveSidecar();
      } catch {
        /* optional */
      }

      const { summary } = mergeResult;
      return JSON.stringify({
        success: true,
        mode: 'merge',
        output_path: outputPath,
        strategy,
        nodes_matched: summary.nodesMatched,
        nodes_added: summary.nodesAdded,
        nodes_flagged: summary.nodesFlagged,
        edges_added: summary.edgesAdded,
        edges_flagged: summary.edgesFlagged,
        edges_preserved: summary.edgesPreserved,
        type_changes: summary.typeChanges,
        code_ref_updates: summary.codeRefUpdates,
        warnings: [...result.warnings, ...mergeResult.warnings],
        duration: result.duration,
      });
    }

    // ── Normal (non-merge) mode ──────────────────────────────────
    const result = await analyzeCodebase(resolvedDir, {
      outputPath: args.output_path,
      analysisDepth: args.depth ?? 'standard',
      architectureName: args.architecture_name,
      includeNotes: true,
      onProgress,
    });

    // Build a text summary of the detected architecture
    const profile = result.projectProfile;
    const summaryParts: string[] = [];
    summaryParts.push(
      `Architecture: ${result.inferenceResult?.architectureName ?? args.architecture_name ?? path.basename(resolvedDir)}`,
    );
    summaryParts.push(`Project type: ${profile.projectType}`);
    if (profile.languages.length > 0) {
      summaryParts.push(`Languages: ${profile.languages.map((l) => l.name).join(', ')}`);
    }
    if (profile.frameworks.length > 0) {
      summaryParts.push(`Frameworks: ${profile.frameworks.map((f) => f.name).join(', ')}`);
    }
    if (profile.dataStores.length > 0) {
      summaryParts.push(`Data stores: ${profile.dataStores.map((d) => d.type).join(', ')}`);
    }
    summaryParts.push(
      `Created ${result.stats.nodes} nodes, ${result.stats.edges} edges, ${result.stats.codeRefs} code references`,
    );
    if (result.warnings.length > 0) {
      summaryParts.push(`Warnings: ${result.warnings.join('; ')}`);
    }
    summaryParts.push(`Duration: ${result.duration}ms`);

    return JSON.stringify({
      success: true,
      output_path: result.outputPath,
      architecture_name:
        result.inferenceResult?.architectureName ??
        args.architecture_name ??
        path.basename(resolvedDir),
      nodes_created: result.stats.nodes,
      edges_created: result.stats.edges,
      code_refs_linked: result.stats.codeRefs,
      summary: summaryParts.join('\n'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({
      success: false,
      error: `Analysis failed: ${message}`,
    });
  }
}

/**
 * Dispatch a synchronous tool call to the appropriate handler.
 * Does NOT handle 'save', 'file_info', or 'analyze_codebase' — those are handled separately in server.ts.
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
    case 'update_edge':
      return handleUpdateEdge(ctx, args as Parameters<typeof handleUpdateEdge>[1]);
    case 'remove_node':
      return handleRemoveNode(ctx, args as Parameters<typeof handleRemoveNode>[1]);
    case 'remove_edge':
      return handleRemoveEdge(ctx, args as Parameters<typeof handleRemoveEdge>[1]);
    case 'remove_note':
      return handleRemoveNote(ctx, args as Parameters<typeof handleRemoveNote>[1]);
    case 'add_code_ref':
      return handleAddCodeRef(ctx, args as Parameters<typeof handleAddCodeRef>[1]);
    case 'get_edges':
      return handleGetEdges(ctx);
    case 'export_markdown':
      return handleExportMarkdown(ctx, args as Parameters<typeof handleExportMarkdown>[1]);
    case 'export_mermaid':
      return handleExportMermaid(ctx);
    case 'init_architecture':
      return handleInitArchitecture(ctx, args as Parameters<typeof handleInitArchitecture>[1]);
    case 'search':
      return handleSearch(ctx, args as Parameters<typeof handleSearch>[1]);
    case 'list_nodedefs':
      return handleListNodedefs(ctx, args as Parameters<typeof handleListNodedefs>[1]);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

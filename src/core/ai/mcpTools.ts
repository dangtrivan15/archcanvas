/**
 * MCP tool server for ArchCanvas.
 *
 * Registers 20 tools with the Claude Agent SDK MCP server.
 * Handler bodies use shared translateToolArgs() for arg translation.
 *
 * This is a Node.js-only module. It must NEVER be bundled into the browser build.
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';
import type { RelayStoreActionFn } from './bridgeServer';
import { translateToolArgs } from './translateToolArgs';

export type { RelayStoreActionFn } from './bridgeServer';

function toCallToolResult(result: { ok: boolean; data?: unknown; error?: { code: string; message: string } }) {
  if (result.ok) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(result.error) }], isError: true };
}

/**
 * Create an MCP server with 20 ArchCanvas tools.
 * Each tool handler translates MCP args to dispatcher shape and relays via the provided function.
 */
export function createArchCanvasMcpServer(relay: RelayStoreActionFn) {
  return createSdkMcpServer({
    name: 'archcanvas',
    version: '0.1.0',
    tools: [
      // --- Write Tools ---
      // --- Write Tools ---
      tool('add_node', 'Add a node to the architecture canvas', {
        id: z.string().describe('Unique node identifier (kebab-case)'),
        type: z.string().describe('Node type (e.g., compute/service, data/database). Run catalog tool first.'),
        name: z.string().optional().describe('Display name'),
        args: z.string().optional().describe('Constructor arguments as JSON string'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('add_node', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('add_edge', 'Add an edge (connection) between two nodes', {
        from: z.string().describe('Source node ID (use @refNodeId/nodeId for cross-scope)'),
        to: z.string().describe('Target node ID'),
        fromPort: z.string().optional().describe('Source port name'),
        toPort: z.string().optional().describe('Target port name'),
        protocol: z.string().optional().describe('Communication protocol (HTTP, gRPC, SQL, etc.)'),
        label: z.string().optional().describe('Edge label'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('add_edge', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('remove_node', 'Remove a node from the canvas', {
        id: z.string().describe('Node ID to remove'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('remove_node', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('remove_edge', 'Remove an edge between two nodes', {
        from: z.string().describe('Source node ID'),
        to: z.string().describe('Target node ID'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('remove_edge', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('import_yaml', 'Import nodes, edges, and entities from YAML content', {
        yaml: z.string().describe('YAML content to import'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        try {
          const { action, translatedArgs } = translateToolArgs('import_yaml', a);
          return toCallToolResult(await relay(action, translatedArgs));
        } catch (err: any) {
          return { content: [{ type: 'text' as const, text: `YAML parse error: ${err.message}` }], isError: true };
        }
      }),

      tool('create_subsystem', 'Create a subsystem (nested canvas) with its own scope', {
        id: z.string().describe('Unique subsystem identifier (kebab-case, becomes both node ID and filename)'),
        type: z.string().describe('Node type (e.g., compute/service). Run catalog tool first.'),
        name: z.string().optional().describe('Display name'),
        scope: z.string().optional().describe('Parent canvas scope ID (omit for root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('create_subsystem', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      // --- Entity Tools ---
      tool('add_entity', 'Add a data entity to a canvas scope', {
        name: z.string().describe('Entity name (unique within scope)'),
        description: z.string().optional().describe('Entity description'),
        codeRefs: z.array(z.string()).optional().describe('Code reference paths'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('add_entity', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('remove_entity', 'Remove a data entity from a canvas scope. Fails if referenced by edges.', {
        name: z.string().describe('Entity name to remove'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('remove_entity', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('update_entity', 'Update entity description or code references. Pass empty string/array to clear.', {
        name: z.string().describe('Entity name to update'),
        description: z.string().optional().describe('New description (empty string to clear)'),
        codeRefs: z.array(z.string()).optional().describe('New code reference paths (empty array to clear)'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('update_entity', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      // --- Read Tools ---
      tool('list', 'List nodes, edges, or entities in a canvas', {
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
        type: z.enum(['nodes', 'edges', 'entities', 'all']).optional().describe('What to list'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('list', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('describe', 'Describe a node or the full architecture', {
        id: z.string().optional().describe('Node ID (omit for full architecture overview)'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('describe', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('search', 'Search for nodes, edges, or entities by query', {
        query: z.string().describe('Search query'),
        type: z.enum(['nodes', 'edges', 'entities']).optional().describe('Filter by type'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('search', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('catalog', 'List available node types from the registry', {
        namespace: z.string().optional().describe('Filter by namespace (e.g., compute, data)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('catalog', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      // --- Project File Tools ---
      tool('read_project_file', 'Read a text file in the opened project. Binary files are not supported.', {
        path: z.string().describe('File path relative to project root'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('read_project_file', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('write_project_file', 'Create or overwrite a file in the opened project. Auto-creates parent directories.', {
        path: z.string().describe('File path relative to project root'),
        content: z.string().describe('Full file content'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('write_project_file', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('update_project_file', 'Edit a file by replacing a specific string. Provide enough context in old_string to make the match unique.', {
        path: z.string().describe('File path relative to project root'),
        old_string: z.string().describe('Exact text to find'),
        new_string: z.string().describe('Replacement text'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('update_project_file', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('list_project_files', 'List direct children (files and directories) of a directory in the opened project.', {
        path: z.string().optional().describe('Directory path relative to project root (defaults to root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('list_project_files', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('glob_project_files', 'Find files by glob pattern in the opened project. Supports *, **, ? wildcards.', {
        pattern: z.string().describe('Glob pattern (e.g., "**/*.ts")'),
        path: z.string().optional().describe('Base directory (defaults to root)'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('glob_project_files', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('search_project_files', 'Search file contents by regex pattern in the opened project.', {
        query: z.string().describe('Regex pattern to search for'),
        path: z.string().optional().describe('Subdirectory scope (defaults to root)'),
        include: z.string().optional().describe('Glob filter for filenames (e.g., "*.ts")'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('search_project_files', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),

      tool('delete_project_file', 'Delete a file in the opened project. Cannot delete directories.', {
        path: z.string().describe('File path relative to project root'),
      }, async (a) => {
        const { action, translatedArgs } = translateToolArgs('delete_project_file', a);
        return toCallToolResult(await relay(action, translatedArgs));
      }),
    ],
  });
}

/** MCP tool names in the format the SDK uses for allowedTools. */
export const MCP_TOOL_NAMES = [
  'mcp__archcanvas__add_node', 'mcp__archcanvas__add_edge',
  'mcp__archcanvas__remove_node', 'mcp__archcanvas__remove_edge',
  'mcp__archcanvas__import_yaml', 'mcp__archcanvas__create_subsystem',
  'mcp__archcanvas__add_entity', 'mcp__archcanvas__remove_entity', 'mcp__archcanvas__update_entity',
  'mcp__archcanvas__list',
  'mcp__archcanvas__describe', 'mcp__archcanvas__search',
  'mcp__archcanvas__catalog',
  'mcp__archcanvas__read_project_file', 'mcp__archcanvas__write_project_file',
  'mcp__archcanvas__update_project_file', 'mcp__archcanvas__list_project_files',
  'mcp__archcanvas__glob_project_files', 'mcp__archcanvas__search_project_files',
  'mcp__archcanvas__delete_project_file',
];

/**
 * Shared tool definitions for ArchCanvas.
 *
 * Pure metadata — contains only tool names, descriptions, and Zod schemas.
 * Must NOT import from @anthropic-ai/claude-agent-sdk or any Node.js-only module.
 * This file is bundled into the browser build and consumed by both the
 * MCP server (Node.js) and the ApiKeyProvider (browser).
 */

import { z } from 'zod/v4';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
}

export const archCanvasToolDefs: ToolDef[] = [
  // --- Write Tools ---
  {
    name: 'add_node',
    description: 'Add a node to the architecture canvas',
    inputSchema: z.object({
      id: z.string().describe('Unique node identifier (kebab-case)'),
      type: z.string().describe('Node type (e.g., compute/service, data/database). Run catalog tool first.'),
      name: z.string().optional().describe('Display name'),
      args: z.string().optional().describe('Constructor arguments as JSON string'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }),
  },
  {
    name: 'add_edge',
    description: 'Add an edge (connection) between two nodes',
    inputSchema: z.object({
      from: z.string().describe('Source node ID (use @refNodeId/nodeId for cross-scope)'),
      to: z.string().describe('Target node ID'),
      fromPort: z.string().optional().describe('Source port name'),
      toPort: z.string().optional().describe('Target port name'),
      protocol: z.string().optional().describe('Communication protocol (HTTP, gRPC, SQL, etc.)'),
      label: z.string().optional().describe('Edge label'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }),
  },
  {
    name: 'remove_node',
    description: 'Remove a node from the canvas',
    inputSchema: z.object({
      id: z.string().describe('Node ID to remove'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }),
  },
  {
    name: 'remove_edge',
    description: 'Remove an edge between two nodes',
    inputSchema: z.object({
      from: z.string().describe('Source node ID'),
      to: z.string().describe('Target node ID'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }),
  },
  {
    name: 'import_yaml',
    description: 'Import nodes, edges, and entities from YAML content',
    inputSchema: z.object({
      yaml: z.string().describe('YAML content to import'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }),
  },
  {
    name: 'create_subsystem',
    description: 'Create a subsystem (nested canvas) with its own scope',
    inputSchema: z.object({
      id: z.string().describe('Unique subsystem identifier (kebab-case, becomes both node ID and filename)'),
      type: z.string().describe('Node type (e.g., compute/service). Run catalog tool first.'),
      name: z.string().optional().describe('Display name'),
      scope: z.string().optional().describe('Parent canvas scope ID (omit for root)'),
    }),
  },

  // --- Entity Tools ---
  {
    name: 'add_entity',
    description: 'Add a data entity to a canvas scope',
    inputSchema: z.object({
      name: z.string().describe('Entity name (unique within scope)'),
      description: z.string().optional().describe('Entity description'),
      codeRefs: z.array(z.string()).optional().describe('Code reference paths'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }),
  },
  {
    name: 'remove_entity',
    description: 'Remove a data entity from a canvas scope. Fails if referenced by edges.',
    inputSchema: z.object({
      name: z.string().describe('Entity name to remove'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }),
  },
  {
    name: 'update_entity',
    description: 'Update entity description or code references. Pass empty string/array to clear.',
    inputSchema: z.object({
      name: z.string().describe('Entity name to update'),
      description: z.string().optional().describe('New description (empty string to clear)'),
      codeRefs: z.array(z.string()).optional().describe('New code reference paths (empty array to clear)'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }),
  },

  // --- Read Tools ---
  {
    name: 'list',
    description: 'List nodes, edges, or entities in a canvas',
    inputSchema: z.object({
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      type: z.enum(['nodes', 'edges', 'entities', 'all']).optional().describe('What to list'),
    }),
  },
  {
    name: 'describe',
    description: 'Describe a node or the full architecture',
    inputSchema: z.object({
      id: z.string().optional().describe('Node ID (omit for full architecture overview)'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }),
  },
  {
    name: 'search',
    description: 'Search for nodes, edges, or entities by query',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      type: z.enum(['nodes', 'edges', 'entities']).optional().describe('Filter by type'),
    }),
  },
  {
    name: 'catalog',
    description: 'List available node types from the registry',
    inputSchema: z.object({
      namespace: z.string().optional().describe('Filter by namespace (e.g., compute, data)'),
    }),
  },
  // --- Project File Tools ---
  {
    name: 'read_project_file',
    description: 'Read a text file in the opened project. Binary files are not supported.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to project root (e.g., "src/app.ts")'),
    }),
  },
  {
    name: 'write_project_file',
    description: 'Create or overwrite a file in the opened project. Auto-creates parent directories.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to project root'),
      content: z.string().describe('Full file content'),
    }),
  },
  {
    name: 'update_project_file',
    description: 'Edit a file by replacing a specific string. Provide enough surrounding context in old_string to make the match unique.',
    inputSchema: z.object({
      path: z.string().describe('File path relative to project root'),
      old_string: z.string().describe('Exact text to find (must be unique in the file)'),
      new_string: z.string().describe('Replacement text'),
    }),
  },
  {
    name: 'list_project_files',
    description: 'List direct children (files and directories) of a directory in the opened project.',
    inputSchema: z.object({
      path: z.string().optional().describe('Directory path relative to project root (defaults to root)'),
    }),
  },
  {
    name: 'glob_project_files',
    description: 'Find files by glob pattern in the opened project. Supports *, **, ? wildcards.',
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern (e.g., "**/*.ts", "src/**/*.tsx")'),
      path: z.string().optional().describe('Base directory to search from (defaults to root)'),
    }),
  },
  {
    name: 'search_project_files',
    description: 'Search file contents by regex pattern in the opened project.',
    inputSchema: z.object({
      query: z.string().describe('Regex pattern to search for'),
      path: z.string().optional().describe('Subdirectory to scope the search (defaults to root)'),
      include: z.string().optional().describe('Glob filter for filenames (e.g., "*.ts")'),
    }),
  },
];

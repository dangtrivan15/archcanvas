/**
 * MCP Tool definitions for ArchCanvas.
 * Defines the 9 tools that the MCP server exposes to AI agents.
 */

import { z } from 'zod';

/**
 * Tool definitions with their input schemas.
 * Each tool maps directly to a Text API method.
 */
export const TOOL_DEFINITIONS = {
  describe: {
    name: 'describe',
    description: 'Describe the architecture in structured, human, or AI-optimized format.',
    inputSchema: {
      format: z.enum(['structured', 'human', 'ai']).default('structured').describe('Output format'),
      scope: z.enum(['full', 'node', 'nodes']).default('full').describe('Scope of description'),
      nodeId: z.string().optional().describe('Node ID (when scope is "node")'),
      nodeIds: z.array(z.string()).optional().describe('Node IDs (when scope is "nodes")'),
    },
  },

  add_node: {
    name: 'add_node',
    description: 'Add a new node to the architecture.',
    inputSchema: {
      type: z.string().describe('NodeDef type (e.g., "compute/service", "data/database")'),
      displayName: z.string().describe('Display name for the node'),
      parentId: z.string().optional().describe('Parent node ID for nesting'),
      x: z.number().optional().describe('X position'),
      y: z.number().optional().describe('Y position'),
      args: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Node arguments'),
    },
  },

  add_edge: {
    name: 'add_edge',
    description: 'Add a connection (edge) between two nodes.',
    inputSchema: {
      fromNode: z.string().describe('Source node ID'),
      toNode: z.string().describe('Target node ID'),
      type: z.enum(['sync', 'async', 'data-flow']).describe('Connection type'),
      fromPort: z.string().optional().describe('Source port name'),
      toPort: z.string().optional().describe('Target port name'),
      label: z.string().optional().describe('Edge label'),
    },
  },

  add_note: {
    name: 'add_note',
    description: 'Add a note to a node or edge.',
    inputSchema: {
      nodeId: z.string().optional().describe('Target node ID'),
      edgeId: z.string().optional().describe('Target edge ID'),
      author: z.string().describe('Note author'),
      content: z.string().describe('Note content (supports markdown)'),
      tags: z.array(z.string()).optional().describe('Note tags'),
    },
  },

  update_node: {
    name: 'update_node',
    description: 'Update a node\'s display name, args, or properties.',
    inputSchema: {
      nodeId: z.string().describe('Node ID to update'),
      displayName: z.string().optional().describe('New display name'),
      args: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Updated arguments'),
      properties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Updated properties'),
    },
  },

  remove_node: {
    name: 'remove_node',
    description: 'Remove a node and all connected edges.',
    inputSchema: {
      nodeId: z.string().describe('Node ID to remove'),
    },
  },

  remove_edge: {
    name: 'remove_edge',
    description: 'Remove an edge (connection) between nodes.',
    inputSchema: {
      edgeId: z.string().describe('Edge ID to remove'),
    },
  },

  search: {
    name: 'search',
    description: 'Full-text search across nodes, edges, and notes.',
    inputSchema: {
      query: z.string().describe('Search query'),
    },
  },

  list_nodedefs: {
    name: 'list_nodedefs',
    description: 'List all available node type definitions, optionally filtered by namespace.',
    inputSchema: {
      namespace: z.string().optional().describe('Filter by namespace (e.g., "compute", "data")'),
    },
  },

  save: {
    name: 'save',
    description: 'Explicitly save the current architecture state to the .archc file. Only works when the server was started with --file.',
    inputSchema: {
      force: z.boolean().optional().describe('Force save even if no changes detected (default: false)'),
    },
  },

  file_info: {
    name: 'file_info',
    description: 'Get metadata about the loaded .archc file (name, file path, timestamps, node/edge counts).',
    inputSchema: {},
  },
} as const;

/**
 * Get all tool names.
 */
export function getToolNames(): string[] {
  return Object.keys(TOOL_DEFINITIONS);
}

/**
 * Get the total number of registered tools.
 */
export function getToolCount(): number {
  return Object.keys(TOOL_DEFINITIONS).length;
}

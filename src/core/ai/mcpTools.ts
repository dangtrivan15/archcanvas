/**
 * Shared MCP tool definitions for ArchCanvas.
 *
 * Defines 9 tools that map to store actions (addNode, addEdge, etc.).
 * Used by both the Vite dev server and the Tauri sidecar.
 *
 * This is a Node.js-only module. It must NEVER be bundled into the browser build.
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';
import { parseCanvas } from '../../storage/yamlCodec';
import type { RelayStoreActionFn } from './bridgeServer';

export type { RelayStoreActionFn } from './bridgeServer';

const ROOT = '__root__';

function toCallToolResult(result: { ok: boolean; data?: unknown; error?: { code: string; message: string } }) {
  if (result.ok) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(result.error) }], isError: true };
}

/**
 * Create an MCP server with 9 ArchCanvas tools.
 * Each tool handler translates MCP args to dispatcher shape and relays via the provided function.
 */
export function createArchCanvasMcpServer(relay: RelayStoreActionFn) {
  return createSdkMcpServer({
    name: 'archcanvas',
    version: '0.1.0',
    tools: [
      // --- Write Tools ---
      tool('add_node', 'Add a node to the architecture canvas', {
        id: z.string().describe('Unique node identifier (kebab-case)'),
        type: z.string().describe('Node type (e.g., compute/service, data/database). Run catalog tool first.'),
        name: z.string().optional().describe('Display name'),
        args: z.string().optional().describe('Constructor arguments as JSON string'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const result = await relay('addNode', {
          canvasId: a.scope ?? ROOT,
          id: a.id, type: a.type, name: a.name, args: a.args,
        });
        return toCallToolResult(result);
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
        const edge = {
          from: { node: a.from, ...(a.fromPort ? { port: a.fromPort } : {}) },
          to: { node: a.to, ...(a.toPort ? { port: a.toPort } : {}) },
          ...(a.protocol ? { protocol: a.protocol } : {}),
          ...(a.label ? { label: a.label } : {}),
        };
        const result = await relay('addEdge', {
          canvasId: a.scope ?? ROOT, edge,
        });
        return toCallToolResult(result);
      }),

      tool('remove_node', 'Remove a node from the canvas', {
        id: z.string().describe('Node ID to remove'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const result = await relay('removeNode', {
          canvasId: a.scope ?? ROOT, nodeId: a.id,
        });
        return toCallToolResult(result);
      }),

      tool('remove_edge', 'Remove an edge between two nodes', {
        from: z.string().describe('Source node ID'),
        to: z.string().describe('Target node ID'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const result = await relay('removeEdge', {
          canvasId: a.scope ?? ROOT, from: a.from, to: a.to,
        });
        return toCallToolResult(result);
      }),

      tool('import_yaml', 'Import nodes, edges, and entities from YAML content', {
        yaml: z.string().describe('YAML content to import'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        let parsed;
        try {
          parsed = parseCanvas(a.yaml);
        } catch (err: any) {
          return { content: [{ type: 'text' as const, text: `YAML parse error: ${err.message}` }], isError: true };
        }
        const result = await relay('import', {
          canvasId: a.scope ?? ROOT,
          nodes: parsed.data.nodes ?? [],
          edges: parsed.data.edges ?? [],
          entities: parsed.data.entities ?? [],
        });
        return toCallToolResult(result);
      }),

      tool('create_subsystem', 'Create a subsystem (nested canvas) with its own scope', {
        id: z.string().describe('Unique subsystem identifier (kebab-case, becomes both node ID and filename)'),
        type: z.string().describe('Node type (e.g., compute/service). Run catalog tool first.'),
        name: z.string().optional().describe('Display name'),
        scope: z.string().optional().describe('Parent canvas scope ID (omit for root)'),
      }, async (a) => {
        const result = await relay('createSubsystem', {
          canvasId: a.scope ?? ROOT,
          id: a.id, type: a.type, name: a.name,
        });
        return toCallToolResult(result);
      }),

      // --- Entity Tools ---
      tool('add_entity', 'Add a data entity to a canvas scope', {
        name: z.string().describe('Entity name (unique within scope)'),
        description: z.string().optional().describe('Entity description'),
        codeRefs: z.array(z.string()).optional().describe('Code reference paths'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const result = await relay('addEntity', {
          canvasId: a.scope ?? ROOT,
          name: a.name,
          ...(a.description !== undefined && { description: a.description }),
          ...(a.codeRefs !== undefined && { codeRefs: a.codeRefs }),
        });
        return toCallToolResult(result);
      }),

      tool('remove_entity', 'Remove a data entity from a canvas scope. Fails if referenced by edges.', {
        name: z.string().describe('Entity name to remove'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const result = await relay('removeEntity', {
          canvasId: a.scope ?? ROOT,
          entityName: a.name,
        });
        return toCallToolResult(result);
      }),

      tool('update_entity', 'Update entity description or code references. Pass empty string/array to clear.', {
        name: z.string().describe('Entity name to update'),
        description: z.string().optional().describe('New description (empty string to clear)'),
        codeRefs: z.array(z.string()).optional().describe('New code reference paths (empty array to clear)'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const result = await relay('updateEntity', {
          canvasId: a.scope ?? ROOT,
          entityName: a.name,
          ...(a.description !== undefined && { description: a.description }),
          ...(a.codeRefs !== undefined && { codeRefs: a.codeRefs }),
        });
        return toCallToolResult(result);
      }),

      // --- Read Tools ---
      tool('list', 'List nodes, edges, or entities in a canvas', {
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
        type: z.enum(['nodes', 'edges', 'entities', 'all']).optional().describe('What to list'),
      }, async (a) => {
        const result = await relay('list', {
          canvasId: a.scope ?? ROOT, type: a.type,
        });
        return toCallToolResult(result);
      }),

      tool('describe', 'Describe a node or the full architecture', {
        id: z.string().optional().describe('Node ID (omit for full architecture overview)'),
        scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      }, async (a) => {
        const result = await relay('describe', {
          canvasId: a.scope ?? ROOT, ...(a.id ? { id: a.id } : {}),
        });
        return toCallToolResult(result);
      }),

      tool('search', 'Search for nodes, edges, or entities by query', {
        query: z.string().describe('Search query'),
        type: z.enum(['nodes', 'edges', 'entities']).optional().describe('Filter by type'),
      }, async (a) => {
        const result = await relay('search', {
          query: a.query, ...(a.type ? { type: a.type } : {}),
        });
        return toCallToolResult(result);
      }),

      tool('catalog', 'List available node types from the registry', {
        namespace: z.string().optional().describe('Filter by namespace (e.g., compute, data)'),
      }, async (a) => {
        const result = await relay('catalog', {
          ...(a.namespace ? { namespace: a.namespace } : {}),
        });
        return toCallToolResult(result);
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
];

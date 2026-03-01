/**
 * MCP Server for ArchCanvas.
 * Registers all tools and handles incoming tool calls via the Text API.
 * Supports stdio transport (for Claude Code) and SSE transport (for web agents).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOL_DEFINITIONS, getToolNames, getToolCount } from './tools';
import { dispatchToolCall, type ToolHandlerContext } from './handlers';
import type { TextApi } from '@/api/textApi';
import type { RegistryManager } from '@/core/registry/registryManager';

/**
 * Create and configure an MCP server with all ArchCanvas tools registered.
 */
export function createMcpServer(
  textApi: TextApi,
  registry: RegistryManager,
): McpServer {
  const server = new McpServer({
    name: 'archcanvas',
    version: '0.1.0',
  });

  const ctx: ToolHandlerContext = { textApi, registry };

  // Register all tools
  registerTools(server, ctx);

  console.log(`[MCP] Server created with ${getToolCount()} tools: ${getToolNames().join(', ')}`);

  return server;
}

/**
 * Register all tool definitions on the MCP server.
 */
function registerTools(server: McpServer, ctx: ToolHandlerContext): void {
  // 1. describe
  server.tool(
    TOOL_DEFINITIONS.describe.name,
    TOOL_DEFINITIONS.describe.description,
    TOOL_DEFINITIONS.describe.inputSchema,
    async (args) => {
      const result = dispatchToolCall(ctx, 'describe', args);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // 2. add_node
  server.tool(
    TOOL_DEFINITIONS.add_node.name,
    TOOL_DEFINITIONS.add_node.description,
    TOOL_DEFINITIONS.add_node.inputSchema,
    async (args) => {
      const result = dispatchToolCall(ctx, 'add_node', args);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // 3. add_edge
  server.tool(
    TOOL_DEFINITIONS.add_edge.name,
    TOOL_DEFINITIONS.add_edge.description,
    TOOL_DEFINITIONS.add_edge.inputSchema,
    async (args) => {
      const result = dispatchToolCall(ctx, 'add_edge', args);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // 4. add_note
  server.tool(
    TOOL_DEFINITIONS.add_note.name,
    TOOL_DEFINITIONS.add_note.description,
    TOOL_DEFINITIONS.add_note.inputSchema,
    async (args) => {
      const result = dispatchToolCall(ctx, 'add_note', args);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // 5. update_node
  server.tool(
    TOOL_DEFINITIONS.update_node.name,
    TOOL_DEFINITIONS.update_node.description,
    TOOL_DEFINITIONS.update_node.inputSchema,
    async (args) => {
      const result = dispatchToolCall(ctx, 'update_node', args);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // 6. remove_node
  server.tool(
    TOOL_DEFINITIONS.remove_node.name,
    TOOL_DEFINITIONS.remove_node.description,
    TOOL_DEFINITIONS.remove_node.inputSchema,
    async (args) => {
      const result = dispatchToolCall(ctx, 'remove_node', args);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // 7. remove_edge
  server.tool(
    TOOL_DEFINITIONS.remove_edge.name,
    TOOL_DEFINITIONS.remove_edge.description,
    TOOL_DEFINITIONS.remove_edge.inputSchema,
    async (args) => {
      const result = dispatchToolCall(ctx, 'remove_edge', args);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // 8. search
  server.tool(
    TOOL_DEFINITIONS.search.name,
    TOOL_DEFINITIONS.search.description,
    TOOL_DEFINITIONS.search.inputSchema,
    async (args) => {
      const result = dispatchToolCall(ctx, 'search', args);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // 9. list_nodedefs
  server.tool(
    TOOL_DEFINITIONS.list_nodedefs.name,
    TOOL_DEFINITIONS.list_nodedefs.description,
    TOOL_DEFINITIONS.list_nodedefs.inputSchema,
    async (args) => {
      const result = dispatchToolCall(ctx, 'list_nodedefs', args);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );
}

/**
 * Get the list of registered tool names (useful for verification).
 */
export { getToolNames, getToolCount };

/**
 * MCP Server for ArchCanvas.
 * Registers all tools and handles incoming tool calls via the Text API.
 * Supports stdio transport (for Claude Code) and SSE transport (for web agents).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOL_DEFINITIONS, getToolNames, getToolCount } from './tools';
import {
  dispatchToolCall,
  handleSave,
  handleFileInfo,
  autoSave,
  MUTATION_TOOLS,
  type ToolHandlerContext,
} from './handlers';
import type { TextApi } from '@/api/textApi';
import type { RegistryManager } from '@/core/registry/registryManager';
import type { GraphContext } from '@/cli/context';

/**
 * Create and configure an MCP server with all ArchCanvas tools registered.
 *
 * @param textApi - The Text API instance for graph operations
 * @param registry - The registry of node type definitions
 * @param graphContext - Optional GraphContext for file-backed persistence
 */
export function createMcpServer(
  textApi: TextApi,
  registry: RegistryManager,
  graphContext?: GraphContext,
): McpServer {
  const server = new McpServer({
    name: 'archcanvas',
    version: '0.1.0',
  });

  const ctx: ToolHandlerContext = { textApi, registry, graphContext };

  // Register all tools
  registerTools(server, ctx);

  console.log(`[MCP] Server created with ${getToolCount()} tools: ${getToolNames().join(', ')}`);
  if (graphContext) {
    console.log(`[MCP] File-backed mode: auto-save enabled`);
  }

  return server;
}

/**
 * Helper: create an async MCP tool handler that dispatches synchronous tool calls
 * and auto-saves after mutations when file-backed.
 */
function createToolHandler(ctx: ToolHandlerContext, toolName: string) {
  return async (args: Record<string, unknown>) => {
    const result = dispatchToolCall(ctx, toolName, args);

    // Auto-save after successful mutation tool calls
    if (MUTATION_TOOLS.has(toolName)) {
      await autoSave(ctx);
    }

    return { content: [{ type: 'text' as const, text: result }] };
  };
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
    createToolHandler(ctx, 'describe'),
  );

  // 2. add_node
  server.tool(
    TOOL_DEFINITIONS.add_node.name,
    TOOL_DEFINITIONS.add_node.description,
    TOOL_DEFINITIONS.add_node.inputSchema,
    createToolHandler(ctx, 'add_node'),
  );

  // 3. add_edge
  server.tool(
    TOOL_DEFINITIONS.add_edge.name,
    TOOL_DEFINITIONS.add_edge.description,
    TOOL_DEFINITIONS.add_edge.inputSchema,
    createToolHandler(ctx, 'add_edge'),
  );

  // 4. add_note
  server.tool(
    TOOL_DEFINITIONS.add_note.name,
    TOOL_DEFINITIONS.add_note.description,
    TOOL_DEFINITIONS.add_note.inputSchema,
    createToolHandler(ctx, 'add_note'),
  );

  // 5. update_node
  server.tool(
    TOOL_DEFINITIONS.update_node.name,
    TOOL_DEFINITIONS.update_node.description,
    TOOL_DEFINITIONS.update_node.inputSchema,
    createToolHandler(ctx, 'update_node'),
  );

  // 6. remove_node
  server.tool(
    TOOL_DEFINITIONS.remove_node.name,
    TOOL_DEFINITIONS.remove_node.description,
    TOOL_DEFINITIONS.remove_node.inputSchema,
    createToolHandler(ctx, 'remove_node'),
  );

  // 7. remove_edge
  server.tool(
    TOOL_DEFINITIONS.remove_edge.name,
    TOOL_DEFINITIONS.remove_edge.description,
    TOOL_DEFINITIONS.remove_edge.inputSchema,
    createToolHandler(ctx, 'remove_edge'),
  );

  // 8. search
  server.tool(
    TOOL_DEFINITIONS.search.name,
    TOOL_DEFINITIONS.search.description,
    TOOL_DEFINITIONS.search.inputSchema,
    createToolHandler(ctx, 'search'),
  );

  // 9. list_nodedefs
  server.tool(
    TOOL_DEFINITIONS.list_nodedefs.name,
    TOOL_DEFINITIONS.list_nodedefs.description,
    TOOL_DEFINITIONS.list_nodedefs.inputSchema,
    createToolHandler(ctx, 'list_nodedefs'),
  );

  // 10. save (async - file-backed mode)
  server.tool(
    TOOL_DEFINITIONS.save.name,
    TOOL_DEFINITIONS.save.description,
    TOOL_DEFINITIONS.save.inputSchema,
    async (args) => {
      const result = await handleSave(ctx, args as { force?: boolean });
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // 11. file_info
  server.tool(
    TOOL_DEFINITIONS.file_info.name,
    TOOL_DEFINITIONS.file_info.description,
    TOOL_DEFINITIONS.file_info.inputSchema,
    async () => {
      const result = handleFileInfo(ctx);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );
}

/**
 * Get the list of registered tool names (useful for verification).
 */
export { getToolNames, getToolCount };

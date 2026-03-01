#!/usr/bin/env node
/**
 * CLI entry point for the ArchCanvas MCP server.
 * Runs over stdio transport for integration with Claude Code.
 *
 * Usage: node --loader ts-node/esm src/mcp/cli.ts
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph } from '@/core/graph/graphEngine';

async function main() {
  // Initialize registry and create an empty graph
  const registry = new RegistryManager();
  registry.initialize();

  const graph = createEmptyGraph('Untitled Architecture');
  const textApi = new TextApi(graph, registry);

  // Create MCP server
  const mcpServer = createMcpServer(textApi, registry);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  console.error('[MCP CLI] ArchCanvas MCP server running on stdio');
}

main().catch((err) => {
  console.error('[MCP CLI] Fatal error:', err);
  process.exit(1);
});

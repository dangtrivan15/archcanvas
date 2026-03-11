#!/usr/bin/env node
/**
 * CLI entry point for the ArchCanvas MCP server.
 * Runs over stdio transport for integration with Claude Code.
 *
 * Usage:
 *   node --loader ts-node/esm src/mcp/cli.ts                 # empty graph
 *   node --loader ts-node/esm src/mcp/cli.ts --file proj.archc  # file-backed
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { GraphContext } from '@/cli/context';

/**
 * Parse --file <path> from process.argv (simple arg parsing for MCP CLI).
 */
function parseFileArg(): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--file');
  if (idx === -1) {
    const shortIdx = args.indexOf('-f');
    if (shortIdx === -1) return undefined;
    return args[shortIdx + 1];
  }
  return args[idx + 1];
}

async function main() {
  const filePath = parseFileArg();

  let textApi: TextApi;
  let registry: RegistryManager;
  let graphContext: GraphContext | undefined;

  if (filePath) {
    // File-backed mode: load .archc file via GraphContext
    try {
      graphContext = await GraphContext.loadFromFile(filePath);
      console.error(`[MCP CLI] Loaded architecture from: ${filePath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MCP CLI] Failed to load file "${filePath}": ${msg}`);
      process.exit(1);
    }

    // Use GraphContext's TextApi and wrap its registry
    textApi = graphContext.textApi;
    // GraphContext uses RegistryManagerCore; create a RegistryManager wrapper
    // that delegates to the same data. For MCP server we need RegistryManager interface.
    registry = new RegistryManager();
    registry.initialize();
  } else {
    // In-memory mode: empty graph (backward compatible)
    registry = new RegistryManager();
    registry.initialize();
    const graph = createEmptyGraph('Untitled Architecture');
    textApi = new TextApi(graph, registry);
    console.error('[MCP CLI] Starting with empty graph (no --file specified)');
  }

  // Create MCP server with optional file-backing context
  const mcpServer = createMcpServer(textApi, registry, graphContext);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  console.error('[MCP CLI] ArchCanvas MCP server running on stdio');
}

main().catch((err) => {
  console.error('[MCP CLI] Fatal error:', err);
  process.exit(1);
});

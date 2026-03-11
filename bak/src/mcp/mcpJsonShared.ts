/**
 * Shared constants and types for MCP JSON handling.
 *
 * This module contains ONLY browser-safe definitions (no Node.js imports).
 * Both mcpJson.ts (Node/CLI) and mcpJsonBrowser.ts (browser) import from here,
 * avoiding the issue where browser code transitively pulls in node:path.
 */

/** The key used for the archcanvas MCP server entry */
export const ARCHCANVAS_SERVER_KEY = 'archcanvas';

/** Shape of a single MCP server entry */
export interface McpServerEntry {
  command: string;
  args: string[];
  [key: string]: unknown;
}

/** Shape of a .mcp.json file */
export interface McpJsonFile {
  mcpServers: Record<string, McpServerEntry>;
  [key: string]: unknown;
}

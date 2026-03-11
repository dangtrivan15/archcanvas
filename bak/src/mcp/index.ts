/**
 * MCP (Model Context Protocol) module barrel export.
 */

export { createMcpServer, getToolNames, getToolCount } from './server';
export { TOOL_DEFINITIONS } from './tools';
export type { ToolHandlerContext } from './handlers';
export { MUTATION_TOOLS, dispatchToolCall, autoSave } from './handlers';

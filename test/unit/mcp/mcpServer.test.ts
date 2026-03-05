/**
 * Feature #177: MCP server registers 8+ tools.
 * Verifies that the MCP server initializes with all required tool definitions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getToolNames, getToolCount, TOOL_DEFINITIONS } from '@/mcp/tools';
import { dispatchToolCall, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP Server Tool Registration - Feature #177', () => {
  let ctx: ToolHandlerContext;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing MCP tools',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };
  });

  // Step 3: Verify at least 8 tools are registered
  it('registers at least 8 tools', () => {
    expect(getToolCount()).toBeGreaterThanOrEqual(8);
  });

  it('has exactly 19 tool definitions', () => {
    expect(getToolCount()).toBe(19);
  });

  // Step 4: Verify 'describe' tool exists
  it("has 'describe' tool", () => {
    const names = getToolNames();
    expect(names).toContain('describe');
    expect(TOOL_DEFINITIONS.describe).toBeDefined();
    expect(TOOL_DEFINITIONS.describe.description).toBeTruthy();
    expect(TOOL_DEFINITIONS.describe.inputSchema).toBeDefined();
  });

  // Step 5: Verify 'add_node' tool exists
  it("has 'add_node' tool", () => {
    const names = getToolNames();
    expect(names).toContain('add_node');
    expect(TOOL_DEFINITIONS.add_node).toBeDefined();
    expect(TOOL_DEFINITIONS.add_node.description).toBeTruthy();
    expect(TOOL_DEFINITIONS.add_node.inputSchema).toBeDefined();
  });

  // Step 6: Verify 'add_edge' tool exists
  it("has 'add_edge' tool", () => {
    const names = getToolNames();
    expect(names).toContain('add_edge');
    expect(TOOL_DEFINITIONS.add_edge).toBeDefined();
    expect(TOOL_DEFINITIONS.add_edge.description).toBeTruthy();
    expect(TOOL_DEFINITIONS.add_edge.inputSchema).toBeDefined();
  });

  // Step 7: Verify 'add_note' tool exists
  it("has 'add_note' tool", () => {
    const names = getToolNames();
    expect(names).toContain('add_note');
    expect(TOOL_DEFINITIONS.add_note).toBeDefined();
    expect(TOOL_DEFINITIONS.add_note.description).toBeTruthy();
    expect(TOOL_DEFINITIONS.add_note.inputSchema).toBeDefined();
  });

  // Step 8: Verify 'update_node' tool exists
  it("has 'update_node' tool", () => {
    const names = getToolNames();
    expect(names).toContain('update_node');
    expect(TOOL_DEFINITIONS.update_node).toBeDefined();
    expect(TOOL_DEFINITIONS.update_node.description).toBeTruthy();
    expect(TOOL_DEFINITIONS.update_node.inputSchema).toBeDefined();
  });

  // Step 9: Verify 'remove_node' tool exists
  it("has 'remove_node' tool", () => {
    const names = getToolNames();
    expect(names).toContain('remove_node');
    expect(TOOL_DEFINITIONS.remove_node).toBeDefined();
    expect(TOOL_DEFINITIONS.remove_node.description).toBeTruthy();
    expect(TOOL_DEFINITIONS.remove_node.inputSchema).toBeDefined();
  });

  // Step 10: Verify 'remove_edge' tool exists
  it("has 'remove_edge' tool", () => {
    const names = getToolNames();
    expect(names).toContain('remove_edge');
    expect(TOOL_DEFINITIONS.remove_edge).toBeDefined();
    expect(TOOL_DEFINITIONS.remove_edge.description).toBeTruthy();
    expect(TOOL_DEFINITIONS.remove_edge.inputSchema).toBeDefined();
  });

  // Step 11: Verify 'search' tool exists
  it("has 'search' tool", () => {
    const names = getToolNames();
    expect(names).toContain('search');
    expect(TOOL_DEFINITIONS.search).toBeDefined();
    expect(TOOL_DEFINITIONS.search.description).toBeTruthy();
    expect(TOOL_DEFINITIONS.search.inputSchema).toBeDefined();
  });

  // Step 12: Verify 'list_nodedefs' tool exists
  it("has 'list_nodedefs' tool", () => {
    const names = getToolNames();
    expect(names).toContain('list_nodedefs');
    expect(TOOL_DEFINITIONS.list_nodedefs).toBeDefined();
    expect(TOOL_DEFINITIONS.list_nodedefs.description).toBeTruthy();
    expect(TOOL_DEFINITIONS.list_nodedefs.inputSchema).toBeDefined();
  });

  // Verify all tool definitions have required fields
  it('all tool definitions have name, description, and inputSchema', () => {
    for (const [key, tool] of Object.entries(TOOL_DEFINITIONS)) {
      expect(tool.name).toBe(key);
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  // Verify handlers work via dispatch
  it('describe handler returns valid output', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('Test Architecture');
    expect(typeof parsed.nodeCount).toBe('number');
    expect(typeof parsed.edgeCount).toBe('number');
  });

  it('list_nodedefs handler returns all built-in defs', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);
    expect(parsed.count).toBeGreaterThanOrEqual(15);
    expect(parsed.nodedefs.length).toBeGreaterThanOrEqual(15);
  });

  it('search handler works with query', () => {
    const result = dispatchToolCall(ctx, 'search', { query: 'nonexistent' });
    const parsed = JSON.parse(result);
    expect(parsed.count).toBe(0);
    expect(Array.isArray(parsed.results)).toBe(true);
  });

  it('throws for unknown tool name', () => {
    expect(() => dispatchToolCall(ctx, 'unknown_tool', {})).toThrow('Unknown tool');
  });
});

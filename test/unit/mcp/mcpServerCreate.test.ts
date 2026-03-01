/**
 * Feature #177: MCP server creates and registers tools.
 * Tests that createMcpServer() properly initializes with all tools.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createMcpServer, getToolNames, getToolCount } from '@/mcp/server';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('createMcpServer() - Feature #177', () => {
  let registry: RegistryManager;
  let textApi: TextApi;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'MCP Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };

    textApi = new TextApi(graph, registry);
  });

  it('creates an MCP server instance without errors', () => {
    const server = createMcpServer(textApi, registry);
    expect(server).toBeDefined();
  });

  it('server has close method', () => {
    const server = createMcpServer(textApi, registry);
    expect(typeof server.close).toBe('function');
  });

  it('re-exports correct tool count', () => {
    expect(getToolCount()).toBe(9);
  });

  it('re-exports correct tool names', () => {
    const names = getToolNames();
    expect(names).toContain('describe');
    expect(names).toContain('add_node');
    expect(names).toContain('add_edge');
    expect(names).toContain('add_note');
    expect(names).toContain('update_node');
    expect(names).toContain('remove_node');
    expect(names).toContain('remove_edge');
    expect(names).toContain('search');
    expect(names).toContain('list_nodedefs');
  });
});

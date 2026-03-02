/**
 * Feature #192: Empty search returns appropriate empty state.
 *
 * Verifies that searching with no results returns an empty array,
 * the MCP search handler returns count: 0,
 * and the search input remains functional after an empty search.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleSearch, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { searchGraph } from '@/core/graph/graphQuery';
import type { ArchGraph } from '@/types/graph';

describe('Feature #192: Empty search returns appropriate empty state', () => {
  let ctx: ToolHandlerContext;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'E-Commerce System',
      description: 'An online marketplace',
      owners: ['team-alpha'],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };

    // Add some nodes to the architecture for realistic testing
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'API Gateway',
    });
    dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'User Database',
    });
    dispatchToolCall(ctx, 'add_node', {
      type: 'messaging/message-queue',
      displayName: 'Order Queue',
    });
  });

  describe('searchGraph returns empty array for non-matching queries', () => {
    it('returns empty array for zzznonexistentzz', () => {
      const results = ctx.textApi.search('zzznonexistentzz');
      expect(results).toEqual([]);
      expect(results.length).toBe(0);
    });

    it('returns empty array for completely unrelated query', () => {
      const results = ctx.textApi.search('xylophone_quantum_nebula');
      expect(results).toEqual([]);
    });

    it('returns empty array for whitespace-only query', () => {
      const results = ctx.textApi.search('   ');
      expect(results).toEqual([]);
    });

    it('returns empty array for empty string query', () => {
      const results = ctx.textApi.search('');
      expect(results).toEqual([]);
    });
  });

  describe('MCP search handler returns empty results with count: 0', () => {
    it('MCP search for zzznonexistentzz returns count: 0', () => {
      const resultStr = dispatchToolCall(ctx, 'search', { query: 'zzznonexistentzz' });
      const result = JSON.parse(resultStr);

      expect(result.results).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('handleSearch returns empty results with count: 0', () => {
      const resultStr = handleSearch(ctx, { query: 'totally_bogus_query_xyz' });
      const result = JSON.parse(resultStr);

      expect(result.results).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('search returns valid JSON with results array even when empty', () => {
      const resultStr = dispatchToolCall(ctx, 'search', { query: 'nonexistent12345' });
      const result = JSON.parse(resultStr);

      expect(Array.isArray(result.results)).toBe(true);
      expect(typeof result.count).toBe('number');
      expect(result.count).toBe(0);
    });
  });

  describe('search input remains functional after empty search', () => {
    it('returns results for a valid query after an empty search', () => {
      // First search that returns nothing
      const emptyResults = ctx.textApi.search('zzznonexistentzz');
      expect(emptyResults).toEqual([]);

      // Second search that should find something
      const validResults = ctx.textApi.search('API Gateway');
      expect(validResults.length).toBeGreaterThan(0);
      expect(validResults.some((r) => r.displayName === 'API Gateway')).toBe(true);
    });

    it('can perform multiple empty searches followed by a valid search', () => {
      // Multiple empty searches
      expect(ctx.textApi.search('zzz1')).toEqual([]);
      expect(ctx.textApi.search('zzz2')).toEqual([]);
      expect(ctx.textApi.search('zzz3')).toEqual([]);

      // Valid search still works
      const results = ctx.textApi.search('Database');
      expect(results.length).toBeGreaterThan(0);
    });

    it('MCP search works normally after an empty search via MCP', () => {
      // Empty MCP search
      const emptyResult = JSON.parse(dispatchToolCall(ctx, 'search', { query: 'nonexistent_xyz' }));
      expect(emptyResult.count).toBe(0);

      // Valid MCP search
      const validResult = JSON.parse(dispatchToolCall(ctx, 'search', { query: 'Order Queue' }));
      expect(validResult.count).toBeGreaterThan(0);
    });
  });

  describe('searchGraph function handles empty state correctly', () => {
    it('returns empty array when searching an empty graph', () => {
      const emptyGraph: ArchGraph = {
        name: 'Empty',
        description: '',
        owners: [],
        nodes: [],
        edges: [],
      };
      const results = searchGraph(emptyGraph, 'anything');
      expect(results).toEqual([]);
    });

    it('returns empty array for non-matching query on populated graph', () => {
      const graph = ctx.textApi.getGraph();
      const results = searchGraph(graph, 'zzznonexistentzz');
      expect(results).toEqual([]);
    });

    it('returned empty array is a proper Array with length 0', () => {
      const results = searchGraph(ctx.textApi.getGraph(), 'zzznonexistentzz');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
      expect(results).toStrictEqual([]);
    });
  });

  describe('registry search also handles empty results', () => {
    it('registry.search returns empty array for non-matching query', () => {
      const results = ctx.registry.search('zzznonexistentzz');
      expect(results).toEqual([]);
      expect(results.length).toBe(0);
    });

    it('registry.search still works after empty search', () => {
      // Empty search
      const empty = ctx.registry.search('nonexistent_type_abc');
      expect(empty).toEqual([]);

      // Valid search
      const results = ctx.registry.search('service');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

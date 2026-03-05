/**
 * Feature #186: MCP list_nodedefs returns all built-in definitions.
 * Verifies that the MCP list_nodedefs tool returns all 15 built-in nodedef summaries
 * with the correct fields and all 5 namespaces represented.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { dispatchToolCall, handleListNodedefs, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP list_nodedefs - Feature #186', () => {
  let ctx: ToolHandlerContext;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing list_nodedefs',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };
  });

  // Step 1: Call MCP list_nodedefs
  it('list_nodedefs returns a valid JSON response', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
    expect(parsed.nodedefs).toBeDefined();
    expect(Array.isArray(parsed.nodedefs)).toBe(true);
    expect(typeof parsed.count).toBe('number');
  });

  // Step 2: Verify response contains 15 or more nodedefs
  it('returns 15 or more nodedefs', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);
    expect(parsed.count).toBeGreaterThanOrEqual(15);
    expect(parsed.nodedefs.length).toBeGreaterThanOrEqual(15);
    expect(parsed.count).toBe(parsed.nodedefs.length);
  });

  // Step 3: Verify each has name, namespace, displayName
  it('each nodedef has name, namespace, and displayName fields', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);

    for (const def of parsed.nodedefs) {
      expect(def.name).toBeDefined();
      expect(typeof def.name).toBe('string');
      expect(def.name.length).toBeGreaterThan(0);

      expect(def.namespace).toBeDefined();
      expect(typeof def.namespace).toBe('string');
      expect(def.namespace.length).toBeGreaterThan(0);

      expect(def.displayName).toBeDefined();
      expect(typeof def.displayName).toBe('string');
      expect(def.displayName.length).toBeGreaterThan(0);
    }
  });

  // Step 3 (continued): Verify type field is namespace/name
  it('each nodedef has a type field matching namespace/name', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);

    for (const def of parsed.nodedefs) {
      expect(def.type).toBe(`${def.namespace}/${def.name}`);
    }
  });

  // Step 4: Verify all original 5 namespaces (plus new ones) are represented
  it('all 5 original namespaces are represented', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);

    const namespaces = new Set(parsed.nodedefs.map((d: { namespace: string }) => d.namespace));

    expect(namespaces.has('compute')).toBe(true);
    expect(namespaces.has('data')).toBe(true);
    expect(namespaces.has('messaging')).toBe(true);
    expect(namespaces.has('network')).toBe(true);
    expect(namespaces.has('observability')).toBe(true);
    expect(namespaces.size).toBeGreaterThanOrEqual(5);
  });

  // Verify minimum distribution across namespaces
  it('has correct minimum nodedef distribution per namespace', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);

    const nsByCount: Record<string, number> = {};
    for (const def of parsed.nodedefs) {
      nsByCount[def.namespace] = (nsByCount[def.namespace] || 0) + 1;
    }

    expect(nsByCount['compute']).toBeGreaterThanOrEqual(4);
    expect(nsByCount['data']).toBeGreaterThanOrEqual(4);
    expect(nsByCount['messaging']).toBeGreaterThanOrEqual(3);
    expect(nsByCount['network']).toBeGreaterThanOrEqual(2);
    expect(nsByCount['observability']).toBeGreaterThanOrEqual(2);
  });

  // Verify all expected nodedef types are present
  it('contains all 15 expected nodedef types', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);

    const types = new Set(parsed.nodedefs.map((d: { type: string }) => d.type));

    // Compute
    expect(types.has('compute/service')).toBe(true);
    expect(types.has('compute/function')).toBe(true);
    expect(types.has('compute/worker')).toBe(true);
    expect(types.has('compute/api-gateway')).toBe(true);

    // Data
    expect(types.has('data/database')).toBe(true);
    expect(types.has('data/cache')).toBe(true);
    expect(types.has('data/object-storage')).toBe(true);
    expect(types.has('data/repository')).toBe(true);

    // Messaging
    expect(types.has('messaging/message-queue')).toBe(true);
    expect(types.has('messaging/event-bus')).toBe(true);
    expect(types.has('messaging/stream-processor')).toBe(true);

    // Network
    expect(types.has('network/load-balancer')).toBe(true);
    expect(types.has('network/cdn')).toBe(true);

    // Observability
    expect(types.has('observability/logging')).toBe(true);
    expect(types.has('observability/monitoring')).toBe(true);
  });

  // Verify each nodedef also has description and icon
  it('each nodedef has description and icon fields', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);

    for (const def of parsed.nodedefs) {
      expect(def.description).toBeDefined();
      expect(typeof def.description).toBe('string');
      expect(def.description.length).toBeGreaterThan(0);

      expect(def.icon).toBeDefined();
      expect(typeof def.icon).toBe('string');
      expect(def.icon.length).toBeGreaterThan(0);
    }
  });

  // Verify namespace-filtered queries work
  it('filters by namespace when namespace param is provided', () => {
    const result = handleListNodedefs(ctx, { namespace: 'compute' });
    const parsed = JSON.parse(result);

    expect(parsed.namespace).toBe('compute');
    expect(parsed.count).toBeGreaterThanOrEqual(4);
    expect(parsed.nodedefs.length).toBeGreaterThanOrEqual(4);

    for (const def of parsed.nodedefs) {
      expect(def.namespace).toBe('compute');
      expect(def.name).toBeDefined();
      expect(def.displayName).toBeDefined();
    }
  });

  it('namespace filter returns correct minimum count for each namespace', () => {
    const expected: Record<string, number> = {
      compute: 4,
      data: 4,
      messaging: 3,
      network: 2,
      observability: 2,
    };

    for (const [ns, minCount] of Object.entries(expected)) {
      const result = handleListNodedefs(ctx, { namespace: ns });
      const parsed = JSON.parse(result);
      expect(parsed.count).toBeGreaterThanOrEqual(minCount);
      expect(parsed.nodedefs.length).toBeGreaterThanOrEqual(minCount);
    }
  });

  // Verify dispatch route works for list_nodedefs
  it('dispatchToolCall correctly routes to list_nodedefs handler', () => {
    const result = dispatchToolCall(ctx, 'list_nodedefs', {});
    const parsed = JSON.parse(result);
    expect(parsed.count).toBeGreaterThanOrEqual(15);
    expect(parsed.nodedefs.length).toBeGreaterThanOrEqual(15);
  });
});

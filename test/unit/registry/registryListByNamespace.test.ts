/**
 * Feature #9: Registry lists nodedefs grouped by namespace.
 * Verifies that RegistryManager.listByNamespace() returns nodedefs
 * organized into their correct namespace groups.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { RegistryManager } from '@/core/registry/registryManager';

describe('RegistryManager.listByNamespace()', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  // Step 1: Call registry.listByNamespace() (verify it exists and works)
  it('returns an array of NodeDefs for a valid namespace', () => {
    const result = registry.listByNamespace('compute');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  // Step 2: Verify 'compute' group contains at least service, function, worker, api-gateway
  it('compute namespace contains service, function, worker, api-gateway', () => {
    const results = registry.listByNamespace('compute');
    const names = results.map((def) => def.metadata.name).sort();
    expect(names).toContain('api-gateway');
    expect(names).toContain('function');
    expect(names).toContain('service');
    expect(names).toContain('worker');
    expect(results.length).toBeGreaterThanOrEqual(4);

    // Verify all belong to compute namespace
    for (const def of results) {
      expect(def.metadata.namespace).toBe('compute');
      expect(def.kind).toBe('NodeDef');
    }
  });

  // Step 3: Verify 'data' group contains at least database, cache, object-storage, repository
  it('data namespace contains database, cache, object-storage, repository', () => {
    const results = registry.listByNamespace('data');
    const names = results.map((def) => def.metadata.name).sort();
    expect(names).toContain('cache');
    expect(names).toContain('database');
    expect(names).toContain('object-storage');
    expect(names).toContain('repository');
    expect(results.length).toBeGreaterThanOrEqual(4);

    for (const def of results) {
      expect(def.metadata.namespace).toBe('data');
      expect(def.kind).toBe('NodeDef');
    }
  });

  // Step 4: Verify 'messaging' group contains at least message-queue, event-bus, stream-processor
  it('messaging namespace contains message-queue, event-bus, stream-processor', () => {
    const results = registry.listByNamespace('messaging');
    const names = results.map((def) => def.metadata.name).sort();
    expect(names).toContain('event-bus');
    expect(names).toContain('message-queue');
    expect(names).toContain('stream-processor');
    expect(results.length).toBeGreaterThanOrEqual(3);

    for (const def of results) {
      expect(def.metadata.namespace).toBe('messaging');
      expect(def.kind).toBe('NodeDef');
    }
  });

  // Step 5: Verify 'network' group contains load-balancer, cdn
  it('network namespace contains load-balancer, cdn', () => {
    const results = registry.listByNamespace('network');
    const names = results.map((def) => def.metadata.name).sort();
    expect(names).toEqual(['cdn', 'load-balancer']);
    expect(results).toHaveLength(2);

    for (const def of results) {
      expect(def.metadata.namespace).toBe('network');
      expect(def.kind).toBe('NodeDef');
    }
  });

  // Step 6: Verify 'observability' group contains at least logging, monitoring
  it('observability namespace contains logging, monitoring', () => {
    const results = registry.listByNamespace('observability');
    const names = results.map((def) => def.metadata.name).sort();
    expect(names).toContain('logging');
    expect(names).toContain('monitoring');
    expect(results.length).toBeGreaterThanOrEqual(2);

    for (const def of results) {
      expect(def.metadata.namespace).toBe('observability');
      expect(def.kind).toBe('NodeDef');
    }
  });

  // Verify all original 5 namespaces (plus new ones) are present
  it('lists at least 5 namespaces', () => {
    const namespaces = registry.listNamespaces().sort();
    expect(namespaces).toContain('compute');
    expect(namespaces).toContain('data');
    expect(namespaces).toContain('messaging');
    expect(namespaces).toContain('network');
    expect(namespaces).toContain('observability');
    expect(namespaces.length).toBeGreaterThanOrEqual(5);
  });

  // All namespaces combined total all nodedefs
  it('all namespace groups total equals registry size', () => {
    const namespaces = registry.listNamespaces();
    let total = 0;
    for (const ns of namespaces) {
      total += registry.listByNamespace(ns).length;
    }
    expect(total).toBe(registry.size);
    expect(total).toBeGreaterThanOrEqual(15);
  });

  // Edge case: nonexistent namespace returns empty array
  it('returns empty array for nonexistent namespace', () => {
    const result = registry.listByNamespace('nonexistent');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty string namespace', () => {
    const result = registry.listByNamespace('');
    expect(result).toEqual([]);
  });
});

/**
 * Feature #10: Registry search finds nodedefs by name and tags
 *
 * Registry search functionality matches nodedefs by their displayName,
 * name, description, and tags.
 *
 * Steps verified:
 * 1. Search for 'database' and verify data/database nodedef is in results
 * 2. Search for 'queue' and verify messaging/message-queue is in results
 * 3. Search for 'load' and verify network/load-balancer is in results
 * 4. Search for tag 'compute' and verify compute namespace defs appear
 * 5. Search for empty string and verify all nodedefs returned
 * 6. Search for 'zzzznonexistent' and verify empty results
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RegistryManager } from '@/core/registry/registryManager';

describe('Feature #10: Registry search finds nodedefs by name and tags', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  // --- Step 1: Search for 'database' → data/database in results ---

  it('should find data/database nodedef when searching for "database"', () => {
    const results = registry.search('database');
    expect(results.length).toBeGreaterThan(0);

    const dbDef = results.find(
      (def) => def.metadata.namespace === 'data' && def.metadata.name === 'database',
    );
    expect(dbDef).toBeDefined();
    expect(dbDef!.metadata.displayName).toBe('Database');
  });

  // --- Step 2: Search for 'queue' → messaging/message-queue in results ---

  it('should find messaging/message-queue nodedef when searching for "queue"', () => {
    const results = registry.search('queue');
    expect(results.length).toBeGreaterThan(0);

    const mqDef = results.find(
      (def) => def.metadata.namespace === 'messaging' && def.metadata.name === 'message-queue',
    );
    expect(mqDef).toBeDefined();
    expect(mqDef!.metadata.displayName).toBe('Message Queue');
  });

  // --- Step 3: Search for 'load' → network/load-balancer in results ---

  it('should find network/load-balancer nodedef when searching for "load"', () => {
    const results = registry.search('load');
    expect(results.length).toBeGreaterThan(0);

    const lbDef = results.find(
      (def) => def.metadata.namespace === 'network' && def.metadata.name === 'load-balancer',
    );
    expect(lbDef).toBeDefined();
    expect(lbDef!.metadata.displayName).toBe('Load Balancer');
  });

  // --- Step 4: Search for tag 'compute' → compute namespace defs appear ---

  it('should find all compute namespace nodedefs when searching for tag "compute"', () => {
    const results = registry.search('compute');
    expect(results.length).toBeGreaterThanOrEqual(4);

    // All 4 compute namespace defs should appear: service, function, worker, api-gateway
    const computeNames = results
      .filter((def) => def.metadata.namespace === 'compute')
      .map((def) => def.metadata.name)
      .sort();

    expect(computeNames).toContain('service');
    expect(computeNames).toContain('function');
    expect(computeNames).toContain('worker');
    expect(computeNames).toContain('api-gateway');
  });

  // --- Step 5: Search for empty string → all nodedefs returned ---

  it('should return all nodedefs when searching for empty string', () => {
    const results = registry.search('');
    expect(results).toHaveLength(registry.size);
    expect(results).toHaveLength(15);
  });

  // --- Step 6: Search for 'zzzznonexistent' → empty results ---

  it('should return empty results for "zzzznonexistent"', () => {
    const results = registry.search('zzzznonexistent');
    expect(results).toHaveLength(0);
  });

  // --- Additional verification tests ---

  it('should be case-insensitive when searching', () => {
    const lower = registry.search('database');
    const upper = registry.search('DATABASE');
    const mixed = registry.search('DaTaBaSe');

    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBe(mixed.length);
    expect(lower.length).toBeGreaterThan(0);
  });

  it('should match against displayName', () => {
    // 'Load Balancer' has displayName 'Load Balancer'
    const results = registry.search('Load Balancer');
    expect(results.length).toBeGreaterThan(0);

    const lbDef = results.find((def) => def.metadata.name === 'load-balancer');
    expect(lbDef).toBeDefined();
  });

  it('should match against description text', () => {
    // Database description likely contains words like "relational" or "SQL" or "storage"
    const results = registry.search('storage');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should match against tags', () => {
    // 'serverless' is a tag on compute/function
    const results = registry.search('serverless');
    expect(results.length).toBeGreaterThan(0);

    const fnDef = results.find(
      (def) => def.metadata.namespace === 'compute' && def.metadata.name === 'function',
    );
    expect(fnDef).toBeDefined();
  });

  it('should match against metadata name', () => {
    // Search for 'service' which is the metadata.name of compute/service
    const results = registry.search('service');
    expect(results.length).toBeGreaterThan(0);

    const svcDef = results.find(
      (def) => def.metadata.namespace === 'compute' && def.metadata.name === 'service',
    );
    expect(svcDef).toBeDefined();
  });

  it('should find multiple matching nodedefs for broad queries', () => {
    // 'async' appears as a tag on messaging/message-queue and compute/worker
    const results = registry.search('async');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('should support partial string matching', () => {
    // 'gate' should match 'api-gateway' (name) and 'Payment Gateway'-like displayName
    const results = registry.search('gate');
    expect(results.length).toBeGreaterThan(0);

    const gwDef = results.find((def) => def.metadata.name === 'api-gateway');
    expect(gwDef).toBeDefined();
  });
});

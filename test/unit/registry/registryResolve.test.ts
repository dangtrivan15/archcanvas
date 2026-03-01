/**
 * Feature #8: Registry resolves nodedefs by type identifier.
 * Verifies that RegistryManager.resolve() returns the correct NodeDef
 * when given a namespace/name type string.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { RegistryManager } from '@/core/registry/registryManager';
import type { NodeDef } from '@/types/nodedef';

describe('RegistryManager.resolve()', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  it('should be initialized with 15 built-in nodedefs', () => {
    expect(registry.isInitialized()).toBe(true);
    expect(registry.size).toBe(15);
  });

  // Step 2: Resolve 'compute/service'
  it('resolves compute/service and returns the service NodeDef', () => {
    const result = registry.resolve('compute/service');
    expect(result).toBeDefined();
    expect(result!.kind).toBe('NodeDef');
    expect(result!.metadata.namespace).toBe('compute');
    expect(result!.metadata.name).toBe('service');
    expect(result!.metadata.displayName).toBeTruthy();
    expect(result!.spec).toBeDefined();
  });

  // Step 3: Resolve 'data/database'
  it('resolves data/database and returns the database NodeDef', () => {
    const result = registry.resolve('data/database');
    expect(result).toBeDefined();
    expect(result!.kind).toBe('NodeDef');
    expect(result!.metadata.namespace).toBe('data');
    expect(result!.metadata.name).toBe('database');
    expect(result!.metadata.displayName).toBeTruthy();
    expect(result!.spec).toBeDefined();
  });

  // Step 4: Resolve 'messaging/message-queue'
  it('resolves messaging/message-queue and returns the message-queue NodeDef', () => {
    const result = registry.resolve('messaging/message-queue');
    expect(result).toBeDefined();
    expect(result!.kind).toBe('NodeDef');
    expect(result!.metadata.namespace).toBe('messaging');
    expect(result!.metadata.name).toBe('message-queue');
    expect(result!.metadata.displayName).toBeTruthy();
    expect(result!.spec).toBeDefined();
  });

  // Step 5: Resolve 'network/load-balancer'
  it('resolves network/load-balancer and returns the load-balancer NodeDef', () => {
    const result = registry.resolve('network/load-balancer');
    expect(result).toBeDefined();
    expect(result!.kind).toBe('NodeDef');
    expect(result!.metadata.namespace).toBe('network');
    expect(result!.metadata.name).toBe('load-balancer');
    expect(result!.metadata.displayName).toBeTruthy();
    expect(result!.spec).toBeDefined();
  });

  // Step 6: Resolve 'observability/logging'
  it('resolves observability/logging and returns the logging NodeDef', () => {
    const result = registry.resolve('observability/logging');
    expect(result).toBeDefined();
    expect(result!.kind).toBe('NodeDef');
    expect(result!.metadata.namespace).toBe('observability');
    expect(result!.metadata.name).toBe('logging');
    expect(result!.metadata.displayName).toBeTruthy();
    expect(result!.spec).toBeDefined();
  });

  // Step 7: Resolve nonexistent type
  it('returns undefined for nonexistent/type', () => {
    const result = registry.resolve('nonexistent/type');
    expect(result).toBeUndefined();
  });

  // Additional: verify all 15 types are resolvable
  it('resolves all 15 built-in nodedefs by type', () => {
    const allTypes = [
      'compute/service',
      'compute/function',
      'compute/worker',
      'compute/api-gateway',
      'data/database',
      'data/cache',
      'data/object-storage',
      'data/repository',
      'messaging/message-queue',
      'messaging/event-bus',
      'messaging/stream-processor',
      'network/load-balancer',
      'network/cdn',
      'observability/logging',
      'observability/monitoring',
    ];

    for (const type of allTypes) {
      const result = registry.resolve(type);
      expect(result).toBeDefined();
      expect(result!.kind).toBe('NodeDef');
      const [ns, name] = type.split('/');
      expect(result!.metadata.namespace).toBe(ns);
      expect(result!.metadata.name).toBe(name);
    }
  });

  // Edge cases
  it('returns undefined for empty string', () => {
    expect(registry.resolve('')).toBeUndefined();
  });

  it('returns undefined for partial type (namespace only)', () => {
    expect(registry.resolve('compute')).toBeUndefined();
  });

  it('returns undefined for reversed order (name/namespace)', () => {
    expect(registry.resolve('service/compute')).toBeUndefined();
  });

  it('throws if registry is not initialized', () => {
    const uninit = new RegistryManager();
    expect(() => uninit.resolve('compute/service')).toThrow(
      'Not initialized',
    );
  });
});

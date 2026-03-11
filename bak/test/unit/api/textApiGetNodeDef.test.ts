/**
 * Feature #50: Text API getNodeDef() resolves nodedef type info.
 * Verifies that TextAPI.getNodeDef() returns the NodeDef definition
 * for a given type string.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('TextApi.getNodeDef()', () => {
  let textApi: TextApi;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const emptyGraph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Test description',
      owners: [],
      nodes: [],
      edges: [],
    };

    textApi = new TextApi(emptyGraph, registry);
  });

  // Step 1: Call textApi.getNodeDef('compute/service')
  it('returns NodeDef for compute/service', () => {
    const result = textApi.getNodeDef('compute/service');
    expect(result).toBeDefined();
    expect(result!.kind).toBe('NodeDef');
  });

  // Step 2: Verify returned NodeDef has correct metadata
  it('returned NodeDef has correct metadata for compute/service', () => {
    const result = textApi.getNodeDef('compute/service');
    expect(result).toBeDefined();
    expect(result!.metadata.namespace).toBe('compute');
    expect(result!.metadata.name).toBe('service');
    expect(result!.metadata.displayName).toBeTruthy();
    expect(result!.metadata.description).toBeTruthy();
    expect(result!.metadata.icon).toBeTruthy();
    expect(result!.metadata.version).toBeTruthy();
    expect(Array.isArray(result!.metadata.tags)).toBe(true);
  });

  // Step 3: Verify spec includes args, ports definitions
  it('returned NodeDef spec includes args and ports', () => {
    const result = textApi.getNodeDef('compute/service');
    expect(result).toBeDefined();
    expect(result!.spec).toBeDefined();

    // Args should be an array
    expect(Array.isArray(result!.spec.args)).toBe(true);
    expect(result!.spec.args.length).toBeGreaterThan(0);

    // Each arg should have name, type, description
    for (const arg of result!.spec.args) {
      expect(arg.name).toBeTruthy();
      expect(arg.type).toBeTruthy();
      expect(arg.description).toBeTruthy();
    }

    // Ports should be an array
    expect(Array.isArray(result!.spec.ports)).toBe(true);
    expect(result!.spec.ports.length).toBeGreaterThan(0);

    // Each port should have name and protocol
    for (const port of result!.spec.ports) {
      expect(port.name).toBeTruthy();
      expect(Array.isArray(port.protocol)).toBe(true);
    }
  });

  // Step 4: Call textApi.getNodeDef('invalid/type') and verify appropriate error
  it('returns undefined for invalid/type', () => {
    const result = textApi.getNodeDef('invalid/type');
    expect(result).toBeUndefined();
  });

  // Additional coverage: verify different nodedef types work
  it('resolves data/database with correct metadata', () => {
    const result = textApi.getNodeDef('data/database');
    expect(result).toBeDefined();
    expect(result!.metadata.namespace).toBe('data');
    expect(result!.metadata.name).toBe('database');
    expect(result!.spec.args.length).toBeGreaterThan(0);
    expect(result!.spec.ports.length).toBeGreaterThan(0);
  });

  it('resolves messaging/message-queue with correct metadata', () => {
    const result = textApi.getNodeDef('messaging/message-queue');
    expect(result).toBeDefined();
    expect(result!.metadata.namespace).toBe('messaging');
    expect(result!.metadata.name).toBe('message-queue');
  });

  it('resolves network/load-balancer with correct metadata', () => {
    const result = textApi.getNodeDef('network/load-balancer');
    expect(result).toBeDefined();
    expect(result!.metadata.namespace).toBe('network');
    expect(result!.metadata.name).toBe('load-balancer');
  });

  it('resolves observability/logging with correct metadata', () => {
    const result = textApi.getNodeDef('observability/logging');
    expect(result).toBeDefined();
    expect(result!.metadata.namespace).toBe('observability');
    expect(result!.metadata.name).toBe('logging');
  });

  // Edge cases
  it('returns undefined for empty string', () => {
    expect(textApi.getNodeDef('')).toBeUndefined();
  });

  it('returns undefined for partial type', () => {
    expect(textApi.getNodeDef('compute')).toBeUndefined();
  });
});

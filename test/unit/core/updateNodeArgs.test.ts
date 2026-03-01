/**
 * Feature #14: Graph engine updates node args
 *
 * updateNode() correctly modifies a node's args map while preserving other fields.
 *
 * Steps verified:
 * 1. Create node with args {port: '8080'}
 * 2. Call updateNode with args {port: '3000', replicas: '3'}
 * 3. Verify node.args.port is '3000'
 * 4. Verify node.args.replicas is '3'
 * 5. Verify node.displayName unchanged
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  addNode,
  addChildNode,
  updateNode,
  findNode,
} from '@/core/graph/graphEngine';

describe('Feature #14: updateNode() updates node args correctly', () => {
  it('should update args port from 8080 to 3000 and add replicas', () => {
    // Step 1: Create node with args {port: '8080'}
    const node = createNode({
      type: 'compute/service',
      displayName: 'API Service',
      args: { port: '8080' },
    });
    let graph = createEmptyGraph('Test Architecture');
    graph = addNode(graph, node);

    // Step 2: Call updateNode with args {port: '3000', replicas: '3'}
    const updatedGraph = updateNode(graph, node.id, {
      args: { port: '3000', replicas: '3' },
    });

    // Step 3: Verify node.args.port is '3000'
    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.args.port).toBe('3000');

    // Step 4: Verify node.args.replicas is '3'
    expect(updatedNode.args.replicas).toBe('3');

    // Step 5: Verify node.displayName unchanged
    expect(updatedNode.displayName).toBe('API Service');
  });

  it('should preserve node type after args update', () => {
    const node = createNode({
      type: 'data/database',
      displayName: 'Users DB',
      args: { engine: 'PostgreSQL' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, {
      args: { engine: 'MySQL', version: '8.0' },
    });

    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.type).toBe('data/database');
    expect(updatedNode.args.engine).toBe('MySQL');
    expect(updatedNode.args.version).toBe('8.0');
  });

  it('should preserve position after args update', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Gateway',
      args: { port: '443' },
      position: { x: 150, y: 300 },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, {
      args: { port: '8443', tls: 'enabled' },
    });

    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.position.x).toBe(150);
    expect(updatedNode.position.y).toBe(300);
    expect(updatedNode.args.port).toBe('8443');
    expect(updatedNode.args.tls).toBe('enabled');
  });

  it('should preserve notes after args update', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service A',
      args: { runtime: 'node' },
    });
    // Manually add a note to the node
    const nodeWithNote = {
      ...node,
      notes: [
        {
          id: 'note-1',
          author: 'alice',
          timestampMs: Date.now(),
          content: 'Review this service',
          tags: ['review'],
          status: 'pending' as const,
        },
      ],
    };
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeWithNote);

    const updatedGraph = updateNode(graph, node.id, {
      args: { runtime: 'bun', version: '1.0' },
    });

    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.notes).toHaveLength(1);
    expect(updatedNode.notes[0].content).toBe('Review this service');
    expect(updatedNode.args.runtime).toBe('bun');
  });

  it('should preserve codeRefs after args update', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Auth Service',
      args: { protocol: 'gRPC' },
    });
    const nodeWithRefs = {
      ...node,
      codeRefs: [
        { path: 'src/auth/service.ts', role: 'source' as const },
        { path: 'proto/auth.proto', role: 'schema' as const },
      ],
    };
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeWithRefs);

    const updatedGraph = updateNode(graph, node.id, {
      args: { protocol: 'REST', port: '3000' },
    });

    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.codeRefs).toHaveLength(2);
    expect(updatedNode.codeRefs[0].path).toBe('src/auth/service.ts');
    expect(updatedNode.codeRefs[1].path).toBe('proto/auth.proto');
    expect(updatedNode.args.protocol).toBe('REST');
  });

  it('should preserve children after args update', () => {
    const parent = createNode({
      type: 'compute/service',
      displayName: 'Order Service',
      args: { framework: 'express' },
    });
    const child = createNode({
      type: 'compute/function',
      displayName: 'Validate Order',
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child);

    const updatedGraph = updateNode(graph, parent.id, {
      args: { framework: 'fastify', version: '4.0' },
    });

    const updatedNode = findNode(updatedGraph, parent.id)!;
    expect(updatedNode.children).toHaveLength(1);
    expect(updatedNode.children[0].id).toBe(child.id);
    expect(updatedNode.children[0].displayName).toBe('Validate Order');
    expect(updatedNode.args.framework).toBe('fastify');
  });

  it('should return immutable result (original graph unchanged)', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      args: { port: '8080' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, {
      args: { port: '3000' },
    });

    // Original graph unchanged
    const originalNode = findNode(graph, node.id)!;
    expect(originalNode.args.port).toBe('8080');

    // Updated graph has new args
    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.args.port).toBe('3000');
  });

  it('should handle updating args to empty map', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      args: { port: '8080', replicas: '3' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, { args: {} });

    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.args).toEqual({});
    expect(updatedNode.displayName).toBe('Service');
  });

  it('should handle updating args with numeric and boolean values', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      args: { port: '8080' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, {
      args: { port: 3000, replicas: 3, debug: true },
    });

    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.args.port).toBe(3000);
    expect(updatedNode.args.replicas).toBe(3);
    expect(updatedNode.args.debug).toBe(true);
  });

  it('should update only args without affecting properties', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      args: { port: '8080' },
    });
    // Add properties to the node
    const nodeWithProps = {
      ...node,
      properties: { environment: 'production', tier: 'critical' },
    };
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeWithProps);

    const updatedGraph = updateNode(graph, node.id, {
      args: { port: '3000', replicas: '5' },
    });

    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.args).toEqual({ port: '3000', replicas: '5' });
    expect(updatedNode.properties).toEqual({ environment: 'production', tier: 'critical' });
  });

  it('should not affect other nodes in the graph', () => {
    const node1 = createNode({
      type: 'compute/service',
      displayName: 'Service A',
      args: { port: '8080' },
    });
    const node2 = createNode({
      type: 'data/database',
      displayName: 'DB',
      args: { engine: 'PostgreSQL' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);

    const updatedGraph = updateNode(graph, node1.id, {
      args: { port: '3000' },
    });

    // node2 should be completely unchanged
    const unchangedNode = findNode(updatedGraph, node2.id)!;
    expect(unchangedNode.displayName).toBe('DB');
    expect(unchangedNode.args).toEqual({ engine: 'PostgreSQL' });
  });

  it('should update displayName along with args if both provided', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Old Name',
      args: { port: '8080' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, {
      displayName: 'New Name',
      args: { port: '3000' },
    });

    const updatedNode = findNode(updatedGraph, node.id)!;
    expect(updatedNode.displayName).toBe('New Name');
    expect(updatedNode.args.port).toBe('3000');
  });

  it('should update args on a child node (recursive)', () => {
    const parent = createNode({
      type: 'compute/service',
      displayName: 'Parent',
      args: { framework: 'express' },
    });
    const child = createNode({
      type: 'compute/function',
      displayName: 'Handler',
      args: { timeout: '30' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, parent);
    graph = addChildNode(graph, parent.id, child);

    // Update the child node's args
    const updatedGraph = updateNode(graph, child.id, {
      args: { timeout: '60', memory: '256' },
    });

    const updatedChild = findNode(updatedGraph, child.id)!;
    expect(updatedChild.args.timeout).toBe('60');
    expect(updatedChild.args.memory).toBe('256');

    // Parent should be unchanged
    const parentNode = findNode(updatedGraph, parent.id)!;
    expect(parentNode.args.framework).toBe('express');
    expect(parentNode.displayName).toBe('Parent');
  });

  it('should preserve graph metadata after args update', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      args: { port: '8080' },
    });
    let graph = createEmptyGraph('My Architecture');
    graph = { ...graph, description: 'Architecture desc', owners: ['alice', 'bob'] };
    graph = addNode(graph, node);

    const updatedGraph = updateNode(graph, node.id, {
      args: { port: '3000' },
    });

    expect(updatedGraph.name).toBe('My Architecture');
    expect(updatedGraph.description).toBe('Architecture desc');
    expect(updatedGraph.owners).toEqual(['alice', 'bob']);
  });

  it('should handle non-existent node ID gracefully', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      args: { port: '8080' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    // Updating a non-existent ID should return graph with same data
    const updatedGraph = updateNode(graph, 'non-existent-id', {
      args: { port: '3000' },
    });

    expect(updatedGraph.nodes).toHaveLength(1);
    const existingNode = findNode(updatedGraph, node.id)!;
    expect(existingNode.args.port).toBe('8080');
  });
});

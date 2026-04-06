import { describe, it, expect } from 'vitest';
import { diffCanvas, diffProject, edgeKey } from '@/core/diff/engine';
import { makeCanvas, makeNode, makeRefNode, makeEdge } from '../graph/helpers';
import type { Canvas, Edge } from '@/types';

describe('edgeKey', () => {
  it('generates canonical key without ports', () => {
    const edge: Edge = { from: { node: 'a' }, to: { node: 'b' } };
    expect(edgeKey(edge)).toBe('a:→b:');
  });

  it('generates canonical key with ports', () => {
    const edge: Edge = {
      from: { node: 'a', port: 'http-out' },
      to: { node: 'b', port: 'http-in' },
    };
    expect(edgeKey(edge)).toBe('a:http-out→b:http-in');
  });
});

describe('diffCanvas', () => {
  it('returns empty diff for identical canvases', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'n1' })],
      edges: [makeEdge({ from: { node: 'n1' }, to: { node: 'n2' } })],
    });

    const diff = diffCanvas(canvas, canvas, 'test');
    expect(diff.nodes.size).toBe(0);
    expect(diff.edges.size).toBe(0);
    expect(diff.summary.nodesAdded).toBe(0);
    expect(diff.summary.nodesRemoved).toBe(0);
    expect(diff.summary.nodesModified).toBe(0);
  });

  it('detects added nodes', () => {
    const base = makeCanvas({ nodes: [] });
    const current = makeCanvas({
      nodes: [makeNode({ id: 'new-node', type: 'compute/service' })],
    });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.nodes.size).toBe(1);
    expect(diff.nodes.get('new-node')?.status).toBe('added');
    expect(diff.summary.nodesAdded).toBe(1);
  });

  it('detects removed nodes', () => {
    const base = makeCanvas({
      nodes: [makeNode({ id: 'old-node', type: 'compute/service' })],
    });
    const current = makeCanvas({ nodes: [] });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.nodes.size).toBe(1);
    expect(diff.nodes.get('old-node')?.status).toBe('removed');
    expect(diff.summary.nodesRemoved).toBe(1);
  });

  it('detects modified nodes (type change)', () => {
    const base = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/service' })],
    });
    const current = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/function' })],
    });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.nodes.size).toBe(1);
    const nodeDiff = diff.nodes.get('n1');
    expect(nodeDiff?.status).toBe('modified');
    expect(nodeDiff?.properties).toHaveLength(1);
    expect(nodeDiff?.properties[0]?.key).toBe('type');
    expect(nodeDiff?.properties[0]?.oldValue).toBe('compute/service');
    expect(nodeDiff?.properties[0]?.newValue).toBe('compute/function');
  });

  it('detects modified nodes (displayName added)', () => {
    const base = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/service' })],
    });
    const current = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/service', displayName: 'My Service' })],
    });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.nodes.size).toBe(1);
    const nodeDiff = diff.nodes.get('n1');
    expect(nodeDiff?.status).toBe('modified');
    const displayNameProp = nodeDiff?.properties.find((p) => p.key === 'displayName');
    expect(displayNameProp?.status).toBe('added');
    expect(displayNameProp?.newValue).toBe('My Service');
  });

  it('ignores position changes by default', () => {
    const base = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/service', position: { x: 0, y: 0 } })],
    });
    const current = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/service', position: { x: 100, y: 200 } })],
    });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.nodes.size).toBe(0);
  });

  it('detects position changes when includePosition is true', () => {
    const base = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/service', position: { x: 0, y: 0 } })],
    });
    const current = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/service', position: { x: 100, y: 200 } })],
    });

    const diff = diffCanvas(base, current, 'test', { includePosition: true });
    expect(diff.nodes.size).toBe(1);
    expect(diff.nodes.get('n1')?.status).toBe('modified');
  });

  it('detects added edges', () => {
    const base = makeCanvas({ edges: [] });
    const current = makeCanvas({
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' } })],
    });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.edges.size).toBe(1);
    const edgeDiff = diff.edges.get('a:→b:');
    expect(edgeDiff?.status).toBe('added');
    expect(diff.summary.edgesAdded).toBe(1);
  });

  it('detects removed edges', () => {
    const base = makeCanvas({
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' } })],
    });
    const current = makeCanvas({ edges: [] });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.edges.size).toBe(1);
    expect(diff.edges.get('a:→b:')?.status).toBe('removed');
    expect(diff.summary.edgesRemoved).toBe(1);
  });

  it('detects modified edges (protocol change)', () => {
    const base = makeCanvas({
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' }, protocol: 'HTTP' })],
    });
    const current = makeCanvas({
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' }, protocol: 'gRPC' })],
    });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.edges.size).toBe(1);
    const edgeDiff = diff.edges.get('a:→b:');
    expect(edgeDiff?.status).toBe('modified');
    const protoProp = edgeDiff?.properties.find((p) => p.key === 'protocol');
    expect(protoProp?.oldValue).toBe('HTTP');
    expect(protoProp?.newValue).toBe('gRPC');
  });

  it('handles RefNode changes', () => {
    const base = makeCanvas({
      nodes: [makeRefNode({ id: 'ref-1', ref: 'subsystem-a.yaml' })],
    });
    const current = makeCanvas({
      nodes: [makeRefNode({ id: 'ref-1', ref: 'subsystem-b.yaml' })],
    });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.nodes.size).toBe(1);
    const nodeDiff = diff.nodes.get('ref-1');
    expect(nodeDiff?.status).toBe('modified');
    const refProp = nodeDiff?.properties.find((p) => p.key === 'ref');
    expect(refProp?.oldValue).toBe('subsystem-a.yaml');
    expect(refProp?.newValue).toBe('subsystem-b.yaml');
  });

  it('handles empty canvases', () => {
    const diff = diffCanvas({}, {}, 'test');
    expect(diff.nodes.size).toBe(0);
    expect(diff.edges.size).toBe(0);
    expect(diff.summary.nodesAdded).toBe(0);
  });

  it('handles complex multi-change scenario', () => {
    const base = makeCanvas({
      nodes: [
        makeNode({ id: 'kept', type: 'compute/service' }),
        makeNode({ id: 'removed', type: 'storage/database' }),
        makeNode({ id: 'modified', type: 'compute/service', displayName: 'Old Name' }),
      ],
      edges: [
        makeEdge({ from: { node: 'kept' }, to: { node: 'removed' } }),
        makeEdge({ from: { node: 'kept' }, to: { node: 'modified' }, protocol: 'HTTP' }),
      ],
    });

    const current = makeCanvas({
      nodes: [
        makeNode({ id: 'kept', type: 'compute/service' }),
        makeNode({ id: 'modified', type: 'compute/service', displayName: 'New Name' }),
        makeNode({ id: 'added', type: 'network/gateway' }),
      ],
      edges: [
        makeEdge({ from: { node: 'kept' }, to: { node: 'modified' }, protocol: 'gRPC' }),
        makeEdge({ from: { node: 'added' }, to: { node: 'kept' } }),
      ],
    });

    const diff = diffCanvas(base, current, 'test');

    // Nodes
    expect(diff.nodes.get('removed')?.status).toBe('removed');
    expect(diff.nodes.get('modified')?.status).toBe('modified');
    expect(diff.nodes.get('added')?.status).toBe('added');
    expect(diff.nodes.has('kept')).toBe(false); // unchanged

    expect(diff.summary.nodesAdded).toBe(1);
    expect(diff.summary.nodesRemoved).toBe(1);
    expect(diff.summary.nodesModified).toBe(1);

    // Edges
    expect(diff.edges.get('kept:→removed:')?.status).toBe('removed');
    expect(diff.edges.get('kept:→modified:')?.status).toBe('modified');
    expect(diff.edges.get('added:→kept:')?.status).toBe('added');

    expect(diff.summary.edgesAdded).toBe(1);
    expect(diff.summary.edgesRemoved).toBe(1);
    expect(diff.summary.edgesModified).toBe(1);
  });

  it('compares args deeply', () => {
    const base = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/service', args: { runtime: 'node', replicas: 3 } })],
    });
    const current = makeCanvas({
      nodes: [makeNode({ id: 'n1', type: 'compute/service', args: { runtime: 'go', replicas: 3 } })],
    });

    const diff = diffCanvas(base, current, 'test');
    expect(diff.nodes.get('n1')?.status).toBe('modified');
    const argsProp = diff.nodes.get('n1')?.properties.find((p) => p.key === 'args');
    expect(argsProp?.status).toBe('modified');
  });
});

describe('diffProject', () => {
  it('diffs multiple canvases', () => {
    const base = new Map<string, Canvas>([
      ['__root__', makeCanvas({ nodes: [makeNode({ id: 'r1', type: 'compute/service' })] })],
      ['sub-1', makeCanvas({ nodes: [makeNode({ id: 's1', type: 'storage/database' })] })],
    ]);

    const current = new Map<string, Canvas>([
      ['__root__', makeCanvas({
        nodes: [
          makeNode({ id: 'r1', type: 'compute/service', displayName: 'Renamed' }),
        ],
      })],
      ['sub-1', makeCanvas({ nodes: [makeNode({ id: 's1', type: 'storage/database' })] })],
    ]);

    const projectDiff = diffProject(base, current);

    expect(projectDiff.canvases.size).toBe(1); // Only __root__ has changes
    expect(projectDiff.canvases.get('__root__')?.nodes.get('r1')?.status).toBe('modified');
    expect(projectDiff.summary.nodesModified).toBe(1);
  });

  it('detects added canvases', () => {
    const base = new Map<string, Canvas>([
      ['__root__', makeCanvas()],
    ]);
    const current = new Map<string, Canvas>([
      ['__root__', makeCanvas()],
      ['new-sub', makeCanvas({ nodes: [makeNode({ id: 'ns1', type: 'compute/service' })] })],
    ]);

    const projectDiff = diffProject(base, current);
    expect(projectDiff.addedCanvases).toContain('new-sub');
    expect(projectDiff.canvases.get('new-sub')?.nodes.get('ns1')?.status).toBe('added');
  });

  it('detects removed canvases', () => {
    const base = new Map<string, Canvas>([
      ['__root__', makeCanvas()],
      ['old-sub', makeCanvas({ nodes: [makeNode({ id: 'os1', type: 'compute/service' })] })],
    ]);
    const current = new Map<string, Canvas>([
      ['__root__', makeCanvas()],
    ]);

    const projectDiff = diffProject(base, current);
    expect(projectDiff.removedCanvases).toContain('old-sub');
    expect(projectDiff.canvases.get('old-sub')?.nodes.get('os1')?.status).toBe('removed');
  });

  it('aggregates summary across canvases', () => {
    const base = new Map<string, Canvas>([
      ['__root__', makeCanvas({ nodes: [makeNode({ id: 'r1', type: 'a' })] })],
      ['sub', makeCanvas({ nodes: [makeNode({ id: 's1', type: 'b' })] })],
    ]);
    const current = new Map<string, Canvas>([
      ['__root__', makeCanvas({
        nodes: [
          makeNode({ id: 'r1', type: 'a' }),
          makeNode({ id: 'r2', type: 'c' }),
        ],
      })],
      ['sub', makeCanvas({ nodes: [] })],
    ]);

    const projectDiff = diffProject(base, current);
    expect(projectDiff.summary.nodesAdded).toBe(1);  // r2
    expect(projectDiff.summary.nodesRemoved).toBe(1); // s1
  });
});

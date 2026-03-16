import { describe, it, expect } from 'vitest';
import { extractInheritedEdges } from '../../../src/components/canvas/inheritedEdges';

describe('extractInheritedEdges', () => {
  it('extracts edges targeting the current subsystem', () => {
    const parentEdges = [
      { from: { node: '@svc-api/handler' }, to: { node: 'db' }, label: 'persist' },
      { from: { node: 'a' }, to: { node: 'b' } },
    ];
    const result = extractInheritedEdges(parentEdges as any, 'svc-api');
    expect(result).toHaveLength(1);
    expect(result[0].localEndpoint).toBe('handler');
    expect(result[0].ghostEndpoint).toBe('db');
    expect(result[0].direction).toBe('outbound');
    expect(result[0].edge.label).toBe('persist');
  });

  it('returns empty when no edges match', () => {
    const parentEdges = [{ from: { node: 'a' }, to: { node: 'b' } }];
    expect(extractInheritedEdges(parentEdges as any, 'svc-api')).toHaveLength(0);
  });

  it('handles inbound direction (to is local)', () => {
    const parentEdges = [
      { from: { node: 'db' }, to: { node: '@svc-api/processor' } },
    ];
    const result = extractInheritedEdges(parentEdges as any, 'svc-api');
    expect(result).toHaveLength(1);
    expect(result[0].localEndpoint).toBe('processor');
    expect(result[0].ghostEndpoint).toBe('db');
    expect(result[0].direction).toBe('inbound');
  });

  it('skips both-endpoints-local (intra-subsystem edge belongs to child canvas)', () => {
    const parentEdges = [
      { from: { node: '@svc-api/a' }, to: { node: '@svc-api/b' } },
    ];
    const result = extractInheritedEdges(parentEdges as any, 'svc-api');
    expect(result).toHaveLength(0);
  });

  it('ignores edges for different ref-node', () => {
    const parentEdges = [
      { from: { node: '@other/handler' }, to: { node: 'db' } },
    ];
    expect(extractInheritedEdges(parentEdges as any, 'svc-api')).toHaveLength(0);
  });
});

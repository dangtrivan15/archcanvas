import { describe, it, expect } from 'vitest';
import { remapCrossScopeEdgesForLayout } from '@/components/canvas/layoutEdges';
import type { Edge } from '@/types';

function e(from: string, to: string, extra: Partial<Edge> = {}): Edge {
  return { from: { node: from }, to: { node: to }, ...extra };
}

describe('remapCrossScopeEdgesForLayout', () => {
  it('passes intra-scope edges through unchanged', () => {
    const result = remapCrossScopeEdgesForLayout([e('a', 'b'), e('b', 'c')]);
    expect(result).toHaveLength(2);
    expect(result[0].from.node).toBe('a');
    expect(result[0].to.node).toBe('b');
    expect(result[1].from.node).toBe('b');
    expect(result[1].to.node).toBe('c');
  });

  it('collapses @refNode/child targets to the ref-node', () => {
    const result = remapCrossScopeEdgesForLayout([
      e('web-ui', '@api-server/rest-api'),
      e('web-ui', '@api-server/stomp-broker'),
    ]);
    // Both collapse to web-ui→api-server and dedupe to a single edge.
    expect(result).toHaveLength(1);
    expect(result[0].from.node).toBe('web-ui');
    expect(result[0].to.node).toBe('api-server');
  });

  it('collapses @refNode/child on the from side too', () => {
    const result = remapCrossScopeEdgesForLayout([
      e('@orchestrator/api-client', '@api-server/internal-api'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].from.node).toBe('orchestrator');
    expect(result[0].to.node).toBe('api-server');
  });

  it('drops self-loops created by collapsing both endpoints to the same ref', () => {
    const result = remapCrossScopeEdgesForLayout([
      e('@api-server/rest-api', '@api-server/services'),
    ]);
    expect(result).toHaveLength(0);
  });

  it('preserves edge metadata (protocol, label) on the remapped edge', () => {
    const result = remapCrossScopeEdgesForLayout([
      e('web-ui', '@api-server/rest-api', { protocol: 'HTTP', label: 'REST' }),
    ]);
    expect(result[0].protocol).toBe('HTTP');
    expect(result[0].label).toBe('REST');
  });

  it('dedupes equivalent edges regardless of the sub-target they came from', () => {
    const result = remapCrossScopeEdgesForLayout([
      e('agent-pod', '@api-server/internal-api'),
      e('agent-pod', '@api-server/rest-api'),
      e('agent-pod', 'api-server'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].from.node).toBe('agent-pod');
    expect(result[0].to.node).toBe('api-server');
  });

  it('handles the full choruskube edge set without throwing', () => {
    const result = remapCrossScopeEdgesForLayout([
      e('web-ui', '@api-server/rest-api'),
      e('web-ui', '@api-server/stomp-broker'),
      e('web-ui', 'keycloak'),
      e('@orchestrator/api-client', '@api-server/internal-api'),
      e('orchestrator', 'temporal'),
      e('orchestrator', 'minio'),
      e('api-server', 'postgres'),
      e('api-server', 'minio'),
      e('api-server', 'temporal'),
      e('@api-server/workload-executor', 'agent-pod'),
      e('agent-pod', '@orchestrator/callback-server'),
      e('agent-pod', '@api-server/internal-api'),
      e('agent-pod', 'minio'),
      e('agent-pod', 'github'),
      e('api-server', 'github'),
      e('keycloak', 'postgres'),
      e('temporal', 'postgres'),
      e('temporal-ui', 'temporal'),
      e('api-server', 'keycloak'),
    ]);
    // Every endpoint must be plain (no `@` prefix).
    for (const edge of result) {
      expect(edge.from.node.startsWith('@')).toBe(false);
      expect(edge.to.node.startsWith('@')).toBe(false);
    }
    // No self-loops.
    for (const edge of result) {
      expect(edge.from.node).not.toBe(edge.to.node);
    }
    // No duplicate from→to pairs.
    const keys = result.map((edge) => `${edge.from.node}→${edge.to.node}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/**
 * Tests for Incremental Re-analysis and Merge (src/analyze/merge.ts)
 *
 * Covers:
 * - Node matching by code refs and display names
 * - Matched node processing (code ref updates, type change detection)
 * - New component addition
 * - Possibly removed component flagging
 * - Edge merging (new, removed, preserved)
 * - Conflict resolution strategies (ai-wins, manual-wins)
 * - Manual node/edge preservation
 * - Apply merge to graph
 */

import { describe, it, expect } from 'vitest';
import {
  mergeAnalysis,
  applyMerge,
  matchNodes,
  type MergeOptions,
  type ConflictStrategy,
} from '@/analyze/merge';
import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';
import type { InferenceResult, InferredNode, InferredEdge } from '@/analyze/inferEngine';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<ArchNode> & { id: string; displayName: string }): ArchNode {
  return {
    type: 'compute/service',
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x: 0, y: 0, width: 200, height: 100 },
    children: [],
    ...overrides,
  };
}

function makeEdge(
  overrides: Partial<ArchEdge> & { id: string; fromNode: string; toNode: string },
): ArchEdge {
  return {
    type: 'sync',
    properties: {},
    notes: [],
    ...overrides,
  };
}

function makeGraph(nodes: ArchNode[], edges: ArchEdge[] = []): ArchGraph {
  return {
    name: 'Test Architecture',
    description: 'Test',
    owners: [],
    nodes,
    edges,
    annotations: [],
  };
}

function makeInferredNode(
  overrides: Partial<InferredNode> & { id: string; displayName: string },
): InferredNode {
  return {
    type: 'compute/service',
    description: '',
    codeRefs: [],
    children: [],
    ...overrides,
  };
}

function makeInferredEdge(
  overrides: Partial<InferredEdge> & { from: string; to: string },
): InferredEdge {
  return {
    type: 'SYNC',
    label: '',
    ...overrides,
  };
}

function makeInferenceResult(nodes: InferredNode[], edges: InferredEdge[] = []): InferenceResult {
  return {
    architectureName: 'Test Architecture',
    architectureDescription: 'Test',
    nodes,
    edges,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('matchNodes', () => {
  it('matches nodes by overlapping code-ref paths', () => {
    const existing = [
      makeNode({
        id: 'node-1',
        displayName: 'API Service',
        codeRefs: [{ path: 'src/api/index.ts', role: 'source' }],
      }),
    ];
    const inferred = [
      makeInferredNode({
        id: 'inferred-1',
        displayName: 'Different Name',
        codeRefs: [{ path: 'src/api/index.ts', role: 'SOURCE' }],
      }),
    ];

    const result = matchNodes(existing, inferred);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchMethod).toBe('code-ref');
    expect(result.matches[0].existingNode.id).toBe('node-1');
    expect(result.matches[0].inferredNode.id).toBe('inferred-1');
    expect(result.unmatchedExisting).toHaveLength(0);
    expect(result.unmatchedInferred).toHaveLength(0);
  });

  it('matches nodes by normalized display name', () => {
    const existing = [makeNode({ id: 'node-1', displayName: 'Auth Service' })];
    const inferred = [makeInferredNode({ id: 'inferred-1', displayName: 'Auth Service' })];

    const result = matchNodes(existing, inferred);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchMethod).toBe('display-name');
  });

  it('matches display names with different suffixes (e.g., "Auth" vs "Auth Service")', () => {
    const existing = [makeNode({ id: 'node-1', displayName: 'Auth' })];
    const inferred = [makeInferredNode({ id: 'inferred-1', displayName: 'Auth Service' })];

    const result = matchNodes(existing, inferred);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchMethod).toBe('display-name');
  });

  it('reports unmatched existing nodes', () => {
    const existing = [makeNode({ id: 'node-1', displayName: 'Old Component' })];
    const inferred: InferredNode[] = [];

    const result = matchNodes(existing, inferred);
    expect(result.matches).toHaveLength(0);
    expect(result.unmatchedExisting).toHaveLength(1);
    expect(result.unmatchedExisting[0].id).toBe('node-1');
  });

  it('reports unmatched inferred nodes', () => {
    const existing: ArchNode[] = [];
    const inferred = [makeInferredNode({ id: 'inferred-1', displayName: 'New Component' })];

    const result = matchNodes(existing, inferred);
    expect(result.matches).toHaveLength(0);
    expect(result.unmatchedInferred).toHaveLength(1);
    expect(result.unmatchedInferred[0].id).toBe('inferred-1');
  });

  it('prefers code-ref matching over display-name matching', () => {
    const existing = [
      makeNode({
        id: 'node-1',
        displayName: 'API Gateway',
        codeRefs: [{ path: 'src/gateway/main.ts', role: 'source' }],
      }),
      makeNode({ id: 'node-2', displayName: 'API Gateway' }),
    ];
    const inferred = [
      makeInferredNode({
        id: 'inferred-1',
        displayName: 'Gateway',
        codeRefs: [{ path: 'src/gateway/main.ts', role: 'SOURCE' }],
      }),
    ];

    const result = matchNodes(existing, inferred);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].existingNode.id).toBe('node-1');
    expect(result.matches[0].matchMethod).toBe('code-ref');
  });

  it('detects type changes in matched nodes', () => {
    const existing = [
      makeNode({
        id: 'node-1',
        displayName: 'Cache',
        type: 'data/cache',
      }),
    ];
    const inferred = [
      makeInferredNode({
        id: 'inferred-1',
        displayName: 'Cache',
        type: 'data/database',
      }),
    ];

    const result = matchNodes(existing, inferred);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].typeChanged).toBe(true);
  });
});

describe('mergeAnalysis', () => {
  it('returns correct summary for a simple merge', () => {
    const graph = makeGraph([
      makeNode({
        id: 'node-1',
        displayName: 'API',
        notes: [
          {
            id: 'n1',
            author: 'ai-analyzer',
            timestampMs: 0,
            content: 'test',
            tags: ['ai-inferred'],
            status: 'none',
          },
        ],
      }),
      makeNode({
        id: 'node-2',
        displayName: 'Database',
        notes: [
          {
            id: 'n2',
            author: 'ai-analyzer',
            timestampMs: 0,
            content: 'test',
            tags: ['ai-inferred'],
            status: 'none',
          },
        ],
      }),
    ]);

    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'API' }),
      makeInferredNode({ id: 'inf-3', displayName: 'New Cache' }),
    ]);

    const result = mergeAnalysis(graph, inference);

    expect(result.summary.nodesMatched).toBe(1); // API matched
    expect(result.summary.nodesAdded).toBe(1); // New Cache added
    expect(result.summary.nodesFlagged).toBe(1); // Database flagged (AI-inferred, not matched)
  });

  it('preserves manually created nodes (not flagged as removed)', () => {
    const graph = makeGraph([
      makeNode({
        id: 'manual-node',
        displayName: 'Manual Component',
        notes: [], // No 'ai-inferred' tag = manual node
      }),
    ]);

    const inference = makeInferenceResult([]); // Empty inference — nothing matched

    const result = mergeAnalysis(graph, inference);

    // Manual nodes should NOT be in possiblyRemoved
    expect(result.possiblyRemoved).toHaveLength(0);
  });

  it('flags AI-inferred nodes as possibly removed when not in new inference', () => {
    const graph = makeGraph([
      makeNode({
        id: 'ai-node',
        displayName: 'Old Service',
        notes: [
          {
            id: 'n1',
            author: 'ai',
            timestampMs: 0,
            content: 'desc',
            tags: ['ai-inferred'],
            status: 'none',
          },
        ],
      }),
    ]);

    const inference = makeInferenceResult([]); // Empty

    const result = mergeAnalysis(graph, inference);

    expect(result.possiblyRemoved).toHaveLength(1);
    expect(result.possiblyRemoved[0].id).toBe('ai-node');
  });

  it('detects new code refs on matched nodes', () => {
    const graph = makeGraph([
      makeNode({
        id: 'node-1',
        displayName: 'API',
        codeRefs: [{ path: 'src/api/index.ts', role: 'source' }],
      }),
    ]);

    const inference = makeInferenceResult([
      makeInferredNode({
        id: 'inf-1',
        displayName: 'API',
        codeRefs: [
          { path: 'src/api/index.ts', role: 'SOURCE' },
          { path: 'src/api/routes.ts', role: 'SOURCE' },
        ],
      }),
    ]);

    const result = mergeAnalysis(graph, inference);

    expect(result.summary.codeRefUpdates).toBe(1); // routes.ts is new
  });

  it('reports type changes with manual-wins strategy', () => {
    const graph = makeGraph([makeNode({ id: 'node-1', displayName: 'Cache', type: 'data/cache' })]);

    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'Cache', type: 'data/database' }),
    ]);

    const result = mergeAnalysis(graph, inference, { conflictStrategy: 'manual-wins' });

    expect(result.summary.typeChanges).toBe(1);
    expect(result.warnings.some((w) => w.includes('manual-wins'))).toBe(true);
  });

  it('reports type changes with ai-wins strategy', () => {
    const graph = makeGraph([makeNode({ id: 'node-1', displayName: 'Cache', type: 'data/cache' })]);

    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'Cache', type: 'data/database' }),
    ]);

    const result = mergeAnalysis(graph, inference, { conflictStrategy: 'ai-wins' });

    expect(result.summary.typeChanges).toBe(1);
    expect(result.warnings.some((w) => w.includes('ai-wins'))).toBe(true);
  });

  it('adds new edges from inference', () => {
    const graph = makeGraph(
      [
        makeNode({ id: 'node-1', displayName: 'API' }),
        makeNode({ id: 'node-2', displayName: 'DB' }),
      ],
      [],
    );

    const inference = makeInferenceResult(
      [
        makeInferredNode({ id: 'inf-1', displayName: 'API' }),
        makeInferredNode({ id: 'inf-2', displayName: 'DB' }),
      ],
      [makeInferredEdge({ from: 'inf-1', to: 'inf-2', type: 'SYNC', label: 'queries' })],
    );

    const result = mergeAnalysis(graph, inference);

    expect(result.edgesAdded).toHaveLength(1);
    expect(result.edgesAdded[0].from).toBe('inf-1');
    expect(result.edgesAdded[0].to).toBe('inf-2');
  });

  it('preserves existing edges that match new inference', () => {
    const graph = makeGraph(
      [
        makeNode({ id: 'node-1', displayName: 'API' }),
        makeNode({ id: 'node-2', displayName: 'DB' }),
      ],
      [makeEdge({ id: 'edge-1', fromNode: 'node-1', toNode: 'node-2', type: 'sync' })],
    );

    const inference = makeInferenceResult(
      [
        makeInferredNode({ id: 'inf-1', displayName: 'API' }),
        makeInferredNode({ id: 'inf-2', displayName: 'DB' }),
      ],
      [makeInferredEdge({ from: 'inf-1', to: 'inf-2', type: 'SYNC' })],
    );

    const result = mergeAnalysis(graph, inference);

    expect(result.edgesPreserved).toHaveLength(1);
    expect(result.edgesPreserved[0].id).toBe('edge-1');
    expect(result.edgesAdded).toHaveLength(0);
  });

  it('flags removed edges (non-manual)', () => {
    const graph = makeGraph(
      [
        makeNode({ id: 'node-1', displayName: 'API' }),
        makeNode({ id: 'node-2', displayName: 'DB' }),
      ],
      [makeEdge({ id: 'edge-1', fromNode: 'node-1', toNode: 'node-2', type: 'sync' })],
    );

    const inference = makeInferenceResult(
      [
        makeInferredNode({ id: 'inf-1', displayName: 'API' }),
        makeInferredNode({ id: 'inf-2', displayName: 'DB' }),
      ],
      [], // No edges in new inference
    );

    const result = mergeAnalysis(graph, inference);

    expect(result.edgesFlagged).toHaveLength(1);
    expect(result.edgesFlagged[0].id).toBe('edge-1');
  });

  it('preserves manual edges (not flagged even if not in new inference)', () => {
    const graph = makeGraph(
      [
        makeNode({ id: 'node-1', displayName: 'API' }),
        makeNode({ id: 'node-2', displayName: 'DB' }),
      ],
      [
        makeEdge({
          id: 'edge-1',
          fromNode: 'node-1',
          toNode: 'node-2',
          type: 'sync',
          notes: [
            {
              id: 'n1',
              author: 'user',
              timestampMs: 0,
              content: 'Manual note',
              tags: [],
              status: 'none',
            },
          ],
        }),
      ],
    );

    const inference = makeInferenceResult(
      [
        makeInferredNode({ id: 'inf-1', displayName: 'API' }),
        makeInferredNode({ id: 'inf-2', displayName: 'DB' }),
      ],
      [], // No edges
    );

    const result = mergeAnalysis(graph, inference);

    // Manual edges should NOT be flagged
    expect(result.edgesFlagged).toHaveLength(0);
  });
});

describe('applyMerge', () => {
  it('adds new nodes to the graph', () => {
    const graph = makeGraph([makeNode({ id: 'node-1', displayName: 'API' })]);

    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'API' }),
      makeInferredNode({ id: 'inf-2', displayName: 'New Cache', type: 'data/cache' }),
    ]);

    const mergeResult = mergeAnalysis(graph, inference);
    const merged = applyMerge(graph, mergeResult);

    expect(merged.nodes).toHaveLength(2);
    expect(merged.nodes.find((n) => n.displayName === 'New Cache')).toBeDefined();
    expect(merged.nodes.find((n) => n.displayName === 'New Cache')?.type).toBe('data/cache');
  });

  it('adds new code refs to matched nodes', () => {
    const graph = makeGraph([
      makeNode({
        id: 'node-1',
        displayName: 'API',
        codeRefs: [{ path: 'src/api/index.ts', role: 'source' }],
      }),
    ]);

    const inference = makeInferenceResult([
      makeInferredNode({
        id: 'inf-1',
        displayName: 'API',
        codeRefs: [
          { path: 'src/api/index.ts', role: 'SOURCE' },
          { path: 'src/api/routes.ts', role: 'SOURCE' },
        ],
      }),
    ]);

    const mergeResult = mergeAnalysis(graph, inference);
    const merged = applyMerge(graph, mergeResult);

    const apiNode = merged.nodes.find((n) => n.id === 'node-1');
    expect(apiNode?.codeRefs).toHaveLength(2);
    expect(apiNode?.codeRefs.some((cr) => cr.path === 'src/api/routes.ts')).toBe(true);
  });

  it('updates type when ai-wins strategy', () => {
    const graph = makeGraph([makeNode({ id: 'node-1', displayName: 'Cache', type: 'data/cache' })]);

    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'Cache', type: 'data/database' }),
    ]);

    const options: MergeOptions = { conflictStrategy: 'ai-wins' };
    const mergeResult = mergeAnalysis(graph, inference, options);
    const merged = applyMerge(graph, mergeResult, options);

    const node = merged.nodes.find((n) => n.id === 'node-1');
    expect(node?.type).toBe('data/database');
  });

  it('keeps existing type when manual-wins strategy', () => {
    const graph = makeGraph([makeNode({ id: 'node-1', displayName: 'Cache', type: 'data/cache' })]);

    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'Cache', type: 'data/database' }),
    ]);

    const options: MergeOptions = { conflictStrategy: 'manual-wins' };
    const mergeResult = mergeAnalysis(graph, inference, options);
    const merged = applyMerge(graph, mergeResult, options);

    const node = merged.nodes.find((n) => n.id === 'node-1');
    expect(node?.type).toBe('data/cache');
  });

  it('adds possibly-removed notes to flagged nodes', () => {
    const graph = makeGraph([
      makeNode({
        id: 'ai-node',
        displayName: 'Old Service',
        notes: [
          {
            id: 'n1',
            author: 'ai',
            timestampMs: 0,
            content: 'desc',
            tags: ['ai-inferred'],
            status: 'none',
          },
        ],
      }),
    ]);

    const inference = makeInferenceResult([]);
    const mergeResult = mergeAnalysis(graph, inference);
    const merged = applyMerge(graph, mergeResult);

    const node = merged.nodes.find((n) => n.id === 'ai-node');
    expect(node?.notes.some((n) => n.tags.includes('possibly-removed'))).toBe(true);
  });

  it('adds new edges from inference to the graph', () => {
    const graph = makeGraph(
      [
        makeNode({ id: 'node-1', displayName: 'API' }),
        makeNode({ id: 'node-2', displayName: 'DB' }),
      ],
      [],
    );

    const inference = makeInferenceResult(
      [
        makeInferredNode({ id: 'inf-1', displayName: 'API' }),
        makeInferredNode({ id: 'inf-2', displayName: 'DB' }),
      ],
      [makeInferredEdge({ from: 'inf-1', to: 'inf-2', type: 'ASYNC', label: 'writes' })],
    );

    const mergeResult = mergeAnalysis(graph, inference);
    const merged = applyMerge(graph, mergeResult);

    expect(merged.edges).toHaveLength(1);
    expect(merged.edges[0].fromNode).toBe('node-1');
    expect(merged.edges[0].toNode).toBe('node-2');
    expect(merged.edges[0].type).toBe('async');
  });

  it('adds possibly-removed notes to flagged edges', () => {
    const graph = makeGraph(
      [
        makeNode({ id: 'node-1', displayName: 'API' }),
        makeNode({ id: 'node-2', displayName: 'DB' }),
      ],
      [makeEdge({ id: 'edge-1', fromNode: 'node-1', toNode: 'node-2', type: 'sync' })],
    );

    const inference = makeInferenceResult(
      [
        makeInferredNode({ id: 'inf-1', displayName: 'API' }),
        makeInferredNode({ id: 'inf-2', displayName: 'DB' }),
      ],
      [],
    );

    const mergeResult = mergeAnalysis(graph, inference);
    const merged = applyMerge(graph, mergeResult);

    const edge = merged.edges.find((e) => e.id === 'edge-1');
    expect(edge?.notes.some((n) => n.tags.includes('possibly-removed'))).toBe(true);
  });

  it('does not mutate the original graph', () => {
    const graph = makeGraph([makeNode({ id: 'node-1', displayName: 'API' })]);

    const originalNodeCount = graph.nodes.length;

    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'API' }),
      makeInferredNode({ id: 'inf-2', displayName: 'New Service' }),
    ]);

    const mergeResult = mergeAnalysis(graph, inference);
    applyMerge(graph, mergeResult);

    // Original graph should be unchanged
    expect(graph.nodes.length).toBe(originalNodeCount);
  });

  it('adds newly-detected notes to added nodes', () => {
    const graph = makeGraph([]);
    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'New API', description: 'A new API service' }),
    ]);

    const mergeResult = mergeAnalysis(graph, inference);
    const merged = applyMerge(graph, mergeResult);

    const newNode = merged.nodes.find((n) => n.displayName === 'New API');
    expect(newNode).toBeDefined();
    expect(newNode?.notes.some((n) => n.tags.includes('newly-detected'))).toBe(true);
    expect(newNode?.notes.some((n) => n.tags.includes('ai-inferred'))).toBe(true);
  });

  it('handles complex scenario: renamed components', () => {
    // Simulate a component being renamed: same code refs, different display name
    const graph = makeGraph([
      makeNode({
        id: 'node-1',
        displayName: 'User API',
        codeRefs: [{ path: 'src/users/index.ts', role: 'source' }],
      }),
    ]);

    const inference = makeInferenceResult([
      makeInferredNode({
        id: 'inf-1',
        displayName: 'Account Service',
        codeRefs: [{ path: 'src/users/index.ts', role: 'SOURCE' }],
      }),
    ]);

    const result = mergeAnalysis(graph, inference);

    // Should match by code ref despite different names
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchMethod).toBe('code-ref');
    expect(result.added).toHaveLength(0);
    expect(result.possiblyRemoved).toHaveLength(0);
  });

  it('handles components removed from codebase', () => {
    const graph = makeGraph([
      makeNode({
        id: 'node-1',
        displayName: 'API',
        notes: [
          {
            id: 'n1',
            author: 'ai',
            timestampMs: 0,
            content: 'desc',
            tags: ['ai-inferred'],
            status: 'none',
          },
        ],
      }),
      makeNode({
        id: 'node-2',
        displayName: 'Legacy Service',
        notes: [
          {
            id: 'n2',
            author: 'ai',
            timestampMs: 0,
            content: 'desc',
            tags: ['ai-inferred'],
            status: 'none',
          },
        ],
      }),
      makeNode({
        id: 'node-3',
        displayName: 'DB',
        notes: [
          {
            id: 'n3',
            author: 'ai',
            timestampMs: 0,
            content: 'desc',
            tags: ['ai-inferred'],
            status: 'none',
          },
        ],
      }),
    ]);

    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'API' }),
      makeInferredNode({ id: 'inf-3', displayName: 'DB' }),
      // Legacy Service not in new inference
    ]);

    const result = mergeAnalysis(graph, inference);

    expect(result.matched).toHaveLength(2);
    expect(result.possiblyRemoved).toHaveLength(1);
    expect(result.possiblyRemoved[0].displayName).toBe('Legacy Service');
  });

  it('handles adding new components', () => {
    const graph = makeGraph([makeNode({ id: 'node-1', displayName: 'API' })]);

    const inference = makeInferenceResult([
      makeInferredNode({ id: 'inf-1', displayName: 'API' }),
      makeInferredNode({ id: 'inf-2', displayName: 'New Worker', type: 'compute/worker' }),
      makeInferredNode({ id: 'inf-3', displayName: 'New Queue', type: 'messaging/message-queue' }),
    ]);

    const result = mergeAnalysis(graph, inference);

    expect(result.matched).toHaveLength(1);
    expect(result.added).toHaveLength(2);
    expect(result.added.map((n) => n.displayName).sort()).toEqual(['New Queue', 'New Worker']);
  });

  it('skips change notes when addChangeNotes is false', () => {
    const graph = makeGraph([
      makeNode({
        id: 'ai-node',
        displayName: 'Old Service',
        notes: [
          {
            id: 'n1',
            author: 'ai',
            timestampMs: 0,
            content: 'desc',
            tags: ['ai-inferred'],
            status: 'none',
          },
        ],
      }),
    ]);

    const inference = makeInferenceResult([]);
    const mergeResult = mergeAnalysis(graph, inference);
    const merged = applyMerge(graph, mergeResult, { addChangeNotes: false });

    const node = merged.nodes.find((n) => n.id === 'ai-node');
    // Should NOT have a possibly-removed note since addChangeNotes is false
    expect(node?.notes.some((n) => n.tags.includes('possibly-removed'))).toBe(false);
  });
});

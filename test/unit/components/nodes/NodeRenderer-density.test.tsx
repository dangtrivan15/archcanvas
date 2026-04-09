import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { CanvasNodeData, KeyArg, NodeBadges } from '@/components/canvas/types';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { InlineNode } from '@/types/schema';

// Mock @xyflow/react
vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, id, title }: {
    type: string;
    position: string;
    id?: string;
    title?: string;
  }) => (
    <div
      data-testid={`handle-${type}`}
      data-handle-type={type}
      data-handle-position={position}
      data-handle-id={id}
      data-handle-title={title}
    />
  ),
  Position: { Left: 'left', Right: 'right' },
  NodeResizer: (props: any) => <div data-testid="node-resizer" data-visible={props.isVisible} />,
}));

// Mock fileStore
vi.mock('@/store/fileStore', () => {
  const state = {
    project: { canvases: new Map() },
    getCanvas: () => undefined,
  };
  const hook = (selector?: (s: typeof state) => any) => {
    if (selector) return selector(state);
    return state;
  };
  hook.getState = () => state;
  return { useFileStore: hook };
});

vi.mock('@/store/graphStore', () => ({
  useGraphStore: { getState: () => ({ updateNodePosition: vi.fn() }) },
}));
vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: { getState: () => ({ currentCanvasId: '__root__' }) },
}));

// Import AFTER mocks
import { NodeRenderer } from '@/components/nodes/NodeRenderer';

// ------------------------------------------------------------------ helpers

function makeNodeDef(overrides: Partial<NodeDef['metadata']> = {}): NodeDef {
  return {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      name: 'service',
      namespace: 'compute',
      version: '1.0',
      displayName: 'Service',
      description: 'A compute service',
      icon: '⚙',
      shape: 'rectangle',
      ...overrides,
    },
    spec: {},
  };
}

function makeInlineNode(overrides: Partial<InlineNode> = {}): InlineNode {
  return {
    id: 'node-1',
    type: 'compute/service',
    displayName: 'My Service',
    ...overrides,
  };
}

function makeProps(data: CanvasNodeData): { data: CanvasNodeData } {
  return { data };
}

// ------------------------------------------------------------------ tests

describe('NodeRenderer — key args display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders key args when present', () => {
    const keyArgs: KeyArg[] = [
      { name: 'replicas', value: 3 },
      { name: 'tier', value: 'pro' },
    ];

    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
          keyArgs,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    expect(container.textContent).toContain('replicas');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('tier');
    expect(container.textContent).toContain('pro');
    expect(container.querySelector('.arch-node-key-args')).toBeTruthy();
  });

  it('does not render key args section when empty', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
          keyArgs: [],
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    expect(container.querySelector('.arch-node-key-args')).toBeNull();
  });

  it('does not render key args section when undefined', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    expect(container.querySelector('.arch-node-key-args')).toBeNull();
  });
});

describe('NodeRenderer — metadata badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notes badge when hasNotes is true', () => {
    const badges: NodeBadges = { hasNotes: true, hasCodeRefs: false, childCount: 0 };

    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
          badges,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    expect(container.querySelector('.arch-node-badges')).toBeTruthy();
    expect(container.querySelector('[title="Has notes"]')).toBeTruthy();
    expect(container.querySelector('[title="Has code references"]')).toBeNull();
  });

  it('renders code refs badge when hasCodeRefs is true', () => {
    const badges: NodeBadges = { hasNotes: false, hasCodeRefs: true, childCount: 0 };

    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
          badges,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    expect(container.querySelector('[title="Has code references"]')).toBeTruthy();
  });

  it('renders child count badge when childCount > 0', () => {
    const badges: NodeBadges = { hasNotes: false, hasCodeRefs: false, childCount: 5 };

    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
          badges,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    expect(container.querySelector('[title="5 children"]')).toBeTruthy();
    expect(container.textContent).toContain('5');
  });

  it('does not render badges section when all flags are false/zero', () => {
    const badges: NodeBadges = { hasNotes: false, hasCodeRefs: false, childCount: 0 };

    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
          badges,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    expect(container.querySelector('.arch-node-badges')).toBeNull();
  });
});

describe('NodeRenderer — child summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders child summary text for RefNodes', () => {
    const refNode = { id: 'ref-1', ref: 'sub.yaml' } as any;

    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: refNode,
          nodeDef: undefined,
          isSelected: false,
          isRef: true,
          childSummary: '3 compute · 2 data',
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    expect(container.textContent).toContain('3 compute · 2 data');
    expect(container.querySelector('.arch-node-child-summary')).toBeTruthy();
  });

  it('does not render child summary when undefined', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
          childSummary: undefined,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    expect(container.querySelector('.arch-node-child-summary')).toBeNull();
  });
});

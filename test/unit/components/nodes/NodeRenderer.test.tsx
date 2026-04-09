import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CanvasNodeData } from '@/components/canvas/types';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { InlineNode, RefNode } from '@/types/schema';

// Mock @xyflow/react — Handle requires ReactFlow context which is not
// available in unit tests. We replace it with a simple <div> that carries
// the data-* attrs we need to assert on.
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

// Mock fileStore so tests don't depend on a loaded project.
// useFileStore is used as both getState() (NodeRenderer) and as a hook with selector (SubsystemPreview).
vi.mock('@/store/fileStore', () => {
  const state = {
    project: { canvases: new Map() },
    getCanvas: (id: string) => {
      if (id === 'known-canvas') {
        return { data: { displayName: 'Known Canvas' } };
      }
      return undefined;
    },
  };
  const hook = (selector?: (s: typeof state) => any) => {
    if (selector) return selector(state);
    return state;
  };
  hook.getState = () => state;
  return { useFileStore: hook };
});

// Mock graphStore and navigationStore (used by NodeResizer resize handler)
vi.mock('@/store/graphStore', () => ({
  useGraphStore: { getState: () => ({ updateNodePosition: vi.fn() }) },
}));
vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: { getState: () => ({ currentCanvasId: '__root__' }) },
}));

// Import AFTER mocks are registered
import { NodeRenderer } from '@/components/nodes/NodeRenderer';
import { PreviewModeContext } from '@/components/nodes/PreviewModeContext';

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

function makeRefNode(overrides: Partial<RefNode> = {}): RefNode {
  return {
    id: 'ref-1',
    ref: 'known-canvas',
    ...overrides,
  };
}

/**
 * NodeProps from @xyflow/react contains many fields; the component only uses
 * `data`, so we create a minimal props object.
 */
function makeProps(data: CanvasNodeData): { data: CanvasNodeData } {
  return { data };
}

// ------------------------------------------------------------------ tests

describe('NodeRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the displayName for an InlineNode', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode({ displayName: 'My API Service' }),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    expect(container.textContent).toContain('My API Service');
  });

  it('falls back to node.id when displayName is missing', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode({ displayName: undefined }),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    expect(container.textContent).toContain('node-1');
  });

  it('applies the correct shape class from NodeDef metadata', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef({ shape: 'cylinder' }),
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain('node-shape-cylinder');
  });

  it('defaults to rectangle shape when nodeDef is undefined', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: undefined,
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain('node-shape-rectangle');
  });

  it('applies selected class when isSelected is true', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: true,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain('selected');
  });

  it('does not apply selected class when isSelected is false', () => {
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
    const node = container.firstChild as HTMLElement;
    expect(node.className).not.toContain('selected');
  });

  it('renders ref-node class and resolves displayName from fileStore for ref nodes', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeRefNode({ id: 'known-canvas', ref: 'known-canvas.yaml' }),
          nodeDef: undefined,
          isSelected: false,
          isRef: true,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    const node = container.firstChild as HTMLElement;
    expect(node.className).toContain('ref-node');
    // displayName resolved from mocked fileStore using node.id
    expect(container.textContent).toContain('Known Canvas');
  });

  it('falls back to node id when canvas not found in fileStore', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeRefNode({ id: 'unknown-canvas', ref: 'unknown-canvas.yaml' }),
          nodeDef: undefined,
          isSelected: false,
          isRef: true,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    expect(container.textContent).toContain('unknown-canvas');
  });

  it('renders a warning indicator when nodeDef is undefined for inline node', () => {
    render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: undefined,
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('Unknown type');
  });

  it('does not render warning indicator when nodeDef is defined', () => {
    render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders source and target handle elements', () => {
    render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    expect(screen.getByTestId('handle-source')).toBeDefined();
    expect(screen.getByTestId('handle-target')).toBeDefined();
  });

  it('skips SubsystemPreview when PreviewModeContext is true', () => {
    const data: CanvasNodeData = {
      node: makeRefNode({ id: 'sub-1' }) as any,
      nodeDef: undefined,
      isSelected: false,
      isRef: true,
    };

    const { container } = render(
      <PreviewModeContext.Provider value={true}>
        <NodeRenderer {...makeProps(data) as Parameters<typeof NodeRenderer>[0]} />
      </PreviewModeContext.Provider>,
    );

    // Should render the node header but NOT SubsystemPreview
    expect(container.querySelector('.arch-node-header')).toBeTruthy();
    // The node should still have the container shape class
    expect(container.querySelector('.node-shape-container')).toBeTruthy();
  });

  it('sets data-ns attribute for inline nodes with known namespace', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode({ type: 'data/database' }),
          nodeDef: makeNodeDef({ namespace: 'data' }),
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    const node = container.firstChild as HTMLElement;
    expect(node.getAttribute('data-ns')).toBe('data');
  });

  it('does not set data-ns for ref nodes', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeRefNode({ id: 'known-canvas', ref: 'known-canvas.yaml' }),
          nodeDef: undefined,
          isSelected: false,
          isRef: true,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    const node = container.firstChild as HTMLElement;
    expect(node.getAttribute('data-ns')).toBeNull();
  });

  it('does not set data-ns for unknown namespace prefix', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode({ type: 'custom/widget' }),
          nodeDef: undefined,
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    const node = container.firstChild as HTMLElement;
    expect(node.getAttribute('data-ns')).toBeNull();
  });

  it('sets CSS custom properties when node has per-instance color', () => {
    const { container } = render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode({ color: '#ff6b6b' }),
          nodeDef: makeNodeDef(),
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );
    const node = container.firstChild as HTMLElement;
    // Per-instance colors are set as CSS custom properties so the cascade
    // lets diff overlay classes win over them (inline bg/border would beat everything).
    expect(node.style.getPropertyValue('--node-instance-bg')).toBe('#ff6b6b');
    expect(node.style.getPropertyValue('--node-instance-border')).toBe('#ff6b6b');
    // Direct backgroundColor/borderColor should NOT be set
    expect(node.style.backgroundColor).toBe('');
    expect(node.style.borderColor).toBe('');
  });

  it('does not set instance color custom properties when node has no color', () => {
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
    const node = container.firstChild as HTMLElement;
    expect(node.style.getPropertyValue('--node-instance-bg')).toBe('');
    expect(node.style.getPropertyValue('--node-instance-border')).toBe('');
  });

  it('renders named port handles when nodeDef defines ports', () => {
    const nodeDef = makeNodeDef();
    nodeDef.spec = {
      ports: [
        { name: 'http-in', direction: 'inbound', protocol: ['HTTP'] },
        { name: 'grpc-in', direction: 'inbound', protocol: ['gRPC'] },
        { name: 'http-out', direction: 'outbound', protocol: ['HTTP'] },
      ],
    };

    render(
      <NodeRenderer
        {...(makeProps({
          node: makeInlineNode(),
          nodeDef,
          isSelected: false,
          isRef: false,
        }) as Parameters<typeof NodeRenderer>[0])}
      />,
    );

    // Named ports replace the default handles
    const targets = screen.queryAllByTestId('handle-target');
    const sources = screen.queryAllByTestId('handle-source');

    // 2 inbound → 2 target handles; default single target should NOT be rendered
    expect(targets).toHaveLength(2);
    // 1 outbound → 1 source handle; default single source should NOT be rendered
    expect(sources).toHaveLength(1);
  });
});

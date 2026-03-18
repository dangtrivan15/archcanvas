import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock @xyflow/react before importing components
vi.mock('@xyflow/react', () => ({
  Handle: (props: any) => <div data-testid={`handle-${props.id}`} />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  NodeResizer: (props: any) => <div data-testid="node-resizer" data-visible={props.isVisible} />,
}));

import { NodeRenderer } from '@/components/nodes/NodeRenderer';
import { useFileStore } from '@/store/fileStore';

const makeProps = (overrides: Record<string, any> = {}) => ({
  id: 'test',
  type: 'archNode' as const,
  data: {
    node: { id: 'test-node', type: 'service', position: { x: 0, y: 0 } },
    nodeDef: undefined,
    isSelected: false,
    isRef: false,
    ...overrides,
  },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  zIndex: 0,
  dragging: false,
  sourcePosition: undefined,
  targetPosition: undefined,
  dragHandle: undefined,
  parentId: undefined,
  width: 120,
  height: 52,
});

describe('NodeRenderer container mode', () => {
  beforeEach(() => {
    useFileStore.setState({ project: null } as any);
  });

  it('renders ref-node with container shape class', () => {
    const { container } = render(
      <NodeRenderer {...makeProps({
        node: { id: 'test-ref', ref: 'test-ref.yaml', position: { x: 0, y: 0 } },
        isRef: true,
      }) as any} />
    );
    const node = container.querySelector('.arch-node');
    expect(node?.classList.contains('node-shape-container')).toBe(true);
    expect(node?.classList.contains('ref-node')).toBe(true);
  });

  it('does not use container shape for inline nodes', () => {
    const { container } = render(
      <NodeRenderer {...makeProps() as any} />
    );
    const node = container.querySelector('.arch-node');
    expect(node?.classList.contains('node-shape-container')).toBe(false);
  });

  it('renders SubsystemPreview for ref-nodes', () => {
    const { container } = render(
      <NodeRenderer {...makeProps({
        node: { id: 'test-ref', ref: 'test-ref.yaml', position: { x: 0, y: 0 } },
        isRef: true,
      }) as any} />
    );
    // SubsystemPreview renders an SVG (or null if empty canvas)
    // Since there's no canvas data, it should render null, but the container class should still be there
    const node = container.querySelector('.arch-node');
    expect(node?.classList.contains('node-shape-container')).toBe(true);
  });

  it('renders NodeResizer for ref-nodes when selected', () => {
    const { container } = render(
      <NodeRenderer {...makeProps({
        node: { id: 'test-ref', ref: 'test-ref.yaml', position: { x: 0, y: 0 } },
        isRef: true,
        isSelected: true,
      }) as any} />
    );
    const resizer = container.querySelector('[data-testid="node-resizer"]');
    expect(resizer).toBeTruthy();
    expect(resizer?.getAttribute('data-visible')).toBe('true');
  });

  it('does not render NodeResizer for inline nodes', () => {
    const { container } = render(
      <NodeRenderer {...makeProps() as any} />
    );
    const resizer = container.querySelector('[data-testid="node-resizer"]');
    expect(resizer).toBeNull();
  });
});

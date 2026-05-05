import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock @xyflow/react before importing components
vi.mock('@xyflow/react', () => ({
  Handle: (props: any) => <div data-testid={`handle-${props.id}`} />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
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

  it('does not render SubsystemPreview for ref-nodes (compact mode)', () => {
    const { container } = render(
      <NodeRenderer {...makeProps({
        node: { id: 'test-ref', ref: 'test-ref.yaml', position: { x: 0, y: 0 } },
        isRef: true,
      }) as any} />
    );
    // SubsystemPreview mini-canvas was removed; only compact styling remains
    const preview = container.querySelector('.subsystem-preview');
    expect(preview).toBeNull();
    // Container shape class is still present
    const node = container.querySelector('.arch-node');
    expect(node?.classList.contains('node-shape-container')).toBe(true);
  });

  it('does not render NodeResizer for ref-nodes even when selected', () => {
    const { container } = render(
      <NodeRenderer {...makeProps({
        node: { id: 'test-ref', ref: 'test-ref.yaml', position: { x: 0, y: 0 } },
        isRef: true,
        isSelected: true,
      }) as any} />
    );
    // NodeResizer was removed along with auto-sizing; ref-nodes are now compact fixed-size
    const resizer = container.querySelector('[data-testid="node-resizer"]');
    expect(resizer).toBeNull();
  });

  it('does not render NodeResizer for inline nodes', () => {
    const { container } = render(
      <NodeRenderer {...makeProps() as any} />
    );
    const resizer = container.querySelector('[data-testid="node-resizer"]');
    expect(resizer).toBeNull();
  });
});

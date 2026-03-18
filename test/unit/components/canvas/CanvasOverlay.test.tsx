import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CanvasOverlay } from '@/components/canvas/CanvasOverlay';

// Mock ReactFlow and related
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: any) => <div data-testid="reactflow">{children}</div>,
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  useReactFlow: () => ({ setViewport: vi.fn(), getViewport: () => ({ x: 0, y: 0, zoom: 1 }) }),
}));

vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector: any) => {
    const state = {
      project: { canvases: new Map() },
      getCanvas: () => ({
        data: { nodes: [{ id: 'n1', type: 'compute/service', displayName: 'Test', position: { x: 0, y: 0 } }], edges: [] },
      }),
    };
    return selector(state);
  }),
}));

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: vi.fn((sel: any) => sel({ resolve: () => undefined })),
}));

describe('CanvasOverlay', () => {
  it('renders with absolute positioning', () => {
    const { container } = render(<CanvasOverlay canvasId="test" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe('absolute');
  });

  it('applies clipPath prop to wrapper', () => {
    const { container } = render(
      <CanvasOverlay canvasId="test" clipPath="inset(10px 20px 30px 40px)" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.clipPath).toBe('inset(10px 20px 30px 40px)');
  });

  it('sets pointer-events none when backdrop', () => {
    const { container } = render(<CanvasOverlay canvasId="test" backdrop />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.pointerEvents).toBe('none');
  });

  it('calls onReactFlowReady with RF instance', async () => {
    const onReady = vi.fn();
    render(<CanvasOverlay canvasId="test" onReactFlowReady={onReady} />);
    // useEffect fires synchronously in test, useReactFlow mock returns the mock instance
    expect(onReady).toHaveBeenCalled();
  });

  it('sets containerRef on wrapper div', () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement | null>;
    render(<CanvasOverlay canvasId="test" containerRef={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

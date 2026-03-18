import { describe, it, expect, beforeEach, vi } from 'vitest';

// Polyfill ResizeObserver for jsdom (ReactFlow requires it)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

import { render } from '@testing-library/react';
import { SubsystemPreview } from '@/components/nodes/SubsystemPreview';
import { useFileStore } from '@/store/fileStore';

// Mock registryStore — SubsystemPreview uses it for node type resolution
vi.mock('@/store/registryStore', () => ({
  useRegistryStore: (selector: any) => selector({ resolve: () => undefined }),
}));

function setCanvas(canvasId: string, data: { nodes?: any[]; edges?: any[] }) {
  const store = useFileStore.getState();
  const canvases = new Map(store.project?.canvases ?? []);
  canvases.set(canvasId, { data, filePath: `${canvasId}.yaml`, doc: undefined } as any);
  useFileStore.setState({
    project: {
      ...(store.project ?? { root: { data: {}, path: 'root.yaml' } }),
      canvases,
    } as any,
  });
}

describe('SubsystemPreview', () => {
  beforeEach(() => {
    useFileStore.setState({ project: null } as any);
  });

  it('renders nothing when canvas has no nodes', () => {
    setCanvas('test-canvas', { nodes: [] });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    expect(container.querySelector('.subsystem-preview')).toBeNull();
  });

  it('renders nothing when canvas does not exist', () => {
    const { container } = render(<SubsystemPreview canvasId="nonexistent" />);
    expect(container.querySelector('.subsystem-preview')).toBeNull();
  });

  it('renders a ReactFlow instance with nodes', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'database', position: { x: 100, y: 50 } },
      ],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    // Should have the preview wrapper with a ReactFlow instance inside
    expect(container.querySelector('.subsystem-preview')).toBeTruthy();
    expect(container.querySelector('.react-flow')).toBeTruthy();
  });

  it('wraps ReactFlow in its own ReactFlowProvider (no throw)', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
      ],
    });
    // If no provider, ReactFlow would throw. Rendering without error = provider present.
    expect(() => {
      render(<SubsystemPreview canvasId="test-canvas" />);
    }).not.toThrow();
  });

  it('has the subsystem-preview wrapper class', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
      ],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    expect(container.querySelector('.subsystem-preview')).toBeTruthy();
  });
});

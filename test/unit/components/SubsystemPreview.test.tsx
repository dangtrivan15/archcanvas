import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SubsystemPreview } from '@/components/nodes/SubsystemPreview';
import { useFileStore } from '@/store/fileStore';

// Helper to set up a canvas in the store
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
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders nothing when canvas does not exist', () => {
    const { container } = render(<SubsystemPreview canvasId="nonexistent" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders rect elements for each node', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'database', position: { x: 100, y: 50 } },
      ],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);
  });

  it('renders text labels for each node', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', displayName: 'API', position: { x: 0, y: 0 } },
      ],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    const texts = container.querySelectorAll('text');
    expect(texts.length).toBe(1);
    expect(texts[0].textContent).toBe('API');
  });

  it('renders line elements for each edge', () => {
    setCanvas('test-canvas', {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'database', position: { x: 100, y: 50 } },
      ],
      edges: [{ from: { node: 'a' }, to: { node: 'b' } }],
    });
    const { container } = render(<SubsystemPreview canvasId="test-canvas" />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(1);
  });
});

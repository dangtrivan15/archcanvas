import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock motion to avoid animation complexity in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

const allNodeDefs = [
  {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      namespace: 'compute',
      name: 'service',
      displayName: 'Service',
      icon: 'Server',
      shape: 'rectangle',
      version: '1.0',
    },
    spec: {},
  },
  {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      namespace: 'compute',
      name: 'function',
      displayName: 'Function',
      icon: 'Zap',
      shape: 'hexagon',
      version: '1.0',
    },
    spec: {},
  },
  {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      namespace: 'data',
      name: 'database',
      displayName: 'Database',
      icon: 'Database',
      shape: 'cylinder',
      version: '1.0',
    },
    spec: {},
  },
];

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: {
    getState: () => ({
      list: () => allNodeDefs,
      search: (query: string) => {
        if (!query) return allNodeDefs;
        const q = query.toLowerCase();
        return allNodeDefs.filter(
          (d) =>
            d.metadata.name.includes(q) ||
            d.metadata.displayName.toLowerCase().includes(q),
        );
      },
    }),
  },
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: { getState: () => ({ currentCanvasId: '__root__' }) },
}));

vi.mock('@/lib/createNodeFromType', () => ({
  createNodeFromType: vi.fn(),
}));

const mockStartDrag = vi.fn();
vi.mock('@/lib/pointerDrag', () => ({
  startDrag: (...args: unknown[]) => mockStartDrag(...args),
  isDragging: () => false,
}));

vi.mock('@/components/nodes/iconMap', () => ({
  resolveIcon: () => null,
}));

import { NodeTypeOverlay } from '@/components/layout/NodeTypeOverlay';
import { createNodeFromType } from '@/lib/createNodeFromType';

describe('NodeTypeOverlay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when not visible', () => {
    render(<NodeTypeOverlay visible={false} pinned={false} onPin={vi.fn()} />);
    expect(screen.queryByTestId('node-type-overlay')).toBeNull();
  });

  it('renders overlay with namespace groups when visible', () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const overlay = screen.getByTestId('node-type-overlay');
    expect(overlay).toBeDefined();
    expect(overlay.textContent).toContain('compute');
    expect(overlay.textContent).toContain('data');
    expect(overlay.textContent).toContain('Service');
    expect(overlay.textContent).toContain('Function');
    expect(overlay.textContent).toContain('Database');
  });

  it('filters types by search query', async () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const input = screen.getByPlaceholderText('Filter types...');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'service' } });
    });
    const overlay = screen.getByTestId('node-type-overlay');
    expect(overlay.textContent).toContain('Service');
    expect(overlay.textContent).not.toContain('Database');
  });

  it('hides empty namespace groups when filter active', async () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const input = screen.getByPlaceholderText('Filter types...');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'database' } });
    });
    const overlay = screen.getByTestId('node-type-overlay');
    expect(overlay.textContent).toContain('data');
    expect(overlay.textContent).not.toContain('compute');
  });

  it('calls createNodeFromType on click-to-add', async () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const items = screen.getAllByTestId('node-type-item');
    const serviceItem = items.find((el) => el.textContent?.includes('Service'));
    await act(async () => { fireEvent.click(serviceItem!); });
    expect(createNodeFromType).toHaveBeenCalledWith('__root__', 'compute/service');
  });

  it('calls startDrag with typeKey on pointerDown', () => {
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={vi.fn()} />);
    const items = screen.getAllByTestId('node-type-item');
    const serviceItem = items.find((el) => el.textContent?.includes('Service'));

    fireEvent.pointerDown(serviceItem!, { button: 0 });
    expect(mockStartDrag).toHaveBeenCalledWith(
      'compute/service',
      'Service',
      expect.any(Object),
    );
  });

  it('auto-pins overlay on pointer down', () => {
    const onPin = vi.fn();
    render(<NodeTypeOverlay visible={true} pinned={false} onPin={onPin} />);
    const items = screen.getAllByTestId('node-type-item');
    const serviceItem = items.find((el) => el.textContent?.includes('Service'));

    fireEvent.pointerDown(serviceItem!, { button: 0 });
    expect(onPin).toHaveBeenCalledWith(true);
  });

  it('shows pinned indicator when pinned', () => {
    render(<NodeTypeOverlay visible={true} pinned={true} onPin={vi.fn()} />);
    const overlay = screen.getByTestId('node-type-overlay');
    expect(overlay.getAttribute('data-pinned')).toBe('true');
  });
});

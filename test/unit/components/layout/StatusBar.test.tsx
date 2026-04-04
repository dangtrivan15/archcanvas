import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBar } from '@/components/layout/StatusBar';
import { useCanvasStore } from '@/store/canvasStore';
import { useUpdaterStore } from '@/store/updaterStore';

// Mock motion/react — required for happy-dom test environment
vi.mock('motion/react', () => ({
  motion: {
    span: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: Record<string, unknown>) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock('@/components/ui/sliding-number', () => ({
  SlidingNumber: ({ number }: { number: number }) => <span>{number}</span>,
}));

// Mock the updater module
vi.mock('@/core/updater', () => ({
  downloadAndInstall: vi.fn(),
  relaunch: vi.fn(),
}));

// Mock stores that StatusBar depends on
vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector) =>
    selector({
      dirtyCanvases: new Set(),
      getCanvas: () => ({ data: { nodes: [], edges: [] } }),
      project: { root: { filePath: 'test.yml' } },
    }),
  ),
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: vi.fn((selector) =>
    selector({
      currentCanvasId: 'root',
      breadcrumb: [{ displayName: 'Root' }],
    }),
  ),
}));

describe('StatusBar selection count', () => {
  beforeEach(() => {
    useUpdaterStore.getState().reset();
    useCanvasStore.setState({
      selectedNodeIds: new Set(),
      selectedEdgeKeys: new Set(),
    });
  });

  it('does not show selection badge when nothing is selected', () => {
    render(<StatusBar />);
    expect(screen.queryByTestId('selection-count')).toBeNull();
  });

  it('shows selection badge when nodes are selected', () => {
    useCanvasStore.setState({ selectedNodeIds: new Set(['a', 'b']) });
    render(<StatusBar />);
    const badge = screen.getByTestId('selection-count');
    expect(badge.textContent).toContain('2');
    expect(badge.textContent).toContain('selected');
  });

  it('shows selection badge when an edge is selected', () => {
    useCanvasStore.setState({ selectedEdgeKeys: new Set(['a→b']) });
    render(<StatusBar />);
    const badge = screen.getByTestId('selection-count');
    expect(badge.textContent).toContain('1');
    expect(badge.textContent).toContain('selected');
  });

  it('hides selection badge when selection is cleared', () => {
    useCanvasStore.setState({ selectedNodeIds: new Set(['a']) });
    const { rerender } = render(<StatusBar />);
    expect(screen.getByTestId('selection-count')).toBeTruthy();

    useCanvasStore.setState({ selectedNodeIds: new Set() });
    rerender(<StatusBar />);
    expect(screen.queryByTestId('selection-count')).toBeNull();
  });
});

describe('StatusBar update indicator', () => {
  beforeEach(() => {
    useUpdaterStore.getState().reset();
    useCanvasStore.setState({
      selectedNodeIds: new Set(),
      selectedEdgeKeys: new Set(),
    });
  });

  it('shows nothing when idle', () => {
    render(<StatusBar />);
    expect(screen.queryByTestId('update-indicator')).toBeNull();
  });

  it('shows version available when update-available', () => {
    useUpdaterStore.getState().setUpdateAvailable('1.2.0');
    render(<StatusBar />);
    const indicator = screen.getByTestId('update-indicator');
    expect(indicator.textContent).toContain('v1.2.0 available');
  });

  it('calls downloadAndInstall when update-available indicator is clicked', async () => {
    const { downloadAndInstall } = await import('@/core/updater');
    useUpdaterStore.getState().setUpdateAvailable('1.2.0');
    render(<StatusBar />);
    fireEvent.click(screen.getByTestId('update-indicator'));
    expect(downloadAndInstall).toHaveBeenCalled();
  });

  it('shows downloading state', () => {
    useUpdaterStore.getState().setStatus('downloading');
    render(<StatusBar />);
    const indicator = screen.getByTestId('update-indicator');
    expect(indicator.textContent).toContain('Downloading');
  });

  it('shows restart prompt when ready-to-restart', () => {
    useUpdaterStore.getState().setStatus('ready-to-restart');
    render(<StatusBar />);
    const indicator = screen.getByTestId('update-indicator');
    expect(indicator.textContent).toContain('Restart to update');
  });

  it('calls relaunch when restart indicator is clicked', async () => {
    const { relaunch } = await import('@/core/updater');
    useUpdaterStore.getState().setStatus('ready-to-restart');
    render(<StatusBar />);
    fireEvent.click(screen.getByTestId('update-indicator'));
    expect(relaunch).toHaveBeenCalled();
  });
});

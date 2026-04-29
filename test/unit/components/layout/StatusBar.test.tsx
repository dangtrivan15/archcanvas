import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBar } from '@/components/layout/StatusBar';
import { useUpdaterStore } from '@/store/updaterStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useRegistryStore } from '@/store/registryStore';
import { useThemeStore } from '@/store/themeStore';

// Mock motion/react — required for happy-dom test environment
vi.mock('motion/react', () => ({
  motion: {
    span: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children as React.ReactNode}</span>,
    button: ({ children, ...props }: Record<string, unknown>) => <button {...props}>{children as React.ReactNode}</button>,
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

vi.mock('@/store/themeStore', () => ({
  useThemeStore: vi.fn((selector) =>
    selector({
      statusBarDensity: 'comfortable',
    }),
  ),
}));

// Mock registryStore and uiStore (used by registry indicator)
vi.mock('@/store/registryStore', () => ({
  useRegistryStore: vi.fn((selector) =>
    selector({
      builtinCount: 32,
      projectLocalCount: 0,
      overrides: [],
      loadErrors: [],
      availableUpdates: new Map(),
      pinnedVersions: new Map(),
    }),
  ),
  computeEffectiveUpdateCount: (
    availableUpdates: Map<string, string>,
    pinnedVersions: Map<string, string>,
  ) =>
    [...availableUpdates.entries()].filter(([k, v]) => pinnedVersions.get(k) !== v).length,
}));

const mockOpenRegistryPanel = vi.fn();

vi.mock('@/store/uiStore', () => ({
  useUiStore: vi.fn((selector) =>
    selector({
      openRegistryPanel: mockOpenRegistryPanel,
    }),
  ),
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

  it('does not show selection count when nothing is selected', () => {
    render(<StatusBar />);
    expect(screen.queryByTestId('selection-count')).toBeNull();
  });

  it('shows selection count when nodes are selected', () => {
    useCanvasStore.setState({ selectedNodeIds: new Set(['a', 'b']), selectedEdgeKeys: new Set() });
    render(<StatusBar />);
    const pill = screen.getByTestId('selection-count');
    expect(pill.textContent).toContain('2 selected');
  });

  it('shows selection count when edges are selected', () => {
    useCanvasStore.setState({ selectedNodeIds: new Set(), selectedEdgeKeys: new Set(['a→b']) });
    render(<StatusBar />);
    const pill = screen.getByTestId('selection-count');
    expect(pill.textContent).toContain('1 selected');
  });

  it('shows combined count for nodes and edges', () => {
    useCanvasStore.setState({ selectedNodeIds: new Set(['a']), selectedEdgeKeys: new Set(['b→c']) });
    render(<StatusBar />);
    const pill = screen.getByTestId('selection-count');
    expect(pill.textContent).toContain('2 selected');
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

describe('StatusBar density', () => {
  const mockedUseThemeStore = vi.mocked(useThemeStore);

  beforeEach(() => {
    useUpdaterStore.getState().reset();
    useCanvasStore.setState({
      selectedNodeIds: new Set(),
      selectedEdgeKeys: new Set(),
    });
    mockedUseThemeStore.mockImplementation((selector) =>
      selector({
        statusBarDensity: 'comfortable',
      } as ReturnType<typeof useThemeStore.getState>),
    );
  });

  it('renders with data-testid status-bar', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar')).toBeTruthy();
  });

  it('applies compact density classes', () => {
    mockedUseThemeStore.mockImplementation((selector) =>
      selector({
        statusBarDensity: 'compact',
      } as ReturnType<typeof useThemeStore.getState>),
    );
    render(<StatusBar />);
    const bar = screen.getByTestId('status-bar');
    expect(bar.className).toContain('h-5');
    expect(bar.className).toContain('text-[10px]');
    expect(bar.className).toContain('px-2');
  });

  it('applies comfortable density classes (default)', () => {
    render(<StatusBar />);
    const bar = screen.getByTestId('status-bar');
    expect(bar.className).toContain('h-6');
    expect(bar.className).toContain('text-xs');
    expect(bar.className).toContain('px-3');
  });

  it('applies expanded density classes', () => {
    mockedUseThemeStore.mockImplementation((selector) =>
      selector({
        statusBarDensity: 'expanded',
      } as ReturnType<typeof useThemeStore.getState>),
    );
    render(<StatusBar />);
    const bar = screen.getByTestId('status-bar');
    expect(bar.className).toContain('h-8');
    expect(bar.className).toContain('text-[13px]');
    expect(bar.className).toContain('px-3.5');
  });
});

describe('StatusBar registry indicator', () => {
  const mockedUseRegistryStore = vi.mocked(useRegistryStore);

  beforeEach(() => {
    useUpdaterStore.getState().reset();
    useCanvasStore.setState({
      selectedNodeIds: new Set(),
      selectedEdgeKeys: new Set(),
    });
    mockOpenRegistryPanel.mockClear();
    mockedUseRegistryStore.mockImplementation((selector) =>
      selector({
        builtinCount: 32,
        projectLocalCount: 0,
        overrides: [],
        loadErrors: [],
        availableUpdates: new Map(),
        pinnedVersions: new Map(),
      } as any),
    );
  });

  it('shows builtin count', () => {
    render(<StatusBar />);
    const indicator = screen.getByTestId('registry-indicator');
    expect(indicator.textContent).toContain('32');
    expect(indicator.textContent).toContain('types');
  });

  it('shows "N + M types" when projectLocalCount > 0', () => {
    mockedUseRegistryStore.mockImplementation((selector) =>
      selector({
        builtinCount: 32,
        projectLocalCount: 3,
        overrides: [],
        loadErrors: [],
        availableUpdates: new Map(),
        pinnedVersions: new Map(),
      } as any),
    );
    render(<StatusBar />);
    const indicator = screen.getByTestId('registry-indicator');
    expect(indicator.textContent).toContain('32');
    expect(indicator.textContent).toContain('3');
  });

  it('clicking indicator calls openRegistryPanel', () => {
    render(<StatusBar />);
    fireEvent.click(screen.getByTestId('registry-indicator'));
    expect(mockOpenRegistryPanel).toHaveBeenCalled();
  });
});

describe('StatusBar nodedef updates badge', () => {
  const mockedUseRegistryStore = vi.mocked(useRegistryStore);

  beforeEach(() => {
    useUpdaterStore.getState().reset();
    useCanvasStore.setState({
      selectedNodeIds: new Set(),
      selectedEdgeKeys: new Set(),
    });
    mockedUseRegistryStore.mockImplementation((selector) =>
      selector({
        builtinCount: 32,
        projectLocalCount: 0,
        overrides: [],
        loadErrors: [],
        availableUpdates: new Map(),
        pinnedVersions: new Map(),
      } as any),
    );
  });

  it('hides badge when no updates are available', () => {
    render(<StatusBar />);
    expect(screen.queryByTestId('nodedef-updates-badge')).toBeNull();
  });

  it('shows badge with count when updates are available', () => {
    mockedUseRegistryStore.mockImplementation((selector) =>
      selector({
        builtinCount: 32,
        projectLocalCount: 0,
        overrides: [],
        loadErrors: [],
        availableUpdates: new Map([['acme/widget', '2.0.0']]),
        pinnedVersions: new Map(),
      } as any),
    );
    render(<StatusBar />);
    const badge = screen.getByTestId('nodedef-updates-badge');
    expect(badge.textContent).toContain('Updates (1)');
  });

  it('hides badge when all updates are pinned (dismissed)', () => {
    mockedUseRegistryStore.mockImplementation((selector) =>
      selector({
        builtinCount: 32,
        projectLocalCount: 0,
        overrides: [],
        loadErrors: [],
        availableUpdates: new Map([['acme/widget', '2.0.0']]),
        pinnedVersions: new Map([['acme/widget', '2.0.0']]),
      } as any),
    );
    render(<StatusBar />);
    expect(screen.queryByTestId('nodedef-updates-badge')).toBeNull();
  });

  it('shows badge count excluding pinned entries', () => {
    mockedUseRegistryStore.mockImplementation((selector) =>
      selector({
        builtinCount: 32,
        projectLocalCount: 0,
        overrides: [],
        loadErrors: [],
        availableUpdates: new Map([
          ['acme/widget', '2.0.0'],
          ['acme/gadget', '3.0.0'],
        ]),
        pinnedVersions: new Map([['acme/widget', '2.0.0']]),
      } as any),
    );
    render(<StatusBar />);
    const badge = screen.getByTestId('nodedef-updates-badge');
    expect(badge.textContent).toContain('Updates (1)');
  });

  it('re-shows badge when newer version supersedes pin', () => {
    mockedUseRegistryStore.mockImplementation((selector) =>
      selector({
        builtinCount: 32,
        projectLocalCount: 0,
        overrides: [],
        loadErrors: [],
        availableUpdates: new Map([['acme/widget', '3.0.0']]),
        pinnedVersions: new Map([['acme/widget', '2.0.0']]),
      } as any),
    );
    render(<StatusBar />);
    const badge = screen.getByTestId('nodedef-updates-badge');
    expect(badge.textContent).toContain('Updates (1)');
  });
});

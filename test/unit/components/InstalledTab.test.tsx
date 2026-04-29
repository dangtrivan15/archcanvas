import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InstalledTab } from '@/components/registry/InstalledTab';

// ---------------------------------------------------------------------------
// Icon mocks
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  RefreshCw: ({ className }: { className?: string }) => <span data-testid="icon-refresh" className={className} />,
  AlertTriangle: ({ className }: { className?: string }) => <span data-testid="icon-alert" className={className} />,
  ArrowLeftRight: ({ className }: { className?: string }) => <span data-testid="icon-override" className={className} />,
  Layers: ({ className }: { className?: string }) => <span data-testid="icon-layers" className={className} />,
}));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
let authState = { isAuthenticated: false, username: null as string | null };
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((selector?: (s: typeof authState) => unknown) =>
    typeof selector === 'function' ? selector(authState) : authState
  ),
}));

let keycloakConfigured = false;
vi.mock('@/core/auth/config', () => ({
  isKeycloakConfigured: () => keycloakConfigured,
}));

vi.mock('@/components/auth/AuthStatusSection', () => ({
  AuthStatusSection: () => null,
}));

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------
vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) =>
    <div data-testid="context-menu-item" onClick={onSelect}>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------
const mockApplyUpdate = vi.fn();
const mockDismissUpdate = vi.fn();
const mockReloadProjectLocal = vi.fn();

let registryState: Record<string, unknown> = {
  builtinCount: 5,
  projectLocalCount: 0,
  projectLocalKeys: new Set<string>(),
  remoteInstalledCount: 0,
  remoteInstalledKeys: new Set<string>(),
  overrides: [] as string[],
  loadErrors: [] as Array<{ file: string; message: string }>,
  registry: null,
  lockfile: null,
  availableUpdates: new Map<string, string>(),
  pinnedVersions: new Map<string, string>(),
  applyUpdate: mockApplyUpdate,
  dismissUpdate: mockDismissUpdate,
};

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: Object.assign(
    vi.fn((selector: (s: typeof registryState) => unknown) => selector(registryState)),
    {
      getState: () => ({
        reloadProjectLocal: mockReloadProjectLocal,
      }),
    },
  ),
}));

const mockSetNotification = vi.fn();
let uiState: Record<string, unknown> = {
  notification: null as { message: string; type: 'success' | 'error' } | null,
  clearNotification: vi.fn(),
};

vi.mock('@/store/uiStore', () => ({
  useUiStore: Object.assign(
    vi.fn((selector: (s: typeof uiState) => unknown) => selector(uiState)),
    {
      getState: () => ({
        setNotification: mockSetNotification,
        openPublishNodeDefDialog: vi.fn(),
      }),
    },
  ),
}));

const mockFs = { exists: vi.fn(), readFile: vi.fn(), writeFile: vi.fn() };
vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector) =>
    selector({
      fs: mockFs,
      projectPath: '/test/project',
    }),
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRemoteDef(namespace: string, name: string, version = '1.0.0') {
  return {
    kind: 'NodeDef' as const,
    apiVersion: 'v1' as const,
    metadata: {
      name,
      namespace,
      version,
      displayName: `${name} display`,
      description: 'desc',
      icon: 'Box',
      shape: 'rectangle' as const,
    },
    spec: { ports: [] },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InstalledTab — basic rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keycloakConfigured = false;
    authState = { isAuthenticated: false, username: null };
    registryState = {
      builtinCount: 5,
      projectLocalCount: 0,
      projectLocalKeys: new Set<string>(),
      remoteInstalledCount: 0,
      remoteInstalledKeys: new Set<string>(),
      overrides: [],
      loadErrors: [],
      registry: null,
      lockfile: null,
      availableUpdates: new Map<string, string>(),
      pinnedVersions: new Map<string, string>(),
      applyUpdate: mockApplyUpdate,
      dismissUpdate: mockDismissUpdate,
    };
    uiState = { notification: null, clearNotification: vi.fn() };
  });

  it('renders built-in count summary badge', () => {
    render(<InstalledTab />);
    expect(screen.getByText('5 built-in')).toBeTruthy();
  });

  it('renders reload button', () => {
    render(<InstalledTab />);
    expect(screen.getByTestId('registry-reload-btn')).toBeTruthy();
  });

  it('shows notification banner when notification is set', () => {
    uiState.notification = { message: 'Success!', type: 'success' };
    render(<InstalledTab />);
    expect(screen.getByRole('status').textContent).toContain('Success!');
  });

  it('shows error notification with destructive styles', () => {
    uiState.notification = { message: 'Update failed: timeout', type: 'error' };
    render(<InstalledTab />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Update failed: timeout');
  });

  it('shows load errors section when loadErrors is non-empty', () => {
    registryState.loadErrors = [{ file: 'bad.yaml', message: 'invalid format' }];
    render(<InstalledTab />);
    expect(screen.getByText('Validation Errors')).toBeTruthy();
    expect(screen.getByText('bad.yaml')).toBeTruthy();
  });
});

describe('InstalledTab — community-installed with update affordances', () => {
  const communityKey = 'acme/widget';

  beforeEach(() => {
    vi.clearAllMocks();
    keycloakConfigured = false;
    authState = { isAuthenticated: false, username: null };
    uiState = { notification: null, clearNotification: vi.fn() };

    registryState = {
      builtinCount: 2,
      projectLocalCount: 0,
      projectLocalKeys: new Set<string>(),
      remoteInstalledCount: 1,
      remoteInstalledKeys: new Set<string>([communityKey]),
      overrides: [],
      loadErrors: [],
      registry: {
        list: () => [makeRemoteDef('acme', 'widget', '1.0.0')],
      },
      lockfile: {
        lockfileVersion: 1,
        generatedAt: '2026-01-01T00:00:00.000Z',
        entries: {
          [communityKey]: { version: '1.0.0', source: 'remote' },
        },
      },
      availableUpdates: new Map<string, string>(),
      pinnedVersions: new Map<string, string>(),
      applyUpdate: mockApplyUpdate,
      dismissUpdate: mockDismissUpdate,
    };
  });

  it('shows community-installed section header', () => {
    render(<InstalledTab />);
    expect(screen.getByText('Community-Installed (1)')).toBeTruthy();
  });

  it('shows current version when no update available', () => {
    render(<InstalledTab />);
    expect(screen.getByText('v1.0.0')).toBeTruthy();
    expect(screen.queryByText(/→/)).toBeNull();
  });

  it('shows version upgrade arrow when update is available', () => {
    registryState.availableUpdates = new Map([[communityKey, '2.0.0']]);
    render(<InstalledTab />);
    // The upgrade label: v1.0.0 → v2.0.0
    const upgradeText = screen.getByText(/v1\.0\.0.*v2\.0\.0/);
    expect(upgradeText).toBeTruthy();
  });

  it('shows Update and Dismiss buttons when update is available', () => {
    registryState.availableUpdates = new Map([[communityKey, '2.0.0']]);
    render(<InstalledTab />);
    expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('hides Update/Dismiss buttons when update is pinned (dismissed)', () => {
    registryState.availableUpdates = new Map([[communityKey, '2.0.0']]);
    registryState.pinnedVersions = new Map([[communityKey, '2.0.0']]);
    render(<InstalledTab />);
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('calls dismissUpdate with key and version when Dismiss is clicked', () => {
    registryState.availableUpdates = new Map([[communityKey, '2.0.0']]);
    render(<InstalledTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(mockDismissUpdate).toHaveBeenCalledWith(communityKey, '2.0.0');
  });

  it('calls applyUpdate and shows success notification on Update click', async () => {
    registryState.availableUpdates = new Map([[communityKey, '2.0.0']]);
    mockApplyUpdate.mockResolvedValueOnce(undefined);
    render(<InstalledTab />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    });
    expect(mockApplyUpdate).toHaveBeenCalledWith(mockFs, '/test/project', 'acme', 'widget');
    expect(mockSetNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' }),
    );
  });

  it('shows error notification when applyUpdate throws', async () => {
    registryState.availableUpdates = new Map([[communityKey, '2.0.0']]);
    mockApplyUpdate.mockRejectedValueOnce(new Error('network timeout'));
    render(<InstalledTab />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    });
    expect(mockSetNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: expect.stringContaining('network timeout') }),
    );
  });

  it('disables Update button while update is in progress', async () => {
    registryState.availableUpdates = new Map([[communityKey, '2.0.0']]);
    // Make applyUpdate hang so we can check intermediate state
    let resolveUpdate!: () => void;
    mockApplyUpdate.mockReturnValueOnce(new Promise<void>((res) => { resolveUpdate = res; }));
    render(<InstalledTab />);
    const updateBtn = screen.getByRole('button', { name: 'Update' });
    fireEvent.click(updateBtn);
    // Button should now show "Updating…" and be disabled
    expect(screen.getByRole('button', { name: 'Updating…' }).hasAttribute('disabled')).toBe(true);
    // Resolve to clean up
    await act(async () => { resolveUpdate(); });
  });

  it('does not call applyUpdate when projectPath is null', async () => {
    // Override fileStore mock to return null projectPath for this test
    const { useFileStore } = await import('@/store/fileStore');
    vi.mocked(useFileStore).mockImplementation((selector) =>
      selector({ fs: mockFs, projectPath: null }),
    );
    registryState.availableUpdates = new Map([[communityKey, '2.0.0']]);
    render(<InstalledTab />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    });
    expect(mockApplyUpdate).not.toHaveBeenCalled();
    // Restore the default mock implementation
    vi.mocked(useFileStore).mockImplementation((selector) =>
      selector({ fs: mockFs, projectPath: '/test/project' }),
    );
  });
});

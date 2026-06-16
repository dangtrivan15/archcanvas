import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NodeDefDetailView } from '@/components/registry/NodeDefDetailView';
import type { RemoteNodeDefDetail } from '@/core/registry/remoteRegistry';
import type { RemoteVersionSummary } from '@/core/registry/remoteRegistry';

// ---------------------------------------------------------------------------
// Mock lucide-react icons to avoid rendering issues in test env
// ---------------------------------------------------------------------------

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  Copy: () => <span data-testid="icon-copy" />,
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
  XIcon: () => <span data-testid="icon-x" />,
  Trash2: () => <span data-testid="icon-trash" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
}));

// ---------------------------------------------------------------------------
// Store mocks
// ---------------------------------------------------------------------------

const mockSelectNodeDef = vi.fn();
const mockSetNamespace = vi.fn();
const mockOpenInstallNodeDefDialog = vi.fn();
const mockUninstallRemoteNodeDef = vi.fn();
const mockSelectVersion = vi.fn();
const mockSetTag = vi.fn();

// A valid NodeDef blob
const validBlob = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'widget',
    namespace: 'acme',
    version: '1.0.0',
    displayName: 'Widget',
    description: 'A reusable widget.',
    icon: 'box',
    shape: 'rectangle',
  },
  spec: {
    ports: [
      { name: 'input', direction: 'inbound', protocol: ['http', 'grpc'], description: 'Main input' },
      { name: 'output', direction: 'outbound', protocol: ['http'], description: 'Main output' },
    ],
    args: [
      { name: 'timeout', type: 'number', required: true, description: 'Timeout in ms', default: 5000 },
      { name: 'label', type: 'string', required: false, description: 'Display label' },
    ],
  },
};

const mockDetail: RemoteNodeDefDetail = {
  nodedef: {
    namespace: 'acme',
    name: 'widget',
    latestVer: '1.2.3',
    displayName: 'Acme Widget',
    description: 'A great widget for testing.',
    tags: ['ui', 'component'],
    downloadCount: 42,
  },
  version: {
    nodedefId: 'acme/widget',
    version: '1.2.3',
    blob: validBlob as Record<string, unknown>,
    publishedBySub: 'user123',
    publishedAt: '2025-01-01T00:00:00Z',
  },
};

const mockVersionHistory: RemoteVersionSummary[] = [
  { version: '1.2.3', publishedAt: '2025-03-01T00:00:00Z', downloadCount: 30 },
  { version: '1.1.0', publishedAt: '2025-01-15T00:00:00Z', downloadCount: 12 },
];

let communityState = {
  selectedDetail: mockDetail as RemoteNodeDefDetail | null,
  detailLoading: false,
  selectNodeDef: mockSelectNodeDef,
  selectVersion: mockSelectVersion,
  selectedVersion: null as string | null,
  setNamespace: mockSetNamespace,
  setTag: mockSetTag,
  versionHistory: null as RemoteVersionSummary[] | null,
  versionHistoryLoading: false,
  versionHistoryError: null as string | null,
};

let uiState = {
  openInstallNodeDefDialog: mockOpenInstallNodeDefDialog,
};

let authState = {
  username: null as string | null,
};

let registryState = {
  remoteInstalledKeys: new Set<string>(),
  remoteInstalledVersions: new Map<string, string>(),
  builtinKeys: new Set<string>(),
  uninstallRemoteNodeDef: mockUninstallRemoteNodeDef,
};

let fileState = {
  fs: {} as object,
  projectPath: 'project' as string | null,
};

vi.mock('@/store/communityBrowserStore', () => ({
  useCommunityBrowserStore: vi.fn(
    (selector: (s: typeof communityState) => unknown) => selector(communityState),
  ),
}));

vi.mock('@/store/uiStore', () => ({
  useUiStore: vi.fn((selector: (s: typeof uiState) => unknown) => selector(uiState)),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: typeof authState) => unknown) => selector(authState)),
}));

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: vi.fn((selector: (s: typeof registryState) => unknown) => selector(registryState)),
}));

vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector: (s: typeof fileState) => unknown) => selector(fileState)),
}));

// ---------------------------------------------------------------------------
// Clipboard mock
// ---------------------------------------------------------------------------

const mockWriteText = vi.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setCommunityState(patch: Partial<typeof communityState>) {
  communityState = { ...communityState, ...patch };
}

function setAuthState(patch: Partial<typeof authState>) {
  authState = { ...authState, ...patch };
}

function setRegistryState(patch: Partial<typeof registryState>) {
  registryState = { ...registryState, ...patch };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NodeDefDetailView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSelectNodeDef.mockClear();
    mockSetNamespace.mockClear();
    mockOpenInstallNodeDefDialog.mockClear();
    mockWriteText.mockReset().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    communityState = {
      selectedDetail: mockDetail,
      detailLoading: false,
      selectNodeDef: mockSelectNodeDef,
      selectVersion: mockSelectVersion,
      selectedVersion: null,
      setNamespace: mockSetNamespace,
      setTag: mockSetTag,
      versionHistory: null,
      versionHistoryLoading: false,
      versionHistoryError: null,
    };

    authState = { username: null };

    registryState = {
      remoteInstalledKeys: new Set<string>(),
      remoteInstalledVersions: new Map<string, string>(),
      builtinKeys: new Set<string>(),
      uninstallRemoteNodeDef: mockUninstallRemoteNodeDef,
    };
    mockUninstallRemoteNodeDef.mockClear();
    mockSelectVersion.mockClear();
    mockSetTag.mockClear();

    fileState = { fs: {}, projectPath: 'project' };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Renders display name and description
  it('renders display name and description', () => {
    render(<NodeDefDetailView />);
    expect(screen.getByText('Acme Widget')).toBeTruthy();
    expect(screen.getByText('A great widget for testing.')).toBeTruthy();
  });

  // 2. Namespace badge click calls setNamespace and selectNodeDef(null)
  it('namespace badge click calls setNamespace and selectNodeDef(null)', () => {
    render(<NodeDefDetailView />);
    fireEvent.click(screen.getByTestId('detail-namespace-btn'));
    expect(mockSetNamespace).toHaveBeenCalledWith('acme');
    expect(mockSelectNodeDef).toHaveBeenCalledWith(null);
  });

  // 3. Renders input ports from blob
  it('renders input ports parsed from blob', () => {
    render(<NodeDefDetailView />);
    expect(screen.getByText('Input Ports')).toBeTruthy();
    expect(screen.getByText('input')).toBeTruthy();
    expect(screen.getByText('[http, grpc]')).toBeTruthy();
    expect(screen.getByText('Main input')).toBeTruthy();
  });

  // 4. Renders output ports from blob
  it('renders output ports parsed from blob', () => {
    render(<NodeDefDetailView />);
    expect(screen.getByText('Output Ports')).toBeTruthy();
    expect(screen.getByText('output')).toBeTruthy();
    expect(screen.getByText('[http]')).toBeTruthy();
    expect(screen.getByText('Main output')).toBeTruthy();
  });

  // 5. Renders argument definitions
  it('renders argument definitions', () => {
    render(<NodeDefDetailView />);
    expect(screen.getByText('Arguments')).toBeTruthy();
    expect(screen.getByText('timeout')).toBeTruthy();
    expect(screen.getByText('number')).toBeTruthy();
    expect(screen.getByText('Timeout in ms')).toBeTruthy();
    expect(screen.getByText('5000')).toBeTruthy();
    expect(screen.getByText('label')).toBeTruthy();
    expect(screen.getByText('string')).toBeTruthy();
  });

  // 5 (alt). "Spec unavailable" renders when blob is not valid NodeDef shape
  it('renders "Spec unavailable" when blob is not valid NodeDef shape', () => {
    setCommunityState({
      selectedDetail: {
        ...mockDetail,
        version: { ...mockDetail.version, blob: { kind: 'NotANodeDef' } },
      },
    });
    render(<NodeDefDetailView />);
    expect(screen.getByText('Spec unavailable')).toBeTruthy();
  });

  // 6. Version history list renders correct strings when versionHistory is set
  it('renders version history list when versionHistory is set', () => {
    setCommunityState({ versionHistory: mockVersionHistory });
    render(<NodeDefDetailView />);
    expect(screen.getByText('1.2.3')).toBeTruthy();
    expect(screen.getByText('1.1.0')).toBeTruthy();
    expect(screen.getByText('30 ↓')).toBeTruthy();
    expect(screen.getByText('12 ↓')).toBeTruthy();
  });

  // 7. Loading text shown when versionHistoryLoading is true
  it('shows loading text when versionHistoryLoading is true', () => {
    setCommunityState({ versionHistoryLoading: true });
    render(<NodeDefDetailView />);
    // There may be multiple "Loading…" elements (detail loading state + version history)
    const loadingElements = screen.getAllByText('Loading…');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  // 8. Error message shown when versionHistoryError is set
  it('shows error message when versionHistoryError is set', () => {
    setCommunityState({ versionHistoryError: 'Network failure' });
    render(<NodeDefDetailView />);
    expect(screen.getByText('Network failure')).toBeTruthy();
  });

  // 9. Install snippet shows correct namespace/name@version string
  it('install snippet shows correct namespace/name@version string', () => {
    render(<NodeDefDetailView />);
    expect(screen.getByText('acme/widget@1.2.3')).toBeTruthy();
  });

  // 10. Copy button invokes navigator.clipboard.writeText with correct snippet
  it('copy button invokes clipboard.writeText with correct snippet', async () => {
    render(<NodeDefDetailView />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('detail-copy-btn'));
    });
    expect(mockWriteText).toHaveBeenCalledWith('acme/widget@1.2.3');
  });

  // 10 (copy revert). Check icon shows after copy, then reverts to Copy icon after 2s
  it('shows Check icon after copy then reverts to Copy icon after 2s', async () => {
    render(<NodeDefDetailView />);

    // Before click — Copy icon is shown
    expect(screen.getByTestId('icon-copy')).toBeTruthy();
    expect(screen.queryByTestId('icon-check')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('detail-copy-btn'));
    });

    // After click — Check icon is shown
    expect(screen.getByTestId('icon-check')).toBeTruthy();
    expect(screen.queryByTestId('icon-copy')).toBeNull();

    // After 2s — Copy icon is restored
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('icon-copy')).toBeTruthy();
    expect(screen.queryByTestId('icon-check')).toBeNull();
  });

  // 11. Manage section visible when username === nodedef.namespace
  it('shows Manage section when username matches nodedef namespace', () => {
    setAuthState({ username: 'acme' });
    render(<NodeDefDetailView />);
    expect(screen.getByText('Manage')).toBeTruthy();
    expect(screen.getByTestId('detail-manage-install-btn')).toBeTruthy();
  });

  // 12. Manage section hidden when username === null
  it('hides Manage section when username is null', () => {
    setAuthState({ username: null });
    render(<NodeDefDetailView />);
    expect(screen.queryByText('Manage')).toBeNull();
    expect(screen.queryByTestId('detail-manage-install-btn')).toBeNull();
  });

  // 13. Manage section hidden when username !== nodedef.namespace
  it('hides Manage section when username does not match namespace', () => {
    setAuthState({ username: 'other-user' });
    render(<NodeDefDetailView />);
    expect(screen.queryByText('Manage')).toBeNull();
    expect(screen.queryByTestId('detail-manage-install-btn')).toBeNull();
  });

  // 14. "Install to Workspace" in Manage section calls openInstallNodeDefDialog
  it('"Install to Workspace" button calls openInstallNodeDefDialog', () => {
    setAuthState({ username: 'acme' });
    render(<NodeDefDetailView />);
    fireEvent.click(screen.getByTestId('detail-manage-install-btn'));
    expect(mockOpenInstallNodeDefDialog).toHaveBeenCalledWith(mockDetail.nodedef);
  });

  // Loading state
  it('renders loading state when detailLoading is true', () => {
    setCommunityState({ detailLoading: true, selectedDetail: null });
    render(<NodeDefDetailView />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  // Null state
  it('renders nothing when selectedDetail is null and not loading', () => {
    setCommunityState({ selectedDetail: null, detailLoading: false });
    const { container } = render(<NodeDefDetailView />);
    expect(container.firstChild).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Install button state machine
  // ---------------------------------------------------------------------------

  describe('install button states', () => {
    it('renders "Install" when not installed and no built-in collision', () => {
      render(<NodeDefDetailView />);
      const btn = screen.getByTestId('detail-install-btn');
      expect(btn.textContent).toBe('Install');
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    it('renders "Install (overrides built-in)" when key collides with a built-in', () => {
      setRegistryState({ builtinKeys: new Set(['acme/widget']) });
      render(<NodeDefDetailView />);
      const btn = screen.getByTestId('detail-install-btn');
      expect(btn.textContent).toContain('overrides built-in');
    });

    it('renders "Installed" (disabled) when viewed version equals installed version', () => {
      setRegistryState({
        remoteInstalledKeys: new Set(['acme/widget']),
        remoteInstalledVersions: new Map([['acme/widget', '1.2.3']]),
      });
      render(<NodeDefDetailView />);
      const btn = screen.getByTestId('detail-install-btn');
      expect(btn.textContent).toContain('Installed');
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it('renders "Update to v1.2.3" when viewed version is newer than installed', () => {
      setRegistryState({
        remoteInstalledKeys: new Set(['acme/widget']),
        remoteInstalledVersions: new Map([['acme/widget', '1.0.0']]),
      });
      render(<NodeDefDetailView />);
      const btn = screen.getByTestId('detail-install-btn');
      expect(btn.textContent).toBe('Update to v1.2.3');
    });

    it('renders "Install v1.0.0 (downgrade)" when viewed version is older than installed', () => {
      // viewed is selectedVersion, falls back to mockDetail.version.version (1.2.3)
      // To test downgrade, set selectedVersion to an older version + version history
      setCommunityState({
        selectedVersion: '1.0.0',
        versionHistory: [
          { version: '1.2.3', publishedAt: '2025-03-01T00:00:00Z', downloadCount: 30 },
          { version: '1.0.0', publishedAt: '2025-01-01T00:00:00Z', downloadCount: 10 },
        ],
        selectedDetail: {
          ...mockDetail,
          version: { ...mockDetail.version, version: '1.0.0' },
        },
      });
      setRegistryState({
        remoteInstalledKeys: new Set(['acme/widget']),
        remoteInstalledVersions: new Map([['acme/widget', '1.2.3']]),
      });
      render(<NodeDefDetailView />);
      const btn = screen.getByTestId('detail-install-btn');
      expect(btn.textContent).toContain('1.0.0');
      expect(btn.textContent).toContain('downgrade');
    });
  });

  // ---------------------------------------------------------------------------
  // Uninstall button + confirm dialog
  // ---------------------------------------------------------------------------

  describe('uninstall flow', () => {
    it('does NOT render Uninstall button when not installed', () => {
      render(<NodeDefDetailView />);
      expect(screen.queryByTestId('detail-uninstall-btn')).toBeNull();
    });

    it('renders Uninstall button when installed', () => {
      setRegistryState({
        remoteInstalledKeys: new Set(['acme/widget']),
        remoteInstalledVersions: new Map([['acme/widget', '1.2.3']]),
      });
      render(<NodeDefDetailView />);
      expect(screen.getByTestId('detail-uninstall-btn')).toBeTruthy();
    });

    it('clicking Uninstall opens a confirm dialog', () => {
      setRegistryState({
        remoteInstalledKeys: new Set(['acme/widget']),
        remoteInstalledVersions: new Map([['acme/widget', '1.2.3']]),
      });
      render(<NodeDefDetailView />);
      fireEvent.click(screen.getByTestId('detail-uninstall-btn'));
      expect(screen.getByTestId('uninstall-confirm-dialog')).toBeTruthy();
      expect(screen.getByTestId('uninstall-confirm-btn')).toBeTruthy();
    });

    it('confirming uninstall calls uninstallRemoteNodeDef with namespace + name', async () => {
      setRegistryState({
        remoteInstalledKeys: new Set(['acme/widget']),
        remoteInstalledVersions: new Map([['acme/widget', '1.2.3']]),
      });
      mockUninstallRemoteNodeDef.mockResolvedValue(undefined);
      render(<NodeDefDetailView />);
      fireEvent.click(screen.getByTestId('detail-uninstall-btn'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('uninstall-confirm-btn'));
      });
      expect(mockUninstallRemoteNodeDef).toHaveBeenCalledWith(
        expect.anything(), 'acme', 'widget',
      );
    });

    it('confirm dialog mentions builtin restoration when key collides with built-in', () => {
      setRegistryState({
        remoteInstalledKeys: new Set(['acme/widget']),
        remoteInstalledVersions: new Map([['acme/widget', '1.2.3']]),
        builtinKeys: new Set(['acme/widget']),
      });
      render(<NodeDefDetailView />);
      fireEvent.click(screen.getByTestId('detail-uninstall-btn'));
      const dialog = screen.getByTestId('uninstall-confirm-dialog');
      expect(dialog.textContent).toMatch(/built-in/i);
    });
  });
});

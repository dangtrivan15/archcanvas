import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RegistryStatusDialog } from '@/components/RegistryStatusDialog';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  RefreshCw: ({ className }: { className?: string }) => <span data-testid="icon-refresh" className={className} />,
  AlertTriangle: ({ className }: { className?: string }) => <span data-testid="icon-alert" className={className} />,
  ArrowLeftRight: ({ className }: { className?: string }) => <span data-testid="icon-override" className={className} />,
  Layers: ({ className }: { className?: string }) => <span data-testid="icon-layers" className={className} />,
}));

// --- Store state ---

let authState: Record<string, unknown> = {
  isAuthenticated: false,
  username: null,
};

let uiState: Record<string, unknown> = {
  showRegistryStatusDialog: true,
  closeRegistryStatusDialog: vi.fn(),
  notification: null,
  clearNotification: vi.fn(),
};

let registryState: Record<string, unknown> = {
  builtinCount: 5,
  projectLocalCount: 0,
  projectLocalKeys: new Set<string>(),
  remoteInstalledCount: 0,
  remoteInstalledKeys: new Set<string>(),
  remoteInstalledVersions: new Map(),
  overrides: [] as string[],
  loadErrors: [] as Array<{ file: string; message: string }>,
  registry: null,
  lockfile: null,
};

const mockOpenPublishDialog = vi.fn();

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    typeof selector === 'function' ? selector(authState) : authState
  ),
}));

vi.mock('@/store/uiStore', () => ({
  useUiStore: Object.assign(
    vi.fn((selector: (s: typeof uiState) => unknown) => selector(uiState)),
    {
      getState: () => ({
        openPublishNodeDefDialog: mockOpenPublishDialog,
      }),
    },
  ),
}));

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: Object.assign(
    vi.fn((selector: (s: typeof registryState) => unknown) => selector(registryState)),
    {
      getState: () => ({
        reloadProjectLocal: vi.fn(),
      }),
    },
  ),
}));

vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector) =>
    selector({
      fs: { exists: vi.fn() },
      projectPath: '/test/project',
    }),
  ),
}));

// isKeycloakConfigured — controlled per test
let keycloakConfigured = false;
vi.mock('@/core/auth/config', () => ({
  isKeycloakConfigured: () => keycloakConfigured,
}));

// AuthStatusSection — stub so we can check it renders/doesn't render
vi.mock('@/components/auth/AuthStatusSection', () => ({
  AuthStatusSection: () =>
    keycloakConfigured ? <div data-testid="auth-status-section" /> : null,
}));

// ContextMenu components
vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="context-menu">{children}</div>,
  ContextMenuTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    <div data-slot="context-menu-trigger" data-aschild={asChild}>{children}</div>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="context-menu-content">{children}</div>,
  ContextMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) =>
    <div data-testid="context-menu-item" onClick={onSelect}>{children}</div>,
}));

// Dialog components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    <div className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    <p data-testid="dialog-description">{children}</p>,
}));

describe('RegistryStatusDialog — auth integration', () => {
  beforeEach(() => {
    keycloakConfigured = false;
    authState = {
      isAuthenticated: false,
      username: null,
    };
    uiState = {
      showRegistryStatusDialog: true,
      closeRegistryStatusDialog: vi.fn(),
      notification: null,
      clearNotification: vi.fn(),
    };
    registryState = {
      builtinCount: 5,
      projectLocalCount: 0,
      projectLocalKeys: new Set<string>(),
      remoteInstalledCount: 0,
      remoteInstalledKeys: new Set<string>(),
      remoteInstalledVersions: new Map(),
      overrides: [],
      loadErrors: [],
      registry: null,
      lockfile: null,
    };
    vi.clearAllMocks();
  });

  it('AuthStatusSection renders null when env vars absent (keycloak not configured)', () => {
    keycloakConfigured = false;
    render(<RegistryStatusDialog />);
    expect(screen.queryByTestId('auth-status-section')).toBeNull();
  });

  it('AuthStatusSection renders when keycloak is configured', () => {
    keycloakConfigured = true;
    render(<RegistryStatusDialog />);
    expect(screen.getByTestId('auth-status-section')).toBeTruthy();
  });

  it('shows ContextMenu trigger on rows when authenticated and keycloak configured', () => {
    keycloakConfigured = true;
    authState.isAuthenticated = true;
    authState.username = 'alice';
    const key = 'acme/widget';
    registryState.projectLocalCount = 1;
    registryState.projectLocalKeys = new Set([key]);
    registryState.registry = {
      list: () => [
        {
          kind: 'NodeDef',
          apiVersion: 'v1',
          metadata: { name: 'widget', namespace: 'acme', version: '1.0.0', displayName: 'Widget', icon: 'box', shape: 'rectangle' },
          spec: {},
        },
      ],
    };
    render(<RegistryStatusDialog />);
    // ContextMenuTrigger should be present
    expect(screen.getAllByTestId('context-menu').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('generic', { hidden: true })
      .some(el => el.getAttribute('data-slot') === 'context-menu-trigger')).toBe(true);
  });

  it('shows plain div rows (no ContextMenu) when not authenticated', () => {
    keycloakConfigured = true;
    authState.isAuthenticated = false;
    const key = 'acme/widget';
    registryState.projectLocalCount = 1;
    registryState.projectLocalKeys = new Set([key]);
    registryState.registry = {
      list: () => [
        {
          kind: 'NodeDef',
          apiVersion: 'v1',
          metadata: { name: 'widget', namespace: 'acme', version: '1.0.0', displayName: 'Widget', icon: 'box', shape: 'rectangle' },
          spec: {},
        },
      ],
    };
    render(<RegistryStatusDialog />);
    expect(screen.queryByTestId('context-menu')).toBeNull();
  });

  it('shows plain div rows (no ContextMenu) when keycloak not configured even if authenticated', () => {
    keycloakConfigured = false;
    authState.isAuthenticated = true;
    authState.username = 'alice';
    const key = 'acme/widget';
    registryState.projectLocalCount = 1;
    registryState.projectLocalKeys = new Set([key]);
    registryState.registry = {
      list: () => [
        {
          kind: 'NodeDef',
          apiVersion: 'v1',
          metadata: { name: 'widget', namespace: 'acme', version: '1.0.0', displayName: 'Widget', icon: 'box', shape: 'rectangle' },
          spec: {},
        },
      ],
    };
    render(<RegistryStatusDialog />);
    expect(screen.queryByTestId('context-menu')).toBeNull();
  });

  it('renders notification banner when notification is set', () => {
    uiState.notification = { message: 'Published!', type: 'success' };
    render(<RegistryStatusDialog />);
    expect(screen.getByRole('status').textContent).toContain('Published!');
  });

  it('notification auto-clears after 4 seconds', () => {
    vi.useFakeTimers();
    const clearNotification = vi.fn();
    uiState.notification = { message: 'Done!', type: 'success' };
    uiState.clearNotification = clearNotification;
    render(<RegistryStatusDialog />);
    expect(clearNotification).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(clearNotification).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

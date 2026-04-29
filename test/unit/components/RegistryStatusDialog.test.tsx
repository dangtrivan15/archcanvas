import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegistryStatusDialog } from '@/components/RegistryStatusDialog';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  RefreshCw: ({ className }: { className?: string }) => <span data-testid="icon-refresh" className={className} />,
  AlertTriangle: ({ className }: { className?: string }) => <span data-testid="icon-alert" className={className} />,
  ArrowLeftRight: ({ className }: { className?: string }) => <span data-testid="icon-override" className={className} />,
  Layers: ({ className }: { className?: string }) => <span data-testid="icon-layers" className={className} />,
}));

// Store mocks
const mockClose = vi.fn();
const mockReloadProjectLocal = vi.fn();
const mockFs = { exists: vi.fn(), listFiles: vi.fn(), readFile: vi.fn() };

let uiState = {
  showRegistryStatusDialog: true,
  closeRegistryStatusDialog: mockClose,
};

let registryState: Record<string, unknown> = {
  builtinCount: 32,
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

vi.mock('@/store/uiStore', () => ({
  useUiStore: vi.fn((selector) => selector(uiState)),
}));

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

vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector) =>
    selector({
      fs: mockFs,
      projectPath: '/test/project',
    }),
  ),
}));

// Mock Dialog components to render without portal complexity
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

describe('RegistryStatusDialog', () => {
  beforeEach(() => {
    mockClose.mockClear();
    mockReloadProjectLocal.mockClear();
    uiState = {
      showRegistryStatusDialog: true,
      closeRegistryStatusDialog: mockClose,
    };
    registryState = {
      builtinCount: 32,
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
  });

  it('renders when open', () => {
    render(<RegistryStatusDialog />);
    expect(screen.getByTestId('dialog')).toBeTruthy();
    expect(screen.getByTestId('dialog-title').textContent).toBe('Node Type Registry');
  });

  it('does not render when closed', () => {
    uiState.showRegistryStatusDialog = false;
    render(<RegistryStatusDialog />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('shows correct builtin count in description', () => {
    render(<RegistryStatusDialog />);
    const desc = screen.getByTestId('dialog-description');
    expect(desc.textContent).toContain('32 built-in');
  });

  it('shows project-local count when present', () => {
    registryState.projectLocalCount = 5;
    render(<RegistryStatusDialog />);
    const desc = screen.getByTestId('dialog-description');
    expect(desc.textContent).toContain('5 project-local');
  });

  it('shows community count when present', () => {
    registryState.remoteInstalledCount = 3;
    render(<RegistryStatusDialog />);
    const desc = screen.getByTestId('dialog-description');
    expect(desc.textContent).toContain('3 community');
  });

  it('renders community badge when remoteInstalledCount > 0', () => {
    registryState.remoteInstalledCount = 2;
    render(<RegistryStatusDialog />);
    // The violet community badge should appear
    expect(screen.getByText('2 community')).toBeTruthy();
  });

  it('shows community-installed section when registry lists community defs', () => {
    const communityKey = 'acme/widget';
    registryState.remoteInstalledCount = 1;
    registryState.remoteInstalledKeys = new Set<string>([communityKey]);
    registryState.lockfile = {
      lockfileVersion: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      entries: {
        [communityKey]: { version: '1.2.3', source: 'remote' },
      },
    };
    registryState.registry = {
      list: () => [
        {
          kind: 'NodeDef',
          apiVersion: 'v1',
          metadata: {
            name: 'widget',
            namespace: 'acme',
            version: '1.2.3',
            displayName: 'Widget',
            description: 'A widget',
            icon: 'box',
            shape: 'rectangle',
          },
          spec: {},
        },
      ],
    };
    render(<RegistryStatusDialog />);
    expect(screen.getByText('Community-Installed (1)')).toBeTruthy();
    expect(screen.getByText('acme/widget')).toBeTruthy();
    expect(screen.getByText('v1.2.3')).toBeTruthy();
  });

  it('renders error section when loadErrors is non-empty', () => {
    registryState.loadErrors = [{ file: 'bad.yaml', message: 'invalid format' }];
    render(<RegistryStatusDialog />);
    expect(screen.getByText('Validation Errors')).toBeTruthy();
    expect(screen.getByText('bad.yaml')).toBeTruthy();
    expect(screen.getByText('invalid format')).toBeTruthy();
  });

  it('reload button calls reloadProjectLocal', () => {
    render(<RegistryStatusDialog />);
    const btn = screen.getByTestId('registry-reload-btn');
    fireEvent.click(btn);
    expect(mockReloadProjectLocal).toHaveBeenCalledWith(mockFs, '/test/project');
  });
});

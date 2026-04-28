import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { InstallNodeDefDialog } from '@/components/InstallNodeDefDialog';
import type { RemoteNodeDefSummary } from '@/core/registry/remoteRegistry';

// ---------------------------------------------------------------------------
// Store mocks
// ---------------------------------------------------------------------------

const mockClose = vi.fn();
const mockInstallRemoteNodeDef = vi.fn();
const mockFs = {};

const aSummary: RemoteNodeDefSummary = {
  namespace: 'acme',
  name: 'widget',
  version: '1.2.3',
  displayName: 'Widget',
  description: 'A reusable widget component.',
};

let uiState = {
  showInstallNodeDefDialog: true,
  pendingInstall: aSummary as RemoteNodeDefSummary | null,
  closeInstallNodeDefDialog: mockClose,
};

let fileState = {
  fs: mockFs as object | null,
  projectPath: '/test/project',
};

vi.mock('@/store/uiStore', () => ({
  useUiStore: vi.fn((selector: (s: typeof uiState) => unknown) => selector(uiState)),
}));

vi.mock('@/store/registryStore', () => ({
  useRegistryStore: Object.assign(
    vi.fn(),
    {
      getState: () => ({
        installRemoteNodeDef: mockInstallRemoteNodeDef,
      }),
    },
  ),
}));

vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector: (s: typeof fileState) => unknown) => selector(fileState)),
}));

// ---------------------------------------------------------------------------
// Mock Radix / shadcn Dialog components to avoid portal/animation complexity
// ---------------------------------------------------------------------------
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children, onOpenChange }: { open: boolean; children: React.ReactNode; onOpenChange?: (v: boolean) => void }) =>
    open ? <div data-testid="dialog" onKeyDown={(e) => e.key === 'Escape' && onOpenChange?.(false)}>{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    <div className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers to reassign reactive mocks
// ---------------------------------------------------------------------------

function setUiState(patch: Partial<typeof uiState>) {
  uiState = { ...uiState, ...patch };
}

function setFileState(patch: Partial<typeof fileState>) {
  fileState = { ...fileState, ...patch };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InstallNodeDefDialog', () => {
  beforeEach(() => {
    mockClose.mockClear();
    mockInstallRemoteNodeDef.mockReset();
    uiState = {
      showInstallNodeDefDialog: true,
      pendingInstall: aSummary,
      closeInstallNodeDefDialog: mockClose,
    };
    fileState = {
      fs: mockFs,
      projectPath: '/test/project',
    };
  });

  // ----- Open / close rendering -----

  it('renders when open is true', () => {
    render(<InstallNodeDefDialog />);
    expect(screen.getByTestId('dialog')).toBeTruthy();
    expect(screen.getByTestId('dialog-title').textContent).toBe('Install Community NodeDef');
  });

  it('does not render when open is false', () => {
    setUiState({ showInstallNodeDefDialog: false });
    render(<InstallNodeDefDialog />);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  // ----- Summary display -----

  it('displays namespace, name, version from summary', () => {
    render(<InstallNodeDefDialog />);
    expect(screen.getByText('acme/widget')).toBeTruthy();
    expect(screen.getByText('v1.2.3')).toBeTruthy();
  });

  it('displays displayName and description when present', () => {
    render(<InstallNodeDefDialog />);
    expect(screen.getByText('Widget')).toBeTruthy();
    expect(screen.getByText('A reusable widget component.')).toBeTruthy();
  });

  it('keeps summary visible during close animation (ref persists after pendingInstall → null)', () => {
    const { rerender } = render(<InstallNodeDefDialog />);
    // Dialog is still open but pendingInstall has been cleared (simulates mid-animation state)
    setUiState({ pendingInstall: null });
    rerender(<InstallNodeDefDialog />);
    // displaySummary should be the last non-null summary (from summaryRef.current)
    expect(screen.getByText('acme/widget')).toBeTruthy();
  });

  // ----- Confirm — success path -----

  it('calls installRemoteNodeDef with correct args on confirm', async () => {
    mockInstallRemoteNodeDef.mockResolvedValue(undefined);
    render(<InstallNodeDefDialog />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('install-nodedef-confirm'));
    });

    expect(mockInstallRemoteNodeDef).toHaveBeenCalledWith(mockFs, '/test/project', aSummary);
  });

  it('calls close after successful install', async () => {
    mockInstallRemoteNodeDef.mockResolvedValue(undefined);
    render(<InstallNodeDefDialog />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('install-nodedef-confirm'));
    });

    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('shows "Installing…" while install is in progress', async () => {
    let resolveInstall!: () => void;
    mockInstallRemoteNodeDef.mockReturnValue(new Promise<void>((r) => { resolveInstall = r; }));
    render(<InstallNodeDefDialog />);

    act(() => { fireEvent.click(screen.getByTestId('install-nodedef-confirm')); });

    expect(screen.getByTestId('install-nodedef-confirm').textContent).toBe('Installing…');

    // Resolve to avoid state-update-after-unmount warnings
    await act(async () => { resolveInstall(); });
  });

  // ----- Confirm — failure path -----

  it('shows error message when install fails', async () => {
    mockInstallRemoteNodeDef.mockRejectedValue(new Error('Network error'));
    render(<InstallNodeDefDialog />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('install-nodedef-confirm'));
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Network error');
  });

  it('resets installing to false after failed install', async () => {
    mockInstallRemoteNodeDef.mockRejectedValue(new Error('boom'));
    render(<InstallNodeDefDialog />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('install-nodedef-confirm'));
    });

    // Button should be back to "Install" (not "Installing…")
    expect(screen.getByTestId('install-nodedef-confirm').textContent).toBe('Install');
  });

  it('does not close on failure', async () => {
    mockInstallRemoteNodeDef.mockRejectedValue(new Error('boom'));
    render(<InstallNodeDefDialog />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('install-nodedef-confirm'));
    });

    expect(mockClose).not.toHaveBeenCalled();
  });

  // ----- Stale-error reset on reopen -----

  it('resets stale error when dialog reopens', async () => {
    mockInstallRemoteNodeDef.mockRejectedValue(new Error('old error'));
    const { rerender } = render(<InstallNodeDefDialog />);

    // Trigger failure
    await act(async () => {
      fireEvent.click(screen.getByTestId('install-nodedef-confirm'));
    });
    expect(screen.getByRole('alert').textContent).toBe('old error');

    // Simulate dialog close then reopen
    setUiState({ showInstallNodeDefDialog: false });
    rerender(<InstallNodeDefDialog />);

    setUiState({ showInstallNodeDefDialog: true });
    await act(async () => {
      rerender(<InstallNodeDefDialog />);
    });

    // Error should be gone
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // ----- Disabled states -----

  it('disables confirm button when fs is null', () => {
    setFileState({ fs: null });
    render(<InstallNodeDefDialog />);
    const btn = screen.getByTestId('install-nodedef-confirm') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

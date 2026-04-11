import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFileStore, setFilePicker } from '@/store/fileStore';
import { ProjectGate } from '@/components/layout/ProjectGate';
import { getLastActiveProject } from '@/core/lastActiveProject';

// Mock lastActiveProject so it doesn't interfere with existing tests
vi.mock('@/core/lastActiveProject', () => ({
  getLastActiveProject: vi.fn(() => null),
}));

const mockGetLastActiveProject = vi.mocked(getLastActiveProject);

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
    fs: null,
    recentProjects: [],
  });
  setFilePicker(null);
  // Reset Tauri detection
  delete (window as any).__TAURI_INTERNALS__;
});

afterEach(() => {
  delete (window as any).__TAURI_INTERNALS__;
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ProjectGate', () => {
  it('renders heading and description', () => {
    render(<ProjectGate />);
    expect(screen.getByText('ArchCanvas')).toBeInTheDocument();
    expect(
      screen.getByText(/open a project folder to get started/i),
    ).toBeInTheDocument();
  });

  it('renders Open… button with keyboard hint', () => {
    render(<ProjectGate />);
    const openBtn = screen.getByRole('button', { name: /open…/i });
    expect(openBtn).toBeInTheDocument();
    expect(openBtn.textContent).toContain('\u2318');
    expect(openBtn.textContent).toContain('O');
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('shows error banner when status is error', () => {
    useFileStore.setState({ status: 'error', error: 'File not found: .archcanvas/main.yaml' });

    render(<ProjectGate />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Failed to load project');
    expect(alert).toHaveTextContent('File not found: .archcanvas/main.yaml');
  });

  it('does not show error banner when status is idle', () => {
    render(<ProjectGate />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows loading indicator when status is loading', () => {
    useFileStore.setState({ status: 'loading' });

    render(<ProjectGate />);
    expect(screen.getByText(/loading project/i)).toBeInTheDocument();
  });

  it('disables button when loading', () => {
    useFileStore.setState({ status: 'loading' });

    render(<ProjectGate />);
    expect(screen.getByRole('button', { name: /open…/i })).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Button clicks
  // -------------------------------------------------------------------------

  it('calls fileStore.open() when Open… is clicked', () => {
    const openSpy = vi.fn();
    useFileStore.setState({ open: openSpy } as any);

    render(<ProjectGate />);
    fireEvent.click(screen.getByRole('button', { name: /open…/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Last active project restore
  // -------------------------------------------------------------------------

  it('does not attempt last-active restore when not in Tauri', () => {
    mockGetLastActiveProject.mockReturnValue('/some/path');

    // No __TAURI_INTERNALS__ → should not trigger restore
    render(<ProjectGate />);

    // Should still show the gate UI (not loading)
    expect(screen.getByText('ArchCanvas')).toBeInTheDocument();
  });

  it('does not attempt last-active restore when getLastActiveProject returns null', () => {
    mockGetLastActiveProject.mockReturnValue(null);

    // Even with Tauri present, null path means no restore
    (window as any).__TAURI_INTERNALS__ = {};
    render(<ProjectGate />);

    expect(screen.getByText('ArchCanvas')).toBeInTheDocument();
  });
});

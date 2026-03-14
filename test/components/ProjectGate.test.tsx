import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFileStore, setFilePicker } from '@/store/fileStore';
import { ProjectGate } from '@/components/layout/ProjectGate';
import type { FilePicker } from '@/platform/filePicker';

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
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ProjectGate', () => {
  it('renders heading and description', () => {
    render(<ProjectGate />);
    expect(screen.getByText('ArchCanvas')).toBeInTheDocument();
    expect(
      screen.getByText(/open an existing project or create a new one/i),
    ).toBeInTheDocument();
  });

  it('renders Open Project button with keyboard hint', () => {
    render(<ProjectGate />);
    const openBtn = screen.getByRole('button', { name: /open project/i });
    expect(openBtn).toBeInTheDocument();
    // Keyboard hint
    expect(openBtn.textContent).toContain('\u2318');
    expect(openBtn.textContent).toContain('O');
  });

  it('renders New Project button', () => {
    render(<ProjectGate />);
    expect(
      screen.getByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
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

  it('disables buttons when loading', () => {
    useFileStore.setState({ status: 'loading' });

    render(<ProjectGate />);
    expect(screen.getByRole('button', { name: /open project/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /new project/i })).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Button clicks
  // -------------------------------------------------------------------------

  it('calls fileStore.open() when Open Project is clicked', () => {
    const openSpy = vi.fn();
    useFileStore.setState({ open: openSpy } as any);

    render(<ProjectGate />);
    fireEvent.click(screen.getByRole('button', { name: /open project/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('calls fileStore.newProject() when New Project is clicked', () => {
    const newProjectSpy = vi.fn();
    useFileStore.setState({ newProject: newProjectSpy } as any);

    render(<ProjectGate />);
    fireEvent.click(screen.getByRole('button', { name: /new project/i }));

    expect(newProjectSpy).toHaveBeenCalledTimes(1);
  });
});

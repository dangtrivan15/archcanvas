/**
 * Chat toggle integration tests
 *
 * Tests the UI integration of the chat panel toggle mechanism:
 * - uiStore toggleChat state management
 * - Keyboard shortcut (Cmd+Shift+I)
 * - Custom event listener (archcanvas:toggle-chat)
 * - LeftToolbar AI Chat button highlight
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useUiStore, _resetPanelRefs } from '@/store/uiStore';
import { useAppKeyboard } from '@/components/hooks/useAppKeyboard';
import type { PanelImperativeHandle } from 'react-resizable-panels';

// ---------------------------------------------------------------------------
// Mocks (must be before imports that use them, but vi.mock is hoisted)
// ---------------------------------------------------------------------------

// Mock fileStore used by useAppKeyboard
vi.mock('@/store/fileStore', () => ({
  useFileStore: Object.assign(vi.fn((sel: any) => sel({
    save: vi.fn(),
    open: vi.fn(),
  })), {
    getState: () => ({ save: vi.fn(), open: vi.fn() }),
  }),
}));

// Mock the stores that LeftToolbar depends on
vi.mock('@/store/historyStore', () => ({
  useHistoryStore: Object.assign(vi.fn((sel: any) => sel({ undo: vi.fn(), redo: vi.fn() })), {
    getState: () => ({ undo: vi.fn(), redo: vi.fn() }),
  }),
}));

vi.mock('@/store/toolStore', () => ({
  useToolStore: Object.assign(vi.fn((sel: any) => sel({ mode: 'select' })), {
    getState: () => ({ setMode: vi.fn() }),
  }),
}));

// Mock tooltip components to simplify rendering
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode; side?: string }) => <span>{children}</span>,
}));

// Mock ScrollArea
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockPanelRef(collapsed = false): PanelImperativeHandle {
  let _collapsed = collapsed;
  return {
    collapse: () => { _collapsed = true; },
    expand: () => { _collapsed = false; },
    getSize: () => ({ asPercentage: _collapsed ? 0 : 20, inPixels: _collapsed ? 0 : 300 }),
    isCollapsed: () => _collapsed,
    resize: (_size: number | string) => {},
  };
}

/** Wrapper component that activates the useAppKeyboard hook */
function KeyboardHarness() {
  useAppKeyboard();
  return <div data-testid="keyboard-harness" />;
}

// ---------------------------------------------------------------------------
// Store-level tests
// ---------------------------------------------------------------------------

describe('uiStore — chat toggle', () => {
  beforeEach(() => {
    useUiStore.setState({ rightPanelMode: 'details' });
    _resetPanelRefs();
  });

  it('defaults to details mode', () => {
    expect(useUiStore.getState().rightPanelMode).toBe('details');
  });

  it('toggleChat switches from details to chat', () => {
    useUiStore.getState().toggleChat();
    expect(useUiStore.getState().rightPanelMode).toBe('chat');
  });

  it('toggleChat switches from chat back to details', () => {
    useUiStore.setState({ rightPanelMode: 'chat' });
    useUiStore.getState().toggleChat();
    expect(useUiStore.getState().rightPanelMode).toBe('details');
  });

  it('toggleChat expands collapsed right panel when opening chat', () => {
    const ref = mockPanelRef(true);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().toggleChat();
    expect(ref.isCollapsed()).toBe(false);
    expect(useUiStore.getState().rightPanelMode).toBe('chat');
  });

  it('toggleChat does not collapse panel when closing chat', () => {
    const ref = mockPanelRef(false);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.setState({ rightPanelMode: 'chat' });
    useUiStore.getState().toggleChat();
    expect(useUiStore.getState().rightPanelMode).toBe('details');
    // Panel stays expanded — user might want to see details
    expect(ref.isCollapsed()).toBe(false);
  });

  it('setRightPanelMode sets mode directly', () => {
    useUiStore.getState().setRightPanelMode('chat');
    expect(useUiStore.getState().rightPanelMode).toBe('chat');
    useUiStore.getState().setRightPanelMode('details');
    expect(useUiStore.getState().rightPanelMode).toBe('details');
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcut tests (useAppKeyboard)
// ---------------------------------------------------------------------------

describe('useAppKeyboard — Cmd+Shift+I', () => {
  beforeEach(() => {
    useUiStore.setState({ rightPanelMode: 'details' });
    _resetPanelRefs();
  });

  it('Cmd+Shift+I toggles chat on', () => {
    const { unmount } = render(<KeyboardHarness />);

    act(() => {
      fireEvent.keyDown(window, {
        key: 'I',
        code: 'KeyI',
        metaKey: true,
        shiftKey: true,
      });
    });

    expect(useUiStore.getState().rightPanelMode).toBe('chat');
    unmount();
  });

  it('Cmd+Shift+I toggles chat off when already open', () => {
    useUiStore.setState({ rightPanelMode: 'chat' });
    const { unmount } = render(<KeyboardHarness />);

    act(() => {
      fireEvent.keyDown(window, {
        key: 'I',
        code: 'KeyI',
        metaKey: true,
        shiftKey: true,
      });
    });

    expect(useUiStore.getState().rightPanelMode).toBe('details');
    unmount();
  });
});

// ---------------------------------------------------------------------------
// Custom event tests (archcanvas:toggle-chat)
// ---------------------------------------------------------------------------

describe('archcanvas:toggle-chat custom event', () => {
  beforeEach(() => {
    useUiStore.setState({ rightPanelMode: 'details' });
    _resetPanelRefs();
  });

  it('dispatching archcanvas:toggle-chat toggles chat mode', () => {
    const { unmount } = render(<KeyboardHarness />);

    act(() => {
      window.dispatchEvent(new CustomEvent('archcanvas:toggle-chat'));
    });

    expect(useUiStore.getState().rightPanelMode).toBe('chat');

    act(() => {
      window.dispatchEvent(new CustomEvent('archcanvas:toggle-chat'));
    });

    expect(useUiStore.getState().rightPanelMode).toBe('details');
    unmount();
  });
});

// ---------------------------------------------------------------------------
// LeftToolbar AI Chat button tests
// ---------------------------------------------------------------------------

describe('LeftToolbar — AI Chat button', () => {
  beforeEach(() => {
    useUiStore.setState({ rightPanelMode: 'details' });
  });

  it('renders the AI Chat button', async () => {
    const { LeftToolbar } = await import('@/components/layout/LeftToolbar');
    render(<LeftToolbar />);
    expect(screen.getByLabelText(/AI Chat/)).toBeInTheDocument();
  });

  it('AI Chat button has active styling when chat mode is active', async () => {
    useUiStore.setState({ rightPanelMode: 'chat' });
    const { LeftToolbar } = await import('@/components/layout/LeftToolbar');
    render(<LeftToolbar />);

    const button = screen.getByLabelText(/AI Chat/);
    expect(button.className).toContain('bg-accent');
    expect(button.className).toContain('text-accent-foreground');
  });

  it('AI Chat button does not have active styling when in details mode', async () => {
    useUiStore.setState({ rightPanelMode: 'details' });
    const { LeftToolbar } = await import('@/components/layout/LeftToolbar');
    render(<LeftToolbar />);

    const button = screen.getByLabelText(/AI Chat/);
    expect(button.className).toContain('text-muted-foreground');
  });

  it('clicking AI Chat button calls toggleChat', async () => {
    const { LeftToolbar } = await import('@/components/layout/LeftToolbar');
    render(<LeftToolbar />);

    const button = screen.getByLabelText(/AI Chat/);
    fireEvent.click(button);
    expect(useUiStore.getState().rightPanelMode).toBe('chat');
  });
});

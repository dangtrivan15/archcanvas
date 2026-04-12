import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useAppKeyboard } from '@/components/hooks/useAppKeyboard';
import { useUiStore, _resetPanelRefs } from '@/store/uiStore';

/**
 * Dispatch a synthetic keyboard event on the window.
 * `key` is the KeyboardEvent.key value. Modifiers are flags.
 */
function press(key: string, opts: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
}

describe('useAppKeyboard — panel shortcuts', () => {
  beforeEach(() => {
    _resetPanelRefs();
    useUiStore.setState({
      rightPanelCollapsed: false,
      leftPanelCollapsed: false,
      showStatusBar: true,
      focusMode: false,
      preFocusPanelState: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // Helper: render the hook so it registers event listeners
  function renderKeyboard() {
    return renderHook(() => useAppKeyboard());
  }

  it('Cmd+B calls toggleLeftPanel', () => {
    renderKeyboard();
    const spy = vi.fn();
    const original = useUiStore.getState().toggleLeftPanel;
    useUiStore.setState({ toggleLeftPanel: spy });

    press('b', { metaKey: true });
    expect(spy).toHaveBeenCalledTimes(1);

    useUiStore.setState({ toggleLeftPanel: original });
  });

  it('Cmd+B in contentEditable does NOT call toggleLeftPanel', () => {
    renderKeyboard();
    const spy = vi.fn();
    const original = useUiStore.getState().toggleLeftPanel;
    useUiStore.setState({ toggleLeftPanel: spy });

    // Create and focus a contentEditable element
    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    div.focus();

    press('b', { metaKey: true });
    expect(spy).not.toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(div);
    useUiStore.setState({ toggleLeftPanel: original });
  });

  it('Cmd+Shift+B calls toggleRightPanel', () => {
    renderKeyboard();
    const spy = vi.fn();
    const original = useUiStore.getState().toggleRightPanel;
    useUiStore.setState({ toggleRightPanel: spy });

    press('B', { metaKey: true, shiftKey: true });
    expect(spy).toHaveBeenCalledTimes(1);

    useUiStore.setState({ toggleRightPanel: original });
  });

  it('Cmd+J calls toggleStatusBar', () => {
    renderKeyboard();
    const spy = vi.fn();
    const original = useUiStore.getState().toggleStatusBar;
    useUiStore.setState({ toggleStatusBar: spy });

    press('j', { metaKey: true });
    expect(spy).toHaveBeenCalledTimes(1);

    useUiStore.setState({ toggleStatusBar: original });
  });

  it('Cmd+Shift+F calls toggleFocusMode', () => {
    renderKeyboard();
    const spy = vi.fn();
    const original = useUiStore.getState().toggleFocusMode;
    useUiStore.setState({ toggleFocusMode: spy });

    press('F', { metaKey: true, shiftKey: true });
    expect(spy).toHaveBeenCalledTimes(1);

    useUiStore.setState({ toggleFocusMode: original });
  });

  it('Ctrl+Shift+= calls resizeRightPanelByPercent(5)', () => {
    renderKeyboard();
    const spy = vi.fn();
    const original = useUiStore.getState().resizeRightPanelByPercent;
    useUiStore.setState({ resizeRightPanelByPercent: spy });

    press('=', { ctrlKey: true, shiftKey: true });
    expect(spy).toHaveBeenCalledWith(5);

    useUiStore.setState({ resizeRightPanelByPercent: original });
  });

  it('Ctrl+Shift++ (plus key) calls resizeRightPanelByPercent(5)', () => {
    renderKeyboard();
    const spy = vi.fn();
    const original = useUiStore.getState().resizeRightPanelByPercent;
    useUiStore.setState({ resizeRightPanelByPercent: spy });

    press('+', { ctrlKey: true, shiftKey: true });
    expect(spy).toHaveBeenCalledWith(5);

    useUiStore.setState({ resizeRightPanelByPercent: original });
  });

  it('Ctrl+Shift+- calls resizeRightPanelByPercent(-5)', () => {
    renderKeyboard();
    const spy = vi.fn();
    const original = useUiStore.getState().resizeRightPanelByPercent;
    useUiStore.setState({ resizeRightPanelByPercent: spy });

    press('-', { ctrlKey: true, shiftKey: true });
    expect(spy).toHaveBeenCalledWith(-5);

    useUiStore.setState({ resizeRightPanelByPercent: original });
  });
});

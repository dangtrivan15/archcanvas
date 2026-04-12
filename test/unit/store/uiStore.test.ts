import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore, _resetPanelRefs } from '@/store/uiStore';
import type { PanelImperativeHandle } from 'react-resizable-panels';

/** Wrap a mock PanelImperativeHandle in a RefObject (matching how App.tsx passes refs). */
function mockPanelRef(collapsed = false, sizePct = 20): { current: PanelImperativeHandle & { _lastResizeArg?: string | number } } {
  let _collapsed = collapsed;
  let _lastResizeArg: string | number | undefined;
  return {
    current: {
      collapse: () => { _collapsed = true; },
      expand: () => { _collapsed = false; },
      getSize: () => ({ asPercentage: _collapsed ? 0 : sizePct, inPixels: _collapsed ? 0 : 300 }),
      isCollapsed: () => _collapsed,
      resize: (size: number | string) => { _lastResizeArg = size; },
      get _lastResizeArg() { return _lastResizeArg; },
    } as PanelImperativeHandle & { _lastResizeArg?: string | number },
  };
}

describe('uiStore', () => {
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

  it('toggleLeftPanel collapses an expanded panel', () => {
    const ref = mockPanelRef(false);
    useUiStore.getState().setLeftPanelRef(ref);
    useUiStore.getState().toggleLeftPanel();
    expect(ref.current.isCollapsed()).toBe(true);
  });

  it('toggleLeftPanel expands a collapsed panel', () => {
    const ref = mockPanelRef(true);
    useUiStore.getState().setLeftPanelRef(ref);
    useUiStore.getState().toggleLeftPanel();
    expect(ref.current.isCollapsed()).toBe(false);
  });

  it('toggleRightPanel collapses an expanded panel', () => {
    const ref = mockPanelRef(false);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().toggleRightPanel();
    expect(ref.current.isCollapsed()).toBe(true);
  });

  it('toggleRightPanel expands a collapsed panel', () => {
    const ref = mockPanelRef(true);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().toggleRightPanel();
    expect(ref.current.isCollapsed()).toBe(false);
  });

  it('openRightPanel expands a collapsed panel', () => {
    const ref = mockPanelRef(true);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().openRightPanel();
    expect(ref.current.isCollapsed()).toBe(false);
  });

  it('openRightPanel is a no-op if already expanded', () => {
    const ref = mockPanelRef(false);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().openRightPanel();
    expect(ref.current.isCollapsed()).toBe(false);
  });

  it('setRightPanelMode accepts entities mode', () => {
    useUiStore.getState().setRightPanelMode('entities');
    expect(useUiStore.getState().rightPanelMode).toBe('entities');
  });

  it('toggle methods are safe to call before refs are set', () => {
    useUiStore.getState().toggleLeftPanel();
    useUiStore.getState().toggleRightPanel();
    useUiStore.getState().openRightPanel();
  });

  // --- rightPanelCollapsed ---

  it('rightPanelCollapsed defaults to false', () => {
    expect(useUiStore.getState().rightPanelCollapsed).toBe(false);
  });

  it('toggleRightPanel sets rightPanelCollapsed to true when collapsing', () => {
    const ref = mockPanelRef(false);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().toggleRightPanel();
    expect(useUiStore.getState().rightPanelCollapsed).toBe(true);
  });

  it('toggleRightPanel sets rightPanelCollapsed to false when expanding', () => {
    const ref = mockPanelRef(true);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().toggleRightPanel();
    expect(useUiStore.getState().rightPanelCollapsed).toBe(false);
  });

  // --- detailPanelTab ---

  it('setDetailPanelTab sets the tab', () => {
    useUiStore.getState().setDetailPanelTab('notes');
    expect(useUiStore.getState().detailPanelTab).toBe('notes');
  });

  it('setDetailPanelTab null resets', () => {
    useUiStore.getState().setDetailPanelTab('notes');
    useUiStore.getState().setDetailPanelTab(null);
    expect(useUiStore.getState().detailPanelTab).toBeNull();
  });

  // --- leftPanelCollapsed ---

  it('toggleLeftPanel updates leftPanelCollapsed to true when collapsing', () => {
    const ref = mockPanelRef(false);
    useUiStore.getState().setLeftPanelRef(ref);
    useUiStore.getState().toggleLeftPanel();
    expect(useUiStore.getState().leftPanelCollapsed).toBe(true);
  });

  it('toggleLeftPanel updates leftPanelCollapsed to false when expanding', () => {
    const ref = mockPanelRef(true);
    useUiStore.getState().setLeftPanelRef(ref);
    useUiStore.getState().toggleLeftPanel();
    expect(useUiStore.getState().leftPanelCollapsed).toBe(false);
  });

  // --- toggleStatusBar ---

  it('toggleStatusBar toggles showStatusBar from true to false', () => {
    expect(useUiStore.getState().showStatusBar).toBe(true);
    useUiStore.getState().toggleStatusBar();
    expect(useUiStore.getState().showStatusBar).toBe(false);
  });

  it('toggleStatusBar toggles showStatusBar from false to true', () => {
    useUiStore.setState({ showStatusBar: false });
    useUiStore.getState().toggleStatusBar();
    expect(useUiStore.getState().showStatusBar).toBe(true);
  });

  // --- toggleFocusMode ---

  it('toggleFocusMode entering: captures snapshot, collapses both panels, sets focusMode', () => {
    const leftRef = mockPanelRef(false);
    const rightRef = mockPanelRef(false);
    useUiStore.getState().setLeftPanelRef(leftRef);
    useUiStore.getState().setRightPanelRef(rightRef);

    useUiStore.getState().toggleFocusMode();

    expect(useUiStore.getState().focusMode).toBe(true);
    expect(useUiStore.getState().preFocusPanelState).toEqual({
      leftWasCollapsed: false,
      rightWasCollapsed: false,
    });
    expect(leftRef.current.isCollapsed()).toBe(true);
    expect(rightRef.current.isCollapsed()).toBe(true);
    expect(useUiStore.getState().leftPanelCollapsed).toBe(true);
    expect(useUiStore.getState().rightPanelCollapsed).toBe(true);
  });

  it('toggleFocusMode exiting: restores snapshot, clears focusMode', () => {
    const leftRef = mockPanelRef(false);
    const rightRef = mockPanelRef(false);
    useUiStore.getState().setLeftPanelRef(leftRef);
    useUiStore.getState().setRightPanelRef(rightRef);

    // Enter focus mode
    useUiStore.getState().toggleFocusMode();
    expect(useUiStore.getState().focusMode).toBe(true);

    // Exit focus mode
    useUiStore.getState().toggleFocusMode();
    expect(useUiStore.getState().focusMode).toBe(false);
    expect(useUiStore.getState().preFocusPanelState).toBeNull();
    // Panels should be restored to expanded
    expect(leftRef.current.isCollapsed()).toBe(false);
    expect(rightRef.current.isCollapsed()).toBe(false);
  });

  it('toggleFocusMode is safe to call before refs are set', () => {
    // Should not throw
    useUiStore.getState().toggleFocusMode();
    expect(useUiStore.getState().focusMode).toBe(true);
  });

  it('toggleFocusMode entering when panels already collapsed: snapshot records collapsed', () => {
    const leftRef = mockPanelRef(true);
    const rightRef = mockPanelRef(true);
    useUiStore.getState().setLeftPanelRef(leftRef);
    useUiStore.getState().setRightPanelRef(rightRef);

    useUiStore.getState().toggleFocusMode();

    expect(useUiStore.getState().preFocusPanelState).toEqual({
      leftWasCollapsed: true,
      rightWasCollapsed: true,
    });
    // Panels remain collapsed (not double-collapsed)
    expect(leftRef.current.isCollapsed()).toBe(true);
    expect(rightRef.current.isCollapsed()).toBe(true);
  });

  it('toggleFocusMode exiting restores mixed state', () => {
    const leftRef = mockPanelRef(true);   // left was collapsed
    const rightRef = mockPanelRef(false);  // right was expanded
    useUiStore.getState().setLeftPanelRef(leftRef);
    useUiStore.getState().setRightPanelRef(rightRef);

    // Enter & exit focus mode
    useUiStore.getState().toggleFocusMode();
    useUiStore.getState().toggleFocusMode();

    expect(leftRef.current.isCollapsed()).toBe(true);   // restored to collapsed
    expect(rightRef.current.isCollapsed()).toBe(false);  // restored to expanded
  });

  // --- resizeRightPanelByPercent ---

  it('resizeRightPanelByPercent(5) calls resize with current + 5', () => {
    const ref = mockPanelRef(false, 20);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().resizeRightPanelByPercent(5);
    expect(ref.current._lastResizeArg).toBe('25%');
  });

  it('resizeRightPanelByPercent(-5) calls resize with current - 5', () => {
    const ref = mockPanelRef(false, 20);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().resizeRightPanelByPercent(-5);
    expect(ref.current._lastResizeArg).toBe('15%');
  });

  it('resizeRightPanelByPercent expands collapsed panel before resizing', () => {
    const ref = mockPanelRef(true, 20);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().resizeRightPanelByPercent(5);
    expect(ref.current.isCollapsed()).toBe(false);
    expect(useUiStore.getState().rightPanelCollapsed).toBe(false);
  });

  it('resizeRightPanelByPercent clamps to min 5%', () => {
    const ref = mockPanelRef(false, 7);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().resizeRightPanelByPercent(-5);
    expect(ref.current._lastResizeArg).toBe('5%');
  });

  it('resizeRightPanelByPercent clamps to max 40%', () => {
    const ref = mockPanelRef(false, 38);
    useUiStore.getState().setRightPanelRef(ref);
    useUiStore.getState().resizeRightPanelByPercent(5);
    expect(ref.current._lastResizeArg).toBe('40%');
  });

  it('resizeRightPanelByPercent is safe to call before ref is set', () => {
    // Should not throw
    useUiStore.getState().resizeRightPanelByPercent(5);
  });
});

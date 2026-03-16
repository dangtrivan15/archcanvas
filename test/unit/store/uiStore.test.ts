import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore, _resetPanelRefs } from '@/store/uiStore';
import type { PanelImperativeHandle } from 'react-resizable-panels';

/** Wrap a mock PanelImperativeHandle in a RefObject (matching how App.tsx passes refs). */
function mockPanelRef(collapsed = false): { current: PanelImperativeHandle } {
  let _collapsed = collapsed;
  return {
    current: {
      collapse: () => { _collapsed = true; },
      expand: () => { _collapsed = false; },
      getSize: () => ({ asPercentage: _collapsed ? 0 : 20, inPixels: _collapsed ? 0 : 300 }),
      isCollapsed: () => _collapsed,
      resize: (_size: number | string) => {},
    },
  };
}

describe('uiStore', () => {
  beforeEach(() => {
    _resetPanelRefs();
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
});

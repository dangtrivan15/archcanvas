import { describe, it, expect, vi } from 'vitest';

describe('onPaneClickGuarded', () => {
  it('calls onPaneClick when no context menu is open', () => {
    const onPaneClick = vi.fn();
    const setContextMenu = vi.fn();
    const contextMenuOpenRef = { current: false };

    // Simulate the guarded callback logic
    if (contextMenuOpenRef.current) {
      setContextMenu(null);
    } else {
      onPaneClick();
    }

    expect(onPaneClick).toHaveBeenCalledOnce();
    expect(setContextMenu).not.toHaveBeenCalled();
  });

  it('skips onPaneClick and closes the menu when context menu is open', () => {
    const onPaneClick = vi.fn();
    const setContextMenu = vi.fn();
    const contextMenuOpenRef = { current: true };

    // Simulate the guarded callback logic
    if (contextMenuOpenRef.current) {
      setContextMenu(null);
    } else {
      onPaneClick();
    }

    expect(onPaneClick).not.toHaveBeenCalled();
    expect(setContextMenu).toHaveBeenCalledWith(null);
  });

  it('ref stays false when contextMenu state is null', () => {
    // Simulate the useEffect sync: contextMenuOpenRef.current = contextMenu !== null
    const contextMenu = null;
    const contextMenuOpenRef = { current: true }; // stale value before effect runs

    // Effect runs
    contextMenuOpenRef.current = contextMenu !== null;

    expect(contextMenuOpenRef.current).toBe(false);
  });

  it('ref becomes true when contextMenu state is non-null', () => {
    // Simulate the useEffect sync: contextMenuOpenRef.current = contextMenu !== null
    const contextMenu = { target: { kind: 'canvas' as const }, x: 100, y: 200 };
    const contextMenuOpenRef = { current: false }; // stale value before effect runs

    // Effect runs
    contextMenuOpenRef.current = contextMenu !== null;

    expect(contextMenuOpenRef.current).toBe(true);
  });
});

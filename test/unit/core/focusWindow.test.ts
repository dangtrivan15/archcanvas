import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { focusCurrentWindow } from '@/core/focusWindow';

// Mock the Tauri window API — not available in the test environment
const mockSetFocus = vi.fn();
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ setFocus: mockSetFocus }),
}));

describe('focusCurrentWindow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
  });

  it('is a no-op when not in Tauri environment', async () => {
    // No __TAURI_INTERNALS__ → should not call setFocus
    delete (window as any).__TAURI_INTERNALS__;
    await focusCurrentWindow();
    expect(mockSetFocus).not.toHaveBeenCalled();
  });

  it('calls setFocus on the current window in Tauri', async () => {
    (window as any).__TAURI_INTERNALS__ = {};
    mockSetFocus.mockResolvedValue(undefined);

    await focusCurrentWindow();

    expect(mockSetFocus).toHaveBeenCalledTimes(1);
  });

  it('silently swallows errors from setFocus', async () => {
    (window as any).__TAURI_INTERNALS__ = {};
    mockSetFocus.mockRejectedValue(new Error('OS denied focus'));

    // Should not throw
    await expect(focusCurrentWindow()).resolves.toBeUndefined();
  });
});

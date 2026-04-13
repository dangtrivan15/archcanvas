import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { confirmDiscardChanges } from '@/core/confirmDiscard';

describe('confirmDiscardChanges()', () => {
  const originalConfirm = window.confirm;

  beforeEach(() => {
    useFileStore.setState({ dirtyCanvases: new Set() });
    delete (window as any).__TAURI_INTERNALS__;
    // Ensure window.confirm exists in test environment
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
    window.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  it('returns true when no dirty canvases', async () => {
    expect(await confirmDiscardChanges()).toBe(true);
  });

  it('prompts via window.confirm when dirty (web)', async () => {
    useFileStore.setState({ dirtyCanvases: new Set(['canvas-1']) });
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);

    expect(await confirmDiscardChanges()).toBe(true);
    expect(window.confirm).toHaveBeenCalled();
  });

  it('returns false when user cancels confirm (web)', async () => {
    useFileStore.setState({ dirtyCanvases: new Set(['canvas-1']) });
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);

    expect(await confirmDiscardChanges()).toBe(false);
  });

  it('does not prompt when canvases are clean', async () => {
    expect(await confirmDiscardChanges()).toBe(true);
    expect(window.confirm).not.toHaveBeenCalled();
  });
});

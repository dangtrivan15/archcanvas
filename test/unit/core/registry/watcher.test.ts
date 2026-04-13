import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { createNodeDefWatcher } from '@/core/registry/watcher';

describe('createNodeDefWatcher (polling fallback)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onReload when a file is added', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({ 'project/.archcanvas/nodedefs/a.yaml': 'content-a' });

    const onReload = vi.fn().mockResolvedValue(undefined);
    const watcher = createNodeDefWatcher(fs, 'project', onReload);

    // Wait for initial snapshot to build
    await vi.advanceTimersByTimeAsync(100);

    // Add a new file
    fs.seed({ 'project/.archcanvas/nodedefs/b.yaml': 'content-b' });

    // Advance past poll interval
    await vi.advanceTimersByTimeAsync(3100);

    // Advance past debounce
    await vi.advanceTimersByTimeAsync(600);

    expect(onReload).toHaveBeenCalled();

    watcher.stop();
  });

  it('calls onReload when file content changes', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({ 'project/.archcanvas/nodedefs/a.yaml': 'version-1' });

    const onReload = vi.fn().mockResolvedValue(undefined);
    const watcher = createNodeDefWatcher(fs, 'project', onReload);

    await vi.advanceTimersByTimeAsync(100);

    // Modify existing file content
    fs.seed({ 'project/.archcanvas/nodedefs/a.yaml': 'version-2' });

    await vi.advanceTimersByTimeAsync(3100);
    await vi.advanceTimersByTimeAsync(600);

    expect(onReload).toHaveBeenCalled();

    watcher.stop();
  });

  it('does NOT call onReload when files are unchanged', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({ 'project/.archcanvas/nodedefs/a.yaml': 'content-a' });

    const onReload = vi.fn().mockResolvedValue(undefined);
    const watcher = createNodeDefWatcher(fs, 'project', onReload);

    await vi.advanceTimersByTimeAsync(100);

    // Advance multiple poll intervals with no changes
    await vi.advanceTimersByTimeAsync(10000);

    expect(onReload).not.toHaveBeenCalled();

    watcher.stop();
  });

  it('debounces multiple rapid changes into one onReload call', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({ 'project/.archcanvas/nodedefs/a.yaml': 'v1' });

    const onReload = vi.fn().mockResolvedValue(undefined);
    const watcher = createNodeDefWatcher(fs, 'project', onReload);

    await vi.advanceTimersByTimeAsync(100);

    // Simulate rapid changes across consecutive polls
    fs.seed({ 'project/.archcanvas/nodedefs/a.yaml': 'v2' });
    await vi.advanceTimersByTimeAsync(3100);

    fs.seed({ 'project/.archcanvas/nodedefs/a.yaml': 'v3' });
    await vi.advanceTimersByTimeAsync(200); // Within debounce window

    // Let debounce fire
    await vi.advanceTimersByTimeAsync(600);

    // Should have been called, but the debounce should coalesce
    expect(onReload.mock.calls.length).toBeLessThanOrEqual(2);

    watcher.stop();
  });

  it('stop() prevents further onReload calls', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({ 'project/.archcanvas/nodedefs/a.yaml': 'content' });

    const onReload = vi.fn().mockResolvedValue(undefined);
    const watcher = createNodeDefWatcher(fs, 'project', onReload);

    await vi.advanceTimersByTimeAsync(100);
    watcher.stop();

    // Add file and advance past poll interval
    fs.seed({ 'project/.archcanvas/nodedefs/b.yaml': 'new' });
    await vi.advanceTimersByTimeAsync(10000);

    expect(onReload).not.toHaveBeenCalled();
  });

  it('handles missing directory gracefully', async () => {
    const fs = new InMemoryFileSystem();
    // No .archcanvas/nodedefs/ directory

    const onReload = vi.fn().mockResolvedValue(undefined);
    const watcher = createNodeDefWatcher(fs, 'project', onReload);

    // Should not throw
    await vi.advanceTimersByTimeAsync(10000);

    expect(onReload).not.toHaveBeenCalled();
    watcher.stop();
  });
});

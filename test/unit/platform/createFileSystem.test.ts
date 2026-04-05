import { describe, it, expect, vi, afterEach } from 'vitest';

// We test createFileSystem's environment detection branches.
// Since tests run in jsdom (window is defined), we manipulate the window
// global to test each branch.
//
// Note: The Tauri branch cannot be fully tested because @tauri-apps/plugin-fs
// is not installed as an npm dependency (it only exists inside Tauri builds).
// We verify the branch is correctly entered by checking the error message.

/** Asserts an object has all 5 FileSystem methods */
function expectFileSystemShape(fs: { [key: string]: unknown }) {
  expect(typeof fs.readFile).toBe('function');
  expect(typeof fs.writeFile).toBe('function');
  expect(typeof fs.listFiles).toBe('function');
  expect(typeof fs.exists).toBe('function');
  expect(typeof fs.mkdir).toBe('function');
}

describe('createFileSystem', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    // Restore window to its original state
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error — removing window to simulate Node.js environment
      delete globalThis.window;
    }
    // @ts-expect-error — clean up Tauri marker if set
    delete globalThis.window?.__TAURI_INTERNALS__;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('Branch 1: WebFileSystem (FileSystemDirectoryHandle)', () => {
    it('returns WebFileSystem when given a FileSystemDirectoryHandle-like object', async () => {
      const { createFileSystem } = await import('@/platform/index');
      const mockHandle = {
        getFileHandle: vi.fn(),
        getDirectoryHandle: vi.fn(),
        kind: 'directory' as const,
        name: 'root',
      } as unknown as FileSystemDirectoryHandle;

      const fs = await createFileSystem(mockHandle);
      expectFileSystemShape(fs as unknown as { [key: string]: unknown });
    });
  });

  describe('Branch 2: NodeFileSystem (no window)', () => {
    it('returns NodeFileSystem when window is undefined', async () => {
      // Remove window to simulate Node.js environment
      // @ts-expect-error — removing window to simulate Node.js
      delete globalThis.window;

      const { createFileSystem } = await import('@/platform/index');
      const fs = await createFileSystem('/tmp/test-root');
      expectFileSystemShape(fs as unknown as { [key: string]: unknown });
    });
  });

  describe('Branch 3: TauriFileSystem (window.__TAURI_INTERNALS__)', () => {
    it('creates TauriFileSystem when Tauri internals are present', async () => {
      // Add __TAURI_INTERNALS__ to window to trigger the Tauri branch
      // @ts-expect-error — adding Tauri marker for detection
      globalThis.window.__TAURI_INTERNALS__ = {};

      const { createFileSystem } = await import('@/platform/index');

      // @tauri-apps/plugin-fs is installed, so the import succeeds
      // and returns a TauriFileSystem instance.
      const fs = await createFileSystem('/tauri/root');
      expect(fs.getPath()).toBe('/tauri/root');
    });
  });

  describe('Branch 4: Unknown environment (error)', () => {
    it('throws when window exists but no Tauri internals', async () => {
      // In jsdom, window is defined. Ensure __TAURI_INTERNALS__ is absent.
      const { createFileSystem } = await import('@/platform/index');
      await expect(createFileSystem('/some/path')).rejects.toThrow(
        /unable to detect platform/i,
      );
    });
  });

  describe('input validation', () => {
    it('throws on non-string non-handle argument', async () => {
      const { createFileSystem } = await import('@/platform/index');
      // @ts-expect-error — testing invalid input
      await expect(createFileSystem(42)).rejects.toThrow(
        /expected a string path or FileSystemDirectoryHandle/i,
      );
    });

    it('throws on null argument', async () => {
      const { createFileSystem } = await import('@/platform/index');
      // @ts-expect-error — testing null input
      await expect(createFileSystem(null)).rejects.toThrow();
    });
  });
});

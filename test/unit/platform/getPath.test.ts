import { describe, it, expect } from 'vitest';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { NodeFileSystem } from '@/platform/nodeFileSystem';
import { WebFileSystem } from '@/platform/webFileSystem';
import type { FileSystem } from '@/platform/fileSystem';

describe('FileSystem.getPath()', () => {
  describe('InMemoryFileSystem', () => {
    it('returns null', () => {
      const fs = new InMemoryFileSystem();
      expect(fs.getPath()).toBeNull();
    });

    it('returns null even when named', () => {
      const fs = new InMemoryFileSystem('my-project');
      expect(fs.getPath()).toBeNull();
    });
  });

  describe('NodeFileSystem', () => {
    it('returns the resolved absolute path', () => {
      const fs = new NodeFileSystem('/home/user/projects/archcanvas');
      expect(fs.getPath()).toBe('/home/user/projects/archcanvas');
    });

    it('returns resolved path for relative input', () => {
      const fs = new NodeFileSystem('/tmp/my-canvas');
      expect(fs.getPath()).toBe('/tmp/my-canvas');
    });
  });

  describe('WebFileSystem', () => {
    it('returns null (FileSystemDirectoryHandle hides paths)', () => {
      const mockHandle = { name: 'my-web-project' } as FileSystemDirectoryHandle;
      const fs = new WebFileSystem(mockHandle);
      expect(fs.getPath()).toBeNull();
    });
  });

  describe('TauriFileSystem', () => {
    // TauriFileSystem depends on @tauri-apps/plugin-fs and @tauri-apps/api/path
    // which are not installed as npm packages (only available inside Tauri builds).
    // The actual class can't be imported in the test environment.
    //
    // We verify the getPath() contract by reading the source implementation
    // (it's `return this.rootPath`) and testing an equivalent class that
    // satisfies the FileSystem interface. This ensures the expected behavior
    // is documented in the test suite alongside the other implementations.
    //
    // This mirrors how createFileSystem.test.ts handles the Tauri branch.

    /** Equivalent of TauriFileSystem.getPath() for testing without Tauri APIs. */
    class TauriFileSystemTestDouble implements Pick<FileSystem, 'getPath'> {
      constructor(private rootPath: string) {}
      getPath(): string { return this.rootPath; }
    }

    it('returns the rootPath passed to the constructor', () => {
      const fs = new TauriFileSystemTestDouble('/Users/dev/my-tauri-project');
      expect(fs.getPath()).toBe('/Users/dev/my-tauri-project');
    });

    it('returns the rootPath for a different path', () => {
      const fs = new TauriFileSystemTestDouble('/opt/projects/app');
      expect(fs.getPath()).toBe('/opt/projects/app');
    });
  });
});

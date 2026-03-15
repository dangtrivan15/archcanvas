import { describe, it, expect } from 'vitest';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { NodeFileSystem } from '@/platform/nodeFileSystem';
import { WebFileSystem } from '@/platform/webFileSystem';

describe('FileSystem.getName()', () => {
  describe('InMemoryFileSystem', () => {
    it('returns "untitled" when no name is provided', () => {
      const fs = new InMemoryFileSystem();
      expect(fs.getName()).toBe('untitled');
    });

    it('returns the custom name passed to the constructor', () => {
      const fs = new InMemoryFileSystem('my-project');
      expect(fs.getName()).toBe('my-project');
    });
  });

  describe('NodeFileSystem', () => {
    it('returns the basename of an absolute path', () => {
      const fs = new NodeFileSystem('/home/user/projects/archcanvas');
      expect(fs.getName()).toBe('archcanvas');
    });

    it('returns the basename of a path with a trailing slash', () => {
      // resolve() normalises trailing slashes, so basename still works
      const fs = new NodeFileSystem('/tmp/my-canvas');
      expect(fs.getName()).toBe('my-canvas');
    });
  });

  describe('WebFileSystem', () => {
    it('returns the name from the FileSystemDirectoryHandle', () => {
      const mockHandle = { name: 'my-web-project' } as FileSystemDirectoryHandle;
      const fs = new WebFileSystem(mockHandle);
      expect(fs.getName()).toBe('my-web-project');
    });
  });
});

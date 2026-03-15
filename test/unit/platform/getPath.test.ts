import { describe, it, expect } from 'vitest';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { NodeFileSystem } from '@/platform/nodeFileSystem';
import { WebFileSystem } from '@/platform/webFileSystem';

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
});

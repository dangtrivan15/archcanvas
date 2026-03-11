import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';

describe('InMemoryFileSystem', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  describe('readFile / writeFile', () => {
    it('writes and reads a file', async () => {
      await fs.writeFile('test.txt', 'hello');
      expect(await fs.readFile('test.txt')).toBe('hello');
    });

    it('overwrites existing file', async () => {
      await fs.writeFile('test.txt', 'first');
      await fs.writeFile('test.txt', 'second');
      expect(await fs.readFile('test.txt')).toBe('second');
    });

    it('throws on reading non-existent file', async () => {
      await expect(fs.readFile('missing.txt')).rejects.toThrow(/not found/i);
    });

    it('handles nested paths', async () => {
      await fs.writeFile('.archcanvas/main.yaml', 'content');
      expect(await fs.readFile('.archcanvas/main.yaml')).toBe('content');
    });
  });

  describe('listFiles', () => {
    it('lists files in a directory', async () => {
      await fs.writeFile('.archcanvas/main.yaml', 'a');
      await fs.writeFile('.archcanvas/svc-api.yaml', 'b');
      await fs.writeFile('.archcanvas/nodedefs/custom.yaml', 'c');
      const files = await fs.listFiles('.archcanvas');
      expect(files).toContain('main.yaml');
      expect(files).toContain('svc-api.yaml');
      expect(files).not.toContain('custom.yaml'); // in subdirectory
    });

    it('returns empty array for empty directory', async () => {
      expect(await fs.listFiles('.archcanvas')).toEqual([]);
    });
  });

  describe('exists', () => {
    it('returns true for existing file', async () => {
      await fs.writeFile('test.txt', 'hello');
      expect(await fs.exists('test.txt')).toBe(true);
    });

    it('returns false for non-existent file', async () => {
      expect(await fs.exists('missing.txt')).toBe(false);
    });

    it('returns true for directory containing files', async () => {
      await fs.writeFile('.archcanvas/main.yaml', 'content');
      expect(await fs.exists('.archcanvas')).toBe(true);
    });
  });

  describe('mkdir', () => {
    it('is a no-op (directories are implicit)', async () => {
      await expect(fs.mkdir('.archcanvas')).resolves.toBeUndefined();
    });
  });

  describe('seed helper', () => {
    it('populates multiple files at once', async () => {
      fs.seed({
        '.archcanvas/main.yaml': 'root content',
        '.archcanvas/svc-api.yaml': 'api content',
      });
      expect(await fs.readFile('.archcanvas/main.yaml')).toBe('root content');
      expect(await fs.readFile('.archcanvas/svc-api.yaml')).toBe('api content');
    });
  });
});

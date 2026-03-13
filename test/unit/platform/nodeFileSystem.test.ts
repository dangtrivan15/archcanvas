import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeFileSystem } from '@/platform/nodeFileSystem';

describe('NodeFileSystem', () => {
  let tempDir: string;
  let fs: NodeFileSystem;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'archcanvas-test-'));
    fs = new NodeFileSystem(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('reads a UTF-8 file', async () => {
      await writeFile(join(tempDir, 'test.txt'), 'hello world', 'utf-8');
      const content = await fs.readFile('test.txt');
      expect(content).toBe('hello world');
    });

    it('reads a file in a nested directory', async () => {
      await mkdir(join(tempDir, '.archcanvas'), { recursive: true });
      await writeFile(
        join(tempDir, '.archcanvas', 'main.yaml'),
        'root: true',
        'utf-8',
      );
      const content = await fs.readFile('.archcanvas/main.yaml');
      expect(content).toBe('root: true');
    });

    it('throws on missing file', async () => {
      await expect(fs.readFile('missing.txt')).rejects.toThrow();
    });

    it('reads files with unicode content', async () => {
      const unicode = 'Hello \u00e9\u00e8\u00ea \u4f60\u597d \ud83d\ude80';
      await writeFile(join(tempDir, 'unicode.txt'), unicode, 'utf-8');
      expect(await fs.readFile('unicode.txt')).toBe(unicode);
    });
  });

  describe('writeFile', () => {
    it('writes content to a file', async () => {
      await fs.writeFile('output.txt', 'written content');
      const content = await readFile(join(tempDir, 'output.txt'), 'utf-8');
      expect(content).toBe('written content');
    });

    it('creates parent directories automatically', async () => {
      await fs.writeFile('deep/nested/dir/file.txt', 'deep content');
      const content = await readFile(
        join(tempDir, 'deep', 'nested', 'dir', 'file.txt'),
        'utf-8',
      );
      expect(content).toBe('deep content');
    });

    it('overwrites existing file', async () => {
      await fs.writeFile('test.txt', 'first');
      await fs.writeFile('test.txt', 'second');
      const content = await readFile(join(tempDir, 'test.txt'), 'utf-8');
      expect(content).toBe('second');
    });

    it('writes empty string', async () => {
      await fs.writeFile('empty.txt', '');
      const content = await readFile(join(tempDir, 'empty.txt'), 'utf-8');
      expect(content).toBe('');
    });
  });

  describe('listFiles', () => {
    it('lists files in a directory', async () => {
      await mkdir(join(tempDir, '.archcanvas'), { recursive: true });
      await writeFile(join(tempDir, '.archcanvas', 'main.yaml'), 'a', 'utf-8');
      await writeFile(
        join(tempDir, '.archcanvas', 'svc-api.yaml'),
        'b',
        'utf-8',
      );

      const files = await fs.listFiles('.archcanvas');
      expect(files).toContain('main.yaml');
      expect(files).toContain('svc-api.yaml');
      expect(files).toHaveLength(2);
    });

    it('returns only files, not subdirectories', async () => {
      await mkdir(join(tempDir, 'parent', 'subdir'), { recursive: true });
      await writeFile(join(tempDir, 'parent', 'file.txt'), 'data', 'utf-8');
      await writeFile(
        join(tempDir, 'parent', 'subdir', 'nested.txt'),
        'nested',
        'utf-8',
      );

      const files = await fs.listFiles('parent');
      expect(files).toEqual(['file.txt']);
    });

    it('returns empty array for empty directory', async () => {
      await mkdir(join(tempDir, 'empty'), { recursive: true });
      const files = await fs.listFiles('empty');
      expect(files).toEqual([]);
    });

    it('throws on non-existent directory', async () => {
      await expect(fs.listFiles('nonexistent')).rejects.toThrow();
    });

    it('lists files in root directory', async () => {
      await writeFile(join(tempDir, 'root.txt'), 'root', 'utf-8');
      const files = await fs.listFiles('.');
      expect(files).toContain('root.txt');
    });
  });

  describe('exists', () => {
    it('returns true for existing file', async () => {
      await writeFile(join(tempDir, 'exists.txt'), 'content', 'utf-8');
      expect(await fs.exists('exists.txt')).toBe(true);
    });

    it('returns false for non-existent file', async () => {
      expect(await fs.exists('missing.txt')).toBe(false);
    });

    it('returns true for existing directory', async () => {
      await mkdir(join(tempDir, 'somedir'), { recursive: true });
      expect(await fs.exists('somedir')).toBe(true);
    });

    it('never throws — returns false for deeply nested non-existent path', async () => {
      const result = await fs.exists('a/b/c/d/e/f/g/missing.txt');
      expect(result).toBe(false);
    });
  });

  describe('mkdir', () => {
    it('creates a directory', async () => {
      await fs.mkdir('newdir');
      expect(await fs.exists('newdir')).toBe(true);
    });

    it('creates nested directories recursively', async () => {
      await fs.mkdir('a/b/c');
      expect(await fs.exists('a/b/c')).toBe(true);
    });

    it('is a no-op if directory already exists', async () => {
      await mkdir(join(tempDir, 'existing'), { recursive: true });
      await expect(fs.mkdir('existing')).resolves.toBeUndefined();
    });
  });

  describe('path resolution', () => {
    it('resolves paths relative to root', async () => {
      await fs.writeFile('relative.txt', 'relative content');
      const content = await readFile(
        join(tempDir, 'relative.txt'),
        'utf-8',
      );
      expect(content).toBe('relative content');
    });

    it('handles dotfiles', async () => {
      await fs.writeFile('.hidden', 'secret');
      expect(await fs.readFile('.hidden')).toBe('secret');
    });

    it('rejects paths that escape root via ..', async () => {
      await expect(fs.readFile('../../etc/passwd')).rejects.toThrow(
        /Path traversal detected/,
      );
    });

    it('rejects absolute paths outside root', async () => {
      await expect(fs.readFile('/etc/passwd')).rejects.toThrow(
        /Path traversal detected/,
      );
    });

    it('rejects parent-escaping writeFile', async () => {
      await expect(
        fs.writeFile('../escape.txt', 'bad'),
      ).rejects.toThrow(/Path traversal detected/);
    });
  });
});

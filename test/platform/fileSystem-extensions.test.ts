import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryFileSystem } from '../../src-web/platform/inMemoryFileSystem';
import { NodeFileSystem } from '../../src-web/platform/nodeFileSystem';

describe('FileSystem extensions — InMemoryFileSystem', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem('test');
    fs.seed({
      'src/app.ts': 'console.log("hello");',
      'src/lib/utils.ts': 'export function add(a: number, b: number) { return a + b; }',
      'src/lib/math.ts': 'export const PI = 3.14;',
      'README.md': '# Test Project',
      'package.json': '{}',
      '.git/config': '[core]',
      'node_modules/lodash/index.js': 'module.exports = {};',
    });
  });

  describe('listEntries', () => {
    it('lists direct children with type info', async () => {
      const entries = await fs.listEntries('.');
      const names = entries.map((e) => e.name);
      expect(names).toContain('src');
      expect(names).toContain('README.md');
      expect(names).toContain('package.json');
      const srcEntry = entries.find((e) => e.name === 'src');
      expect(srcEntry?.type).toBe('directory');
      const readmeEntry = entries.find((e) => e.name === 'README.md');
      expect(readmeEntry?.type).toBe('file');
    });

    it('lists subdirectory entries', async () => {
      const entries = await fs.listEntries('src');
      const names = entries.map((e) => e.name);
      expect(names).toContain('app.ts');
      expect(names).toContain('lib');
    });

    it('returns empty for nonexistent directory', async () => {
      const entries = await fs.listEntries('nonexistent');
      expect(entries).toEqual([]);
    });
  });

  describe('listFilesRecursive', () => {
    it('returns all files recursively', async () => {
      const files = await fs.listFilesRecursive('src');
      expect(files).toContain('src/app.ts');
      expect(files).toContain('src/lib/utils.ts');
      expect(files).toContain('src/lib/math.ts');
    });

    it('returns files from root', async () => {
      const files = await fs.listFilesRecursive('.');
      expect(files).toContain('README.md');
      expect(files).toContain('src/app.ts');
    });

    it('returns empty for nonexistent directory', async () => {
      const files = await fs.listFilesRecursive('nonexistent');
      expect(files).toEqual([]);
    });

    it('respects ignore list', async () => {
      const files = await fs.listFilesRecursive('.', ['node_modules', '.git']);
      expect(files).not.toContain('node_modules/lodash/index.js');
      expect(files).not.toContain('.git/config');
      expect(files).toContain('src/app.ts');
    });
  });

  describe('readFileBytes', () => {
    it('returns the file content as UTF-8 bytes', async () => {
      const bytes = await fs.readFileBytes('README.md');
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(bytes)).toBe('# Test Project');
    });

    it('throws for a missing file', async () => {
      await expect(fs.readFileBytes('nope.txt')).rejects.toThrow();
    });
  });

  describe('stat', () => {
    it('reports a file with its byte size', async () => {
      const s = await fs.stat('README.md');
      expect(s.type).toBe('file');
      expect(s.size).toBe('# Test Project'.length);
    });

    it('reports a directory', async () => {
      const s = await fs.stat('src');
      expect(s.type).toBe('directory');
    });

    it('throws ENOENT for a missing path', async () => {
      await expect(fs.stat('nope')).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });
});

describe('FileSystem extensions — NodeFileSystem', () => {
  let root: string;
  let fs: NodeFileSystem;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'archcanvas-fs-ext-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'README.md'), '# Test Project', 'utf-8');
    fs = new NodeFileSystem(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('readFileBytes', () => {
    it('round-trips file content as UTF-8 bytes', async () => {
      const bytes = await fs.readFileBytes('README.md');
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(bytes)).toBe('# Test Project');
    });

    it('throws for a missing file', async () => {
      await expect(fs.readFileBytes('nope.txt')).rejects.toThrow();
    });
  });

  describe('stat', () => {
    it('reports a file with its byte size', async () => {
      const s = await fs.stat('README.md');
      expect(s.type).toBe('file');
      expect(s.size).toBe('# Test Project'.length);
    });

    it('reports a directory', async () => {
      const s = await fs.stat('src');
      expect(s.type).toBe('directory');
    });

    it('throws ENOENT for a missing path', async () => {
      await expect(fs.stat('missing')).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });
});

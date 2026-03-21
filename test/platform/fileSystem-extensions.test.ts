import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFileSystem } from '../../src/platform/inMemoryFileSystem';

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
});

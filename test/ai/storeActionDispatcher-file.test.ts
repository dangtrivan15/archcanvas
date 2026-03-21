import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { dispatchStoreAction } from '@/core/ai/storeActionDispatcher';

enablePatches();

async function setup() {
  useFileStore.setState({
    project: null, dirtyCanvases: new Set(), status: 'idle', error: null,
  });
  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': serializeCanvas({
      project: { name: 'Test' }, nodes: [], edges: [],
    } as any),
    'src/app.ts': 'const greeting = "hello";\nconsole.log(greeting);',
    'src/lib/utils.ts': 'export function add(a: number, b: number) { return a + b; }',
    'README.md': '# Test',
  });
  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

describe('dispatchStoreAction — file actions', () => {
  beforeEach(setup);

  describe('readProjectFile', () => {
    it('reads an existing file', async () => {
      const result = await dispatchStoreAction('readProjectFile', { path: 'src/app.ts' });
      expect(result).toMatchObject({ ok: true });
      expect((result as any).data).toContain('hello');
    });

    it('returns error for nonexistent file', async () => {
      const result = await dispatchStoreAction('readProjectFile', { path: 'missing.ts' });
      expect(result).toMatchObject({ ok: false, error: { code: 'FILE_NOT_FOUND' } });
    });

    it('rejects path traversal', async () => {
      const result = await dispatchStoreAction('readProjectFile', { path: '../etc/passwd' });
      expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_PATH' } });
    });

    it('detects binary files', async () => {
      const fs = useFileStore.getState().fs!;
      await fs.writeFile('binary.bin', 'ELF\x00\x01\x02');
      const result = await dispatchStoreAction('readProjectFile', { path: 'binary.bin' });
      expect(result).toMatchObject({ ok: false, error: { code: 'BINARY_FILE' } });
    });

    it('truncates long files', async () => {
      const fs = useFileStore.getState().fs!;
      const longContent = Array.from({ length: 2500 }, (_, i) => `line ${i + 1}`).join('\n');
      await fs.writeFile('long.txt', longContent);
      const result = await dispatchStoreAction('readProjectFile', { path: 'long.txt' }) as any;
      expect(result.ok).toBe(true);
      expect(result.data).toContain('truncated');
      expect(result.data.split('\n').length).toBe(2001); // 2000 + truncation message
    });
  });

  describe('writeProjectFile', () => {
    it('creates a new file', async () => {
      const result = await dispatchStoreAction('writeProjectFile', {
        path: 'src/new.ts', content: 'export const x = 1;',
      });
      expect(result).toMatchObject({ ok: true });
      const fs = useFileStore.getState().fs!;
      const content = await fs.readFile('src/new.ts');
      expect(content).toBe('export const x = 1;');
    });

    it('overwrites existing file', async () => {
      await dispatchStoreAction('writeProjectFile', {
        path: 'README.md', content: '# Updated',
      });
      const fs = useFileStore.getState().fs!;
      const content = await fs.readFile('README.md');
      expect(content).toBe('# Updated');
    });

    it('rejects path traversal', async () => {
      const result = await dispatchStoreAction('writeProjectFile', {
        path: '../evil.ts', content: 'bad',
      });
      expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_PATH' } });
    });
  });

  describe('updateProjectFile', () => {
    it('replaces matching string', async () => {
      const result = await dispatchStoreAction('updateProjectFile', {
        path: 'src/app.ts', oldString: '"hello"', newString: '"world"',
      });
      expect(result).toMatchObject({ ok: true });
      const fs = useFileStore.getState().fs!;
      const content = await fs.readFile('src/app.ts');
      expect(content).toContain('"world"');
      expect(content).not.toContain('"hello"');
    });

    it('returns error when string not found', async () => {
      const result = await dispatchStoreAction('updateProjectFile', {
        path: 'src/app.ts', oldString: 'nonexistent', newString: 'replacement',
      });
      expect(result).toMatchObject({ ok: false, error: { code: 'STRING_NOT_FOUND' } });
    });

    it('returns error for ambiguous match', async () => {
      const fs = useFileStore.getState().fs!;
      await fs.writeFile('src/dup.ts', 'foo\nfoo\n');
      const result = await dispatchStoreAction('updateProjectFile', {
        path: 'src/dup.ts', oldString: 'foo', newString: 'bar',
      });
      expect(result).toMatchObject({ ok: false, error: { code: 'AMBIGUOUS_MATCH' } });
    });

    it('returns error for nonexistent file', async () => {
      const result = await dispatchStoreAction('updateProjectFile', {
        path: 'nope.ts', oldString: 'a', newString: 'b',
      });
      expect(result).toMatchObject({ ok: false, error: { code: 'FILE_NOT_FOUND' } });
    });
  });

  describe('listProjectFiles', () => {
    it('lists root directory', async () => {
      const result = await dispatchStoreAction('listProjectFiles', { path: '.' }) as any;
      expect(result.entries).toBeDefined();
      const names = result.entries.map((e: any) => e.name);
      expect(names).toContain('src');
      expect(names).toContain('README.md');
    });

    it('lists subdirectory', async () => {
      const result = await dispatchStoreAction('listProjectFiles', { path: 'src' }) as any;
      const names = result.entries.map((e: any) => e.name);
      expect(names).toContain('app.ts');
      expect(names).toContain('lib');
    });
  });

  describe('globProjectFiles', () => {
    it('matches glob pattern', async () => {
      const result = await dispatchStoreAction('globProjectFiles', {
        pattern: '**/*.ts', path: '.',
      }) as any;
      expect(result.files).toContain('src/app.ts');
      expect(result.files).toContain('src/lib/utils.ts');
    });

    it('excludes ignored directories', async () => {
      const fs = useFileStore.getState().fs!;
      await fs.writeFile('node_modules/pkg/index.ts', 'export {};');
      const result = await dispatchStoreAction('globProjectFiles', {
        pattern: '**/*.ts', path: '.',
      }) as any;
      expect(result.files).not.toContain('node_modules/pkg/index.ts');
    });
  });

  describe('deleteProjectFile', () => {
    it('deletes an existing file', async () => {
      const fs = useFileStore.getState().fs!;
      expect(await fs.exists('README.md')).toBe(true);
      const result = await dispatchStoreAction('deleteProjectFile', { path: 'README.md' });
      expect(result).toMatchObject({ ok: true, data: { path: 'README.md' } });
      expect(await fs.exists('README.md')).toBe(false);
    });

    it('returns error for nonexistent file', async () => {
      const result = await dispatchStoreAction('deleteProjectFile', { path: 'nope.ts' });
      expect(result).toMatchObject({ ok: false, error: { code: 'FILE_NOT_FOUND' } });
    });

    it('rejects path traversal', async () => {
      const result = await dispatchStoreAction('deleteProjectFile', { path: '../etc/passwd' });
      expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_PATH' } });
    });
  });

  describe('searchProjectFiles', () => {
    it('finds regex matches', async () => {
      const result = await dispatchStoreAction('searchProjectFiles', {
        query: 'export', path: '.',
      }) as any;
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].path).toBe('src/lib/utils.ts');
    });

    it('respects include filter', async () => {
      const result = await dispatchStoreAction('searchProjectFiles', {
        query: '#', path: '.', include: '*.md',
      }) as any;
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].path).toBe('README.md');
    });

    it('returns error for invalid regex', async () => {
      const result = await dispatchStoreAction('searchProjectFiles', {
        query: '[invalid', path: '.',
      }) as any;
      expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_REGEX' } });
    });
  });
});

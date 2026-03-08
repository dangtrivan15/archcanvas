/**
 * Unit tests for project folder scanning.
 *
 * Uses mock FileSystemDirectoryHandle to test scanning logic
 * without requiring actual filesystem access.
 */
import { describe, it, expect, vi } from 'vitest';
import { scanProjectFolder } from '@/core/project/scanner';
import type { ProjectManifest } from '@/types/project';

// ─── Mock FileSystemDirectoryHandle ─────────────────────────────

interface MockEntry {
  kind: 'file' | 'directory';
  name: string;
  getFile?: () => Promise<{
    text: () => Promise<string>;
    arrayBuffer: () => Promise<ArrayBuffer>;
  }>;
}

function createMockDirHandle(
  name: string,
  entries: MockEntry[],
): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    values: () => {
      let index = 0;
      return {
        [Symbol.asyncIterator]() {
          return this;
        },
        next() {
          if (index < entries.length) {
            return Promise.resolve({ value: entries[index++], done: false });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
    getFileHandle: vi.fn(),
    getDirectoryHandle: vi.fn(),
    removeEntry: vi.fn(),
    resolve: vi.fn(),
    isSameEntry: vi.fn(),
    keys: vi.fn(),
    entries: vi.fn(),
    [Symbol.asyncIterator]: vi.fn(),
  } as unknown as FileSystemDirectoryHandle;
}

function createMockFileEntry(
  name: string,
  content?: string,
): MockEntry {
  return {
    kind: 'file',
    name,
    getFile: () =>
      Promise.resolve({
        text: () => Promise.resolve(content ?? ''),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(content ?? '').buffer),
      }),
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('scanProjectFolder', () => {
  it('should discover .archc files when no manifest exists', async () => {
    const dirHandle = createMockDirHandle('my-project', [
      createMockFileEntry('main.archc'),
      createMockFileEntry('auth.archc'),
      createMockFileEntry('README.md'),
    ]);

    const result = await scanProjectFolder(dirHandle);

    expect(result.manifestExisted).toBe(false);
    expect(result.manifest.name).toBe('my-project');
    expect(result.manifest.files).toHaveLength(2);
    expect(result.manifest.rootFile).toBe('auth.archc'); // sorted alphabetically
    expect(result.manifest.files.map((f) => f.path)).toEqual(['auth.archc', 'main.archc']);
    expect(result.directoryHandle).toBe(dirHandle);
  });

  it('should read and parse existing manifest', async () => {
    const manifest: ProjectManifest = {
      version: 1,
      name: 'Existing Project',
      rootFile: 'root.archc',
      files: [
        { path: 'root.archc', displayName: 'Root' },
        { path: 'sub.archc', displayName: 'Sub' },
      ],
      links: [{ from: 'root.archc', to: 'sub.archc' }],
    };

    const dirHandle = createMockDirHandle('existing-project', [
      createMockFileEntry('.archproject.json', JSON.stringify(manifest)),
      createMockFileEntry('root.archc'),
      createMockFileEntry('sub.archc'),
    ]);

    const result = await scanProjectFolder(dirHandle);

    expect(result.manifestExisted).toBe(true);
    expect(result.manifest.name).toBe('Existing Project');
    expect(result.manifest.rootFile).toBe('root.archc');
    expect(result.manifest.files).toHaveLength(2);
    expect(result.manifest.links).toHaveLength(1);
  });

  it('should throw when no .archc files and no manifest found', async () => {
    const dirHandle = createMockDirHandle('empty-project', [
      createMockFileEntry('README.md'),
      createMockFileEntry('notes.txt'),
    ]);

    await expect(scanProjectFolder(dirHandle)).rejects.toThrow(
      'No .archc files found',
    );
  });

  it('should ignore directory entries', async () => {
    const dirHandle = createMockDirHandle('project', [
      { kind: 'directory', name: 'subdir' },
      createMockFileEntry('main.archc'),
    ]);

    const result = await scanProjectFolder(dirHandle);
    expect(result.manifest.files).toHaveLength(1);
    expect(result.manifest.files[0]!.path).toBe('main.archc');
  });

  it('should sort discovered files alphabetically', async () => {
    const dirHandle = createMockDirHandle('project', [
      createMockFileEntry('zebra.archc'),
      createMockFileEntry('alpha.archc'),
      createMockFileEntry('middle.archc'),
    ]);

    const result = await scanProjectFolder(dirHandle);
    expect(result.manifest.files.map((f) => f.path)).toEqual([
      'alpha.archc',
      'middle.archc',
      'zebra.archc',
    ]);
  });

  it('should use folder name as project name when auto-generating manifest', async () => {
    const dirHandle = createMockDirHandle('my-cool-project', [
      createMockFileEntry('app.archc'),
    ]);

    const result = await scanProjectFolder(dirHandle);
    expect(result.manifest.name).toBe('my-cool-project');
  });
});

/**
 * Unit tests for .archcanvas/ folder detection and initialization.
 *
 * Tests the new folder convention where all .archc files live inside
 * a .archcanvas/ subdirectory of the user's project folder.
 */
import { describe, it, expect, vi } from 'vitest';
import { scanProjectFolder, initArchcanvasDir } from '@/core/project/scanner';
import { ARCHCANVAS_DIR_NAME, ARCHCANVAS_MAIN_FILE } from '@/types/project';

// ─── Mock helpers ───────────────────────────────────────────────

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
  options?: {
    subdirs?: Record<string, MockEntry[]>;
  },
): FileSystemDirectoryHandle {
  const subdirHandles: Record<string, FileSystemDirectoryHandle> = {};
  if (options?.subdirs) {
    for (const [dirName, subEntries] of Object.entries(options.subdirs)) {
      subdirHandles[dirName] = createMockDirHandle(dirName, subEntries);
    }
  }

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
    getDirectoryHandle: vi.fn().mockImplementation(async (dirName: string, opts?: { create?: boolean }) => {
      if (subdirHandles[dirName]) {
        return subdirHandles[dirName];
      }
      if (opts?.create) {
        // Simulate creating a new directory
        const newHandle = createMockDirHandle(dirName, []);
        subdirHandles[dirName] = newHandle;
        return newHandle;
      }
      throw new DOMException('Directory not found', 'NotFoundError');
    }),
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

function createMockDirEntry(name: string): MockEntry {
  return { kind: 'directory', name };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('.archcanvas folder detection', () => {
  describe('scanProjectFolder - .archcanvas/ exists', () => {
    it('should detect .archcanvas/ subdirectory and scan its contents', async () => {
      const dirHandle = createMockDirHandle(
        'my-repo',
        [
          createMockDirEntry('.archcanvas'),
          createMockFileEntry('README.md'),
          createMockDirEntry('src'),
        ],
        {
          subdirs: {
            '.archcanvas': [
              createMockFileEntry('main.archc'),
              createMockFileEntry('backend.archc'),
            ],
          },
        },
      );

      const result = await scanProjectFolder(dirHandle);

      expect(result.isEmpty).toBe(false);
      expect(result.archcanvasHandle).not.toBeNull();
      expect(result.manifest.name).toBe('my-repo');
      expect(result.manifest.rootFile).toBe(ARCHCANVAS_MAIN_FILE);
      expect(result.manifest.files).toHaveLength(2);
      expect(result.manifest.files.map((f) => f.path)).toEqual([
        'backend.archc',
        'main.archc',
      ]);
      expect(result.directoryHandle).toBe(dirHandle);
    });

    it('should use main.archc as root file when present', async () => {
      const dirHandle = createMockDirHandle(
        'project',
        [createMockDirEntry('.archcanvas')],
        {
          subdirs: {
            '.archcanvas': [
              createMockFileEntry('other.archc'),
              createMockFileEntry('main.archc'),
            ],
          },
        },
      );

      const result = await scanProjectFolder(dirHandle);

      expect(result.manifest.rootFile).toBe('main.archc');
    });

    it('should use first file as root when main.archc is missing', async () => {
      const dirHandle = createMockDirHandle(
        'project',
        [createMockDirEntry('.archcanvas')],
        {
          subdirs: {
            '.archcanvas': [
              createMockFileEntry('zebra.archc'),
              createMockFileEntry('alpha.archc'),
            ],
          },
        },
      );

      const result = await scanProjectFolder(dirHandle);

      expect(result.manifest.rootFile).toBe('alpha.archc'); // sorted alphabetically
    });

    it('should return isEmpty=true when .archcanvas/ exists but is empty', async () => {
      const dirHandle = createMockDirHandle(
        'empty-project',
        [createMockDirEntry('.archcanvas')],
        {
          subdirs: {
            '.archcanvas': [],
          },
        },
      );

      const result = await scanProjectFolder(dirHandle);

      expect(result.isEmpty).toBe(true);
      expect(result.archcanvasHandle).not.toBeNull();
      expect(result.manifest.name).toBe('empty-project');
      expect(result.manifest.files).toHaveLength(0);
    });

    it('should set manifestExisted=true when .archcanvas/ dir found', async () => {
      const dirHandle = createMockDirHandle(
        'project',
        [createMockDirEntry('.archcanvas')],
        {
          subdirs: {
            '.archcanvas': [createMockFileEntry('main.archc')],
          },
        },
      );

      const result = await scanProjectFolder(dirHandle);

      expect(result.manifestExisted).toBe(true);
    });
  });

  describe('scanProjectFolder - no .archcanvas/ (legacy fallback)', () => {
    it('should fall back to legacy scanning when .archcanvas/ does not exist', async () => {
      const dirHandle = createMockDirHandle('legacy-project', [
        createMockFileEntry('architecture.archc'),
        createMockFileEntry('README.md'),
      ]);

      const result = await scanProjectFolder(dirHandle);

      expect(result.archcanvasHandle).toBeNull();
      expect(result.isEmpty).toBe(false);
      expect(result.manifest.files).toHaveLength(1);
      expect(result.manifest.files[0]!.path).toBe('architecture.archc');
    });

    it('should return isEmpty=true for empty folder without .archcanvas/', async () => {
      const dirHandle = createMockDirHandle('bare-folder', [
        createMockFileEntry('README.md'),
      ]);

      const result = await scanProjectFolder(dirHandle);

      expect(result.isEmpty).toBe(true);
      expect(result.archcanvasHandle).toBeNull();
    });

    it('should detect source files in empty folders', async () => {
      const dirHandle = createMockDirHandle('code-repo', [
        createMockFileEntry('app.ts'),
        createMockDirEntry('src'),
      ]);

      const result = await scanProjectFolder(dirHandle);

      expect(result.isEmpty).toBe(true);
      expect(result.hasSourceFiles).toBe(true);
    });
  });

  describe('initArchcanvasDir', () => {
    it('should create .archcanvas/ directory', async () => {
      const dirHandle = createMockDirHandle('my-repo', []);

      const archcanvasHandle = await initArchcanvasDir(dirHandle);

      expect(archcanvasHandle).toBeDefined();
      expect(archcanvasHandle.name).toBe(ARCHCANVAS_DIR_NAME);
      expect(dirHandle.getDirectoryHandle).toHaveBeenCalledWith(
        ARCHCANVAS_DIR_NAME,
        { create: true },
      );
    });
  });

  describe('constants', () => {
    it('ARCHCANVAS_DIR_NAME should be .archcanvas', () => {
      expect(ARCHCANVAS_DIR_NAME).toBe('.archcanvas');
    });

    it('ARCHCANVAS_MAIN_FILE should be main.archc', () => {
      expect(ARCHCANVAS_MAIN_FILE).toBe('main.archc');
    });
  });
});

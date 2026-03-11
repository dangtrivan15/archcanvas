/**
 * Tests for NativeFileSystemAdapter using Capacitor plugins.
 *
 * Feature #279: Native iOS FileSystemAdapter using Capacitor Filesystem plugin
 *
 * Tests the NativeFileSystemAdapter implementation with mocked Capacitor
 * plugins (@capacitor/filesystem, @capacitor/share, @capawesome/capacitor-file-picker).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Mock Capacitor plugins ──────────────────────────────────

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'ios'),
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    getUri: vi.fn(),
  },
  Directory: {
    Documents: 'DOCUMENTS',
    Data: 'DATA',
    Cache: 'CACHE',
    Library: 'LIBRARY',
    Temporary: 'TEMPORARY',
  },
  Encoding: {
    UTF8: 'utf8',
    ASCII: 'ascii',
    UTF16: 'utf16',
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn(),
    canShare: vi.fn(),
  },
}));

vi.mock('@capawesome/capacitor-file-picker', () => ({
  FilePicker: {
    pickFiles: vi.fn(),
  },
}));

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FilePicker } from '@capawesome/capacitor-file-picker';

const mockFilesystem = Filesystem as unknown as {
  readFile: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  getUri: ReturnType<typeof vi.fn>;
};

const mockShare = Share as unknown as {
  share: ReturnType<typeof vi.fn>;
};

const mockFilePicker = FilePicker as unknown as {
  pickFiles: ReturnType<typeof vi.fn>;
};

// ─── Source paths ──────────────────────────────────────────────

const SRC_DIR = path.resolve(__dirname, '../../../src/core/platform');
const NATIVE_ADAPTER = path.join(SRC_DIR, 'nativeFileSystemAdapter.ts');

function readSource(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Base64 helpers (matching adapter's helpers) ──────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ═══════════════════════════════════════════════════════════════════
// 1. Source Structure Verification
// ═══════════════════════════════════════════════════════════════════

describe('Feature #279: NativeFileSystemAdapter — Source structure', () => {
  it('imports Filesystem, Directory, Encoding from @capacitor/filesystem', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain("from '@capacitor/filesystem'");
    expect(src).toContain('Filesystem');
    expect(src).toContain('Directory');
    expect(src).toContain('Encoding');
  });

  it('imports Share from @capacitor/share', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain("from '@capacitor/share'");
    expect(src).toContain('Share');
  });

  it('imports FilePicker from @capawesome/capacitor-file-picker', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain("from '@capawesome/capacitor-file-picker'");
    expect(src).toContain('FilePicker');
  });

  it('implements FileSystemAdapter interface', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('implements FileSystemAdapter');
  });

  it('exports NativeFileSystemAdapter class', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('export class NativeFileSystemAdapter');
  });

  it('has base64 encoding helpers', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('uint8ArrayToBase64');
    expect(src).toContain('base64ToUint8Array');
  });

  it('uses Documents directory for .archc files', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('Directory.Documents');
  });

  it('uses Cache directory for temporary share files', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('Directory.Cache');
  });

  it('has an ArchCanvas subfolder constant', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('ArchCanvas');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. pickFile — FilePicker + Filesystem.readFile
// ═══════════════════════════════════════════════════════════════════

describe('Feature #279: NativeFileSystemAdapter — pickFile', () => {
  let adapter: InstanceType<
    typeof import('@/core/platform/nativeFileSystemAdapter').NativeFileSystemAdapter
  >;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { NativeFileSystemAdapter } = await import('@/core/platform/nativeFileSystemAdapter');
    adapter = new NativeFileSystemAdapter();
  });

  it('calls FilePicker.pickFiles with correct options', async () => {
    const testData = new Uint8Array([1, 2, 3, 4]);
    const base64Data = uint8ArrayToBase64(testData);

    mockFilePicker.pickFiles.mockResolvedValue({
      files: [
        {
          name: 'project.archc',
          path: '/var/mobile/Documents/project.archc',
          mimeType: 'application/octet-stream',
          size: 4,
        },
      ],
    });
    mockFilesystem.readFile.mockResolvedValue({ data: base64Data });

    await adapter.pickFile();

    expect(mockFilePicker.pickFiles).toHaveBeenCalledWith({
      types: ['application/octet-stream'],
      limit: 1,
      readData: false,
    });
  });

  it('reads file content via Filesystem.readFile after picking', async () => {
    const testData = new Uint8Array([10, 20, 30]);
    const base64Data = uint8ArrayToBase64(testData);

    mockFilePicker.pickFiles.mockResolvedValue({
      files: [
        {
          name: 'test.archc',
          path: '/var/mobile/Documents/test.archc',
          mimeType: 'application/octet-stream',
          size: 3,
        },
      ],
    });
    mockFilesystem.readFile.mockResolvedValue({ data: base64Data });

    const result = await adapter.pickFile();

    expect(mockFilesystem.readFile).toHaveBeenCalledWith({
      path: '/var/mobile/Documents/test.archc',
    });
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(testData);
    expect(result!.name).toBe('test.archc');
    expect(result!.handle).toBe('/var/mobile/Documents/test.archc');
  });

  it('returns null when picker returns no files', async () => {
    mockFilePicker.pickFiles.mockResolvedValue({ files: [] });

    const result = await adapter.pickFile();
    expect(result).toBeNull();
  });

  it('returns null when user cancels picker', async () => {
    mockFilePicker.pickFiles.mockRejectedValue(new Error('User cancelled'));

    const result = await adapter.pickFile();
    expect(result).toBeNull();
  });

  it('re-throws non-cancellation errors', async () => {
    mockFilePicker.pickFiles.mockRejectedValue(new Error('Permission denied'));

    await expect(adapter.pickFile()).rejects.toThrow('Permission denied');
  });

  it('uses file path as the handle for save-in-place', async () => {
    const testData = new Uint8Array([5]);
    mockFilePicker.pickFiles.mockResolvedValue({
      files: [
        {
          name: 'my.archc',
          path: '/path/to/my.archc',
          mimeType: 'application/octet-stream',
          size: 1,
        },
      ],
    });
    mockFilesystem.readFile.mockResolvedValue({ data: uint8ArrayToBase64(testData) });

    const result = await adapter.pickFile();
    expect(result!.handle).toBe('/path/to/my.archc');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. saveFile — Filesystem.writeFile
// ═══════════════════════════════════════════════════════════════════

describe('Feature #279: NativeFileSystemAdapter — saveFile', () => {
  let adapter: InstanceType<
    typeof import('@/core/platform/nativeFileSystemAdapter').NativeFileSystemAdapter
  >;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { NativeFileSystemAdapter } = await import('@/core/platform/nativeFileSystemAdapter');
    adapter = new NativeFileSystemAdapter();
  });

  it('writes to existing path when handle is provided', async () => {
    const testData = new Uint8Array([1, 2, 3]);
    const existingPath = '/var/mobile/Documents/project.archc';

    mockFilesystem.writeFile.mockResolvedValue({ uri: existingPath });

    const result = await adapter.saveFile(testData, existingPath);

    expect(mockFilesystem.writeFile).toHaveBeenCalledWith({
      path: existingPath,
      data: uint8ArrayToBase64(testData),
      recursive: true,
    });
    expect(result.handle).toBe(existingPath);
  });

  it('saves to default location when no handle provided', async () => {
    const testData = new Uint8Array([4, 5, 6]);
    const expectedUri = 'file:///var/mobile/Documents/ArchCanvas/architecture.archc';

    mockFilesystem.writeFile.mockResolvedValue({ uri: expectedUri });

    const result = await adapter.saveFile(testData);

    expect(mockFilesystem.writeFile).toHaveBeenCalledWith({
      path: 'ArchCanvas/architecture.archc',
      data: uint8ArrayToBase64(testData),
      directory: 'DOCUMENTS',
      recursive: true,
    });
    expect(result.handle).toBe(expectedUri);
  });

  it('encodes data as base64 for Filesystem plugin', async () => {
    const testData = new Uint8Array([255, 128, 0]);
    mockFilesystem.writeFile.mockResolvedValue({ uri: 'test' });

    await adapter.saveFile(testData, '/path/to/file');

    const callArgs = mockFilesystem.writeFile.mock.calls[0][0];
    const decodedBack = base64ToUint8Array(callArgs.data);
    expect(decodedBack).toEqual(testData);
  });

  it('uses recursive: true to create parent directories', async () => {
    mockFilesystem.writeFile.mockResolvedValue({ uri: 'test' });

    await adapter.saveFile(new Uint8Array(), '/path/to/file');

    const callArgs = mockFilesystem.writeFile.mock.calls[0][0];
    expect(callArgs.recursive).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. saveFileAs — Filesystem.writeFile + Share
// ═══════════════════════════════════════════════════════════════════

describe('Feature #279: NativeFileSystemAdapter — saveFileAs', () => {
  let adapter: InstanceType<
    typeof import('@/core/platform/nativeFileSystemAdapter').NativeFileSystemAdapter
  >;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { NativeFileSystemAdapter } = await import('@/core/platform/nativeFileSystemAdapter');
    adapter = new NativeFileSystemAdapter();
  });

  it('writes file to Documents/ArchCanvas directory', async () => {
    const testData = new Uint8Array([1, 2, 3]);
    const expectedUri = 'file:///var/mobile/Documents/ArchCanvas/project.archc';

    mockFilesystem.writeFile.mockResolvedValue({ uri: expectedUri });
    mockShare.share.mockResolvedValue({});

    const result = await adapter.saveFileAs(testData, 'project.archc');

    expect(mockFilesystem.writeFile).toHaveBeenCalledWith({
      path: 'ArchCanvas/project.archc',
      data: uint8ArrayToBase64(testData),
      directory: 'DOCUMENTS',
      recursive: true,
    });
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe('project.archc');
  });

  it('appends .archc extension if missing', async () => {
    mockFilesystem.writeFile.mockResolvedValue({ uri: 'test-uri' });
    mockShare.share.mockResolvedValue({});

    const result = await adapter.saveFileAs(new Uint8Array(), 'my-project');

    const callArgs = mockFilesystem.writeFile.mock.calls[0][0];
    expect(callArgs.path).toBe('ArchCanvas/my-project.archc');
    expect(result!.fileName).toBe('my-project.archc');
  });

  it('does not double .archc extension', async () => {
    mockFilesystem.writeFile.mockResolvedValue({ uri: 'test-uri' });
    mockShare.share.mockResolvedValue({});

    const result = await adapter.saveFileAs(new Uint8Array(), 'project.archc');

    const callArgs = mockFilesystem.writeFile.mock.calls[0][0];
    expect(callArgs.path).toBe('ArchCanvas/project.archc');
    expect(result!.fileName).toBe('project.archc');
  });

  it('presents share sheet after writing file', async () => {
    const expectedUri = 'file:///Documents/ArchCanvas/test.archc';
    mockFilesystem.writeFile.mockResolvedValue({ uri: expectedUri });
    mockShare.share.mockResolvedValue({});

    await adapter.saveFileAs(new Uint8Array(), 'test.archc');

    expect(mockShare.share).toHaveBeenCalledWith({
      title: 'test.archc',
      url: expectedUri,
      dialogTitle: 'Save test.archc',
    });
  });

  it('still returns result even if share is cancelled', async () => {
    const expectedUri = 'file:///Documents/ArchCanvas/test.archc';
    mockFilesystem.writeFile.mockResolvedValue({ uri: expectedUri });
    mockShare.share.mockRejectedValue(new Error('User cancelled'));

    const result = await adapter.saveFileAs(new Uint8Array(), 'test.archc');

    expect(result).not.toBeNull();
    expect(result!.handle).toBe(expectedUri);
    expect(result!.fileName).toBe('test.archc');
  });

  it('returns the write URI as handle', async () => {
    const expectedUri = 'file:///Documents/ArchCanvas/project.archc';
    mockFilesystem.writeFile.mockResolvedValue({ uri: expectedUri });
    mockShare.share.mockResolvedValue({});

    const result = await adapter.saveFileAs(new Uint8Array(), 'project.archc');
    expect(result!.handle).toBe(expectedUri);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. shareFile — Filesystem + Share
// ═══════════════════════════════════════════════════════════════════

describe('Feature #279: NativeFileSystemAdapter — shareFile', () => {
  let adapter: InstanceType<
    typeof import('@/core/platform/nativeFileSystemAdapter').NativeFileSystemAdapter
  >;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { NativeFileSystemAdapter } = await import('@/core/platform/nativeFileSystemAdapter');
    adapter = new NativeFileSystemAdapter();
  });

  it('writes binary data to Cache directory as temp file', async () => {
    const testData = new Uint8Array([1, 2, 3]);
    mockFilesystem.writeFile.mockResolvedValue({});
    mockFilesystem.getUri.mockResolvedValue({ uri: 'file:///cache/tmp/export.png' });
    mockShare.share.mockResolvedValue({});

    await adapter.shareFile(testData, 'export.png', 'image/png');

    expect(mockFilesystem.writeFile).toHaveBeenCalledWith({
      path: 'tmp/export.png',
      data: uint8ArrayToBase64(testData),
      directory: 'CACHE',
      recursive: true,
    });
  });

  it('writes text data with UTF8 encoding', async () => {
    mockFilesystem.writeFile.mockResolvedValue({});
    mockFilesystem.getUri.mockResolvedValue({ uri: 'file:///cache/tmp/summary.md' });
    mockShare.share.mockResolvedValue({});

    await adapter.shareFile('# Summary\ntest', 'summary.md', 'text/markdown');

    expect(mockFilesystem.writeFile).toHaveBeenCalledWith({
      path: 'tmp/summary.md',
      data: '# Summary\ntest',
      directory: 'CACHE',
      encoding: 'utf8',
      recursive: true,
    });
  });

  it('gets file URI after writing', async () => {
    mockFilesystem.writeFile.mockResolvedValue({});
    mockFilesystem.getUri.mockResolvedValue({ uri: 'file:///cache/tmp/arch.archc' });
    mockShare.share.mockResolvedValue({});

    await adapter.shareFile(new Uint8Array(), 'arch.archc', 'application/octet-stream');

    expect(mockFilesystem.getUri).toHaveBeenCalledWith({
      path: 'tmp/arch.archc',
      directory: 'CACHE',
    });
  });

  it('presents share sheet with file URI', async () => {
    const fileUri = 'file:///cache/tmp/export.svg';
    mockFilesystem.writeFile.mockResolvedValue({});
    mockFilesystem.getUri.mockResolvedValue({ uri: fileUri });
    mockShare.share.mockResolvedValue({});

    await adapter.shareFile('<svg></svg>', 'export.svg', 'image/svg+xml');

    expect(mockShare.share).toHaveBeenCalledWith({
      title: 'export.svg',
      url: fileUri,
      dialogTitle: 'Share export.svg',
    });
  });

  it('shareFile handles different MIME types', async () => {
    mockFilesystem.writeFile.mockResolvedValue({});
    mockFilesystem.getUri.mockResolvedValue({ uri: 'file:///cache/tmp/file' });
    mockShare.share.mockResolvedValue({});

    // Should work with any MIME type
    await adapter.shareFile(new Uint8Array(), 'file.archc', 'application/octet-stream');
    await adapter.shareFile('text', 'file.md', 'text/markdown');

    expect(mockShare.share).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Base64 encoding/decoding
// ═══════════════════════════════════════════════════════════════════

describe('Feature #279: NativeFileSystemAdapter — Base64 helpers', () => {
  it('source contains uint8ArrayToBase64 helper', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('function uint8ArrayToBase64');
    expect(src).toContain('btoa');
  });

  it('source contains base64ToUint8Array helper', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('function base64ToUint8Array');
    expect(src).toContain('atob');
  });

  it('base64 round-trip preserves data', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255, 42, 73, 200]);
    const base64 = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(base64);
    expect(decoded).toEqual(original);
  });

  it('base64 round-trip with empty array', () => {
    const original = new Uint8Array([]);
    const base64 = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(base64);
    expect(decoded).toEqual(original);
  });

  it('base64 round-trip with large array', () => {
    const original = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) {
      original[i] = i % 256;
    }
    const base64 = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(base64);
    expect(decoded).toEqual(original);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. Integration with factory
// ═══════════════════════════════════════════════════════════════════

describe('Feature #279: NativeFileSystemAdapter — Factory integration', () => {
  it('adapter is exported as named export for dynamic import', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('export class NativeFileSystemAdapter');
  });

  it('adapter implements all four FileSystemAdapter methods', async () => {
    const { NativeFileSystemAdapter } = await import('@/core/platform/nativeFileSystemAdapter');
    const adapter = new NativeFileSystemAdapter();
    expect(typeof adapter.pickFile).toBe('function');
    expect(typeof adapter.saveFile).toBe('function');
    expect(typeof adapter.saveFileAs).toBe('function');
    expect(typeof adapter.shareFile).toBe('function');
  });

  it('fileSystemAdapter factory imports NativeFileSystemAdapter dynamically', () => {
    const factorySrc = fs.readFileSync(path.join(SRC_DIR, 'fileSystemAdapter.ts'), 'utf-8');
    expect(factorySrc).toContain("await import('./nativeFileSystemAdapter')");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. Error handling
// ═══════════════════════════════════════════════════════════════════

describe('Feature #279: NativeFileSystemAdapter — Error handling', () => {
  let adapter: InstanceType<
    typeof import('@/core/platform/nativeFileSystemAdapter').NativeFileSystemAdapter
  >;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { NativeFileSystemAdapter } = await import('@/core/platform/nativeFileSystemAdapter');
    adapter = new NativeFileSystemAdapter();
  });

  it('pickFile returns null on cancellation', async () => {
    mockFilePicker.pickFiles.mockRejectedValue(new Error('User cancelled the picker'));
    const result = await adapter.pickFile();
    expect(result).toBeNull();
  });

  it('pickFile propagates non-cancel errors', async () => {
    mockFilePicker.pickFiles.mockRejectedValue(new Error('Storage access denied'));
    await expect(adapter.pickFile()).rejects.toThrow('Storage access denied');
  });

  it('saveFileAs handles share cancellation gracefully', async () => {
    mockFilesystem.writeFile.mockResolvedValue({ uri: 'file:///test' });
    mockShare.share.mockRejectedValue(new Error('Share cancelled'));

    // Should not throw — file was saved, share just cancelled
    const result = await adapter.saveFileAs(new Uint8Array(), 'test.archc');
    expect(result).not.toBeNull();
  });

  it('pickFile returns null when picked file has no path', async () => {
    mockFilePicker.pickFiles.mockResolvedValue({
      files: [
        {
          name: 'test.archc',
          mimeType: 'application/octet-stream',
          size: 100,
          // No path field
        },
      ],
    });

    const result = await adapter.pickFile();
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. Documentation quality
// ═══════════════════════════════════════════════════════════════════

describe('Feature #279: NativeFileSystemAdapter — Documentation', () => {
  it('has module-level JSDoc describing Capacitor plugin usage', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('@capawesome/capacitor-file-picker');
    expect(src).toContain('@capacitor/filesystem');
    expect(src).toContain('@capacitor/share');
  });

  it('each method has a JSDoc comment', () => {
    const src = readSource(NATIVE_ADAPTER);
    // Count method-level JSDoc comments (not module-level)
    const methodDocs = src.match(/\/\*\*[\s\S]*?\*\/\s*async\s/g) || [];
    expect(methodDocs.length).toBeGreaterThanOrEqual(4); // pickFile, saveFile, saveFileAs, shareFile
  });

  it('documents the base64 encoding approach', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('base64');
  });
});

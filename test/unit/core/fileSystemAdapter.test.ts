/**
 * Tests for the FileSystemAdapter interface and implementations.
 *
 * Feature #278: FileSystemAdapter interface with web and native implementations
 *
 * Tests the adapter interface, WebFileSystemAdapter (with mocked File System
 * Access API), NativeFileSystemAdapter stub, and the getFileSystemAdapter factory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Mock @capacitor/core for the factory's isNative() check ──────

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));

import { Capacitor } from '@capacitor/core';

const mockCapacitor = Capacitor as unknown as {
  isNativePlatform: ReturnType<typeof vi.fn>;
  getPlatform: ReturnType<typeof vi.fn>;
};

// ─── Source file paths for structure verification ─────────────────

const SRC_DIR = path.resolve(__dirname, '../../../src/core/platform');
const ADAPTER_INTERFACE = path.join(SRC_DIR, 'fileSystemAdapter.ts');
const WEB_ADAPTER = path.join(SRC_DIR, 'webFileSystemAdapter.ts');
const NATIVE_ADAPTER = path.join(SRC_DIR, 'nativeFileSystemAdapter.ts');

// ─── Helpers ──────────────────────────────────────────────────────

function readSource(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/** Create a mock FileSystemFileHandle. */
function createMockFileHandle(
  name: string,
  content: Uint8Array,
): FileSystemFileHandle {
  const mockWritable = {
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    name,
    kind: 'file' as const,
    getFile: vi.fn().mockResolvedValue({
      name,
      arrayBuffer: vi.fn().mockResolvedValue(content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength,
      )),
    }),
    createWritable: vi.fn().mockResolvedValue(mockWritable),
  } as unknown as FileSystemFileHandle;
}

// ═══════════════════════════════════════════════════════════════════
// 1. Source Structure Verification
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: FileSystemAdapter — Source structure', () => {
  it('fileSystemAdapter.ts exists', () => {
    expect(fs.existsSync(ADAPTER_INTERFACE)).toBe(true);
  });

  it('webFileSystemAdapter.ts exists', () => {
    expect(fs.existsSync(WEB_ADAPTER)).toBe(true);
  });

  it('nativeFileSystemAdapter.ts exists', () => {
    expect(fs.existsSync(NATIVE_ADAPTER)).toBe(true);
  });

  it('interface exports FileSystemAdapter', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export interface FileSystemAdapter');
  });

  it('interface exports PickFileResult', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export interface PickFileResult');
  });

  it('interface exports SaveFileResult', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export interface SaveFileResult');
  });

  it('interface exports SaveFileAsResult', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export interface SaveFileAsResult');
  });

  it('interface exports getFileSystemAdapter factory', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export async function getFileSystemAdapter');
  });

  it('interface exports _resetFileSystemAdapter for testing', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export function _resetFileSystemAdapter');
  });

  it('WebFileSystemAdapter implements FileSystemAdapter', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('implements FileSystemAdapter');
    expect(src).toContain('class WebFileSystemAdapter');
  });

  it('NativeFileSystemAdapter implements FileSystemAdapter', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('implements FileSystemAdapter');
    expect(src).toContain('class NativeFileSystemAdapter');
  });

  it('factory uses isNative() from platformBridge', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain("import { isNative } from './platformBridge'");
    expect(src).toContain('isNative()');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. FileSystemAdapter Interface Methods
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: FileSystemAdapter — Interface compliance', () => {
  it('interface declares pickFile method', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toMatch(/pickFile\(\):\s*Promise<PickFileResult\s*\|\s*null>/);
  });

  it('interface declares saveFile method', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toMatch(/saveFile\(data:\s*Uint8Array,\s*handle\?:\s*unknown\):\s*Promise<SaveFileResult>/);
  });

  it('interface declares saveFileAs method', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toMatch(/saveFileAs\(data:\s*Uint8Array,\s*suggestedName:\s*string\):\s*Promise<SaveFileAsResult\s*\|\s*null>/);
  });

  it('interface declares shareFile method', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toMatch(/shareFile\(data:\s*Uint8Array\s*\|\s*string,\s*filename:\s*string,\s*mimeType:\s*string\):\s*Promise<void>/);
  });

  it('PickFileResult has data, name, and optional handle', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('data: Uint8Array');
    expect(src).toContain('name: string');
    expect(src).toContain('handle?: unknown');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. WebFileSystemAdapter — File System Access API path
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: WebFileSystemAdapter — File System Access API', () => {
  let adapter: InstanceType<typeof import('@/core/platform/webFileSystemAdapter').WebFileSystemAdapter>;

  beforeEach(async () => {
    const { WebFileSystemAdapter } = await import('@/core/platform/webFileSystemAdapter');
    adapter = new WebFileSystemAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up any window properties we set
    delete (window as any).showOpenFilePicker;
    delete (window as any).showSaveFilePicker;
  });

  // ─── pickFile with FSA ──────────────────────────────────────

  it('pickFile uses showOpenFilePicker when available', async () => {
    const testData = new Uint8Array([1, 2, 3, 4]);
    const mockHandle = createMockFileHandle('test.archc', testData);

    (window as any).showOpenFilePicker = vi.fn().mockResolvedValue([mockHandle]);

    const result = await adapter.pickFile();

    expect(window.showOpenFilePicker).toHaveBeenCalledWith({
      types: [
        {
          description: 'ArchCanvas Files',
          accept: { 'application/octet-stream': ['.archc'] },
        },
      ],
      multiple: false,
    });
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(testData);
    expect(result!.name).toBe('test.archc');
    expect(result!.handle).toBe(mockHandle);
  });

  it('pickFile returns null when user cancels FSA picker', async () => {
    const abortError = new DOMException('User cancelled', 'AbortError');
    (window as any).showOpenFilePicker = vi.fn().mockRejectedValue(abortError);

    const result = await adapter.pickFile();
    expect(result).toBeNull();
  });

  it('pickFile re-throws non-abort errors from FSA', async () => {
    const otherError = new Error('Permission denied');
    (window as any).showOpenFilePicker = vi.fn().mockRejectedValue(otherError);

    await expect(adapter.pickFile()).rejects.toThrow('Permission denied');
  });

  // ─── saveFile with FSA ─────────────────────────────────────

  it('saveFile writes to existing file handle', async () => {
    const testData = new Uint8Array([10, 20, 30]);
    const mockHandle = createMockFileHandle('project.archc', new Uint8Array());

    // Make FSA available
    (window as any).showOpenFilePicker = vi.fn();

    const result = await adapter.saveFile(testData, mockHandle);

    expect(mockHandle.createWritable).toHaveBeenCalled();
    const writable = await mockHandle.createWritable();
    // The writable was created in the adapter call; verify the handle is returned
    expect(result.handle).toBe(mockHandle);
  });

  // ─── saveFileAs with FSA ───────────────────────────────────

  it('saveFileAs uses showSaveFilePicker when available', async () => {
    const testData = new Uint8Array([5, 6, 7, 8]);
    const mockWritable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const mockHandle = {
      name: 'chosen-name.archc',
      createWritable: vi.fn().mockResolvedValue(mockWritable),
    };

    (window as any).showOpenFilePicker = vi.fn(); // Make FSA "available"
    (window as any).showSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);

    const result = await adapter.saveFileAs(testData, 'suggested.archc');

    expect(window.showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: 'suggested.archc',
      types: [
        {
          description: 'ArchCanvas Files',
          accept: { 'application/octet-stream': ['.archc'] },
        },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.handle).toBe(mockHandle);
    expect(result!.fileName).toBe('chosen-name.archc');
    expect(mockWritable.write).toHaveBeenCalledWith(testData);
    expect(mockWritable.close).toHaveBeenCalled();
  });

  it('saveFileAs returns null when user cancels FSA picker', async () => {
    const abortError = new DOMException('User cancelled', 'AbortError');
    (window as any).showOpenFilePicker = vi.fn();
    (window as any).showSaveFilePicker = vi.fn().mockRejectedValue(abortError);

    const result = await adapter.saveFileAs(new Uint8Array(), 'test.archc');
    expect(result).toBeNull();
  });

  it('saveFileAs re-throws non-abort errors from FSA', async () => {
    const otherError = new Error('Disk full');
    (window as any).showOpenFilePicker = vi.fn();
    (window as any).showSaveFilePicker = vi.fn().mockRejectedValue(otherError);

    await expect(adapter.saveFileAs(new Uint8Array(), 'test.archc')).rejects.toThrow('Disk full');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. WebFileSystemAdapter — Fallback (no File System Access API)
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: WebFileSystemAdapter — Fallback (no FSA)', () => {
  let adapter: InstanceType<typeof import('@/core/platform/webFileSystemAdapter').WebFileSystemAdapter>;

  beforeEach(async () => {
    // Ensure no File System Access API
    delete (window as any).showOpenFilePicker;
    delete (window as any).showSaveFilePicker;

    const { WebFileSystemAdapter } = await import('@/core/platform/webFileSystemAdapter');
    adapter = new WebFileSystemAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pickFile falls back to input element when no FSA', async () => {
    // We can't easily test the input element flow in jsdom, but we can verify
    // the source code uses the fallback path
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('pickFileViaInput');
    expect(src).toContain("input.type = 'file'");
    expect(src).toContain("input.accept = '.archc'");
  });

  it('saveFile falls back to blob download when no handle', async () => {
    // Mock DOM methods for blob download
    const mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el as any);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await adapter.saveFile(new Uint8Array([1, 2, 3]));

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toBe('architecture.archc');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('saveFileAs falls back to blob download when no FSA', async () => {
    const mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el as any);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url-2');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const result = await adapter.saveFileAs(new Uint8Array([4, 5, 6]), 'my-arch.archc');

    expect(result).not.toBeNull();
    expect(result!.fileName).toBe('my-arch.archc');
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toBe('my-arch.archc');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. WebFileSystemAdapter — shareFile
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: WebFileSystemAdapter — shareFile', () => {
  let adapter: InstanceType<typeof import('@/core/platform/webFileSystemAdapter').WebFileSystemAdapter>;

  beforeEach(async () => {
    const { WebFileSystemAdapter } = await import('@/core/platform/webFileSystemAdapter');
    adapter = new WebFileSystemAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up navigator mocks
    delete (navigator as any).share;
    delete (navigator as any).canShare;
  });

  it('shareFile falls back to download when Web Share API not available', async () => {
    delete (navigator as any).share;
    delete (navigator as any).canShare;

    const mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el as any);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:share-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await adapter.shareFile(new Uint8Array([1]), 'arch.archc', 'application/octet-stream');

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toBe('arch.archc');
  });

  it('shareFile accepts string data', async () => {
    delete (navigator as any).share;
    delete (navigator as any).canShare;

    const mockLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el as any);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:share-url-2');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await adapter.shareFile('# Summary\ntest', 'summary.md', 'text/markdown');

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toBe('summary.md');
  });

  it('shareFile source handles Web Share API', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('navigator.share');
    expect(src).toContain('navigator.canShare');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. NativeFileSystemAdapter — Stub behavior
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: NativeFileSystemAdapter — Stub', () => {
  let adapter: InstanceType<typeof import('@/core/platform/nativeFileSystemAdapter').NativeFileSystemAdapter>;

  beforeEach(async () => {
    const { NativeFileSystemAdapter } = await import('@/core/platform/nativeFileSystemAdapter');
    adapter = new NativeFileSystemAdapter();
  });

  it('pickFile throws not-yet-implemented error', async () => {
    await expect(adapter.pickFile()).rejects.toThrow('not yet implemented');
  });

  it('saveFile throws not-yet-implemented error', async () => {
    await expect(adapter.saveFile(new Uint8Array())).rejects.toThrow('not yet implemented');
  });

  it('saveFileAs throws not-yet-implemented error', async () => {
    await expect(adapter.saveFileAs(new Uint8Array(), 'test.archc')).rejects.toThrow('not yet implemented');
  });

  it('shareFile throws not-yet-implemented error', async () => {
    await expect(adapter.shareFile(new Uint8Array(), 'test.archc', 'application/octet-stream')).rejects.toThrow('not yet implemented');
  });

  it('stub mentions @capacitor/filesystem in error messages', async () => {
    try {
      await adapter.pickFile();
    } catch (err: any) {
      expect(err.message).toContain('@capacitor/filesystem');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. getFileSystemAdapter Factory
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: getFileSystemAdapter factory', () => {
  beforeEach(async () => {
    // Reset the cached adapter before each test
    const { _resetFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
    _resetFileSystemAdapter();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { _resetFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
    _resetFileSystemAdapter();
  });

  it('returns WebFileSystemAdapter when isNative() is false', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(false);

    const { getFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
    const adapter = await getFileSystemAdapter();

    // Should be a WebFileSystemAdapter instance (has the private methods)
    expect(adapter).toBeDefined();
    expect(typeof adapter.pickFile).toBe('function');
    expect(typeof adapter.saveFile).toBe('function');
    expect(typeof adapter.saveFileAs).toBe('function');
    expect(typeof adapter.shareFile).toBe('function');

    // Verify it's not the native adapter (native adapter throws)
    // Web adapter won't throw on construction
    expect(adapter.constructor.name).toBe('WebFileSystemAdapter');
  });

  it('returns NativeFileSystemAdapter when isNative() is true', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true);

    const { getFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
    const adapter = await getFileSystemAdapter();

    expect(adapter).toBeDefined();
    expect(adapter.constructor.name).toBe('NativeFileSystemAdapter');
  });

  it('caches the adapter on subsequent calls', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(false);

    const { getFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
    const adapter1 = await getFileSystemAdapter();
    const adapter2 = await getFileSystemAdapter();

    expect(adapter1).toBe(adapter2); // Same instance
  });

  it('_resetFileSystemAdapter clears the cache', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(false);

    const { getFileSystemAdapter, _resetFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');

    const adapter1 = await getFileSystemAdapter();
    _resetFileSystemAdapter();
    const adapter2 = await getFileSystemAdapter();

    // Different instances after reset
    expect(adapter1).not.toBe(adapter2);
  });

  it('factory uses dynamic import for lazy loading', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain("await import('./nativeFileSystemAdapter')");
    expect(src).toContain("await import('./webFileSystemAdapter')");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. WebFileSystemAdapter — Source code verification
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: WebFileSystemAdapter — Source verification', () => {
  it('preserves .archc file type filter for open picker', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain("'ArchCanvas Files'");
    expect(src).toContain("'.archc'");
  });

  it('uses showOpenFilePicker with multiple: false', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('multiple: false');
  });

  it('uses showSaveFilePicker with suggestedName parameter', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('suggestedName');
    expect(src).toContain('showSaveFilePicker');
  });

  it('handles AbortError for cancelled pickers', () => {
    const src = readSource(WEB_ADAPTER);
    const abortCount = (src.match(/AbortError/g) || []).length;
    expect(abortCount).toBeGreaterThanOrEqual(2); // open + save as
  });

  it('implements blob download fallback', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('URL.createObjectURL');
    expect(src).toContain('URL.revokeObjectURL');
    expect(src).toContain('a.download');
  });

  it('implements hidden input fallback for file open', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain("input.type = 'file'");
    expect(src).toContain('input.click()');
  });

  it('has hasFileSystemAccess() check method', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('hasFileSystemAccess');
    expect(src).toContain("'showOpenFilePicker' in window");
  });

  it('imports from fileSystemAdapter interface', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain("from './fileSystemAdapter'");
  });
});

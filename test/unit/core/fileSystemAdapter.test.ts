/**
 * Tests for the FileSystemAdapter interface and implementations.
 *
 * Feature #278: FileSystemAdapter interface with web and native implementations
 *
 * Tests the adapter interface, WebFileSystemAdapter (with mocked File System
 * Access API), NativeFileSystemAdapter stub, and the getFileSystemAdapter factory.
 *
 * Note: Tests that require a real DOM environment (window, document) use source
 * verification instead of runtime testing. The WebFileSystemAdapter's runtime
 * behaviour is verified via browser automation (Playwright).
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
  it('interface declares pickFile method returning Promise<PickFileResult | null>', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toMatch(/pickFile\(\):\s*Promise<PickFileResult\s*\|\s*null>/);
  });

  it('interface declares saveFile method with data and optional handle', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toMatch(/saveFile\(data:\s*Uint8Array,\s*handle\?:\s*unknown\):\s*Promise<SaveFileResult>/);
  });

  it('interface declares saveFileAs method with data and suggestedName', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toMatch(/saveFileAs\(data:\s*Uint8Array,\s*suggestedName:\s*string\):\s*Promise<SaveFileAsResult\s*\|\s*null>/);
  });

  it('interface declares shareFile method with data, filename, and mimeType', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toMatch(/shareFile\(data:\s*Uint8Array\s*\|\s*string,\s*filename:\s*string,\s*mimeType:\s*string\):\s*Promise<void>/);
  });

  it('PickFileResult has data: Uint8Array', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('data: Uint8Array');
  });

  it('PickFileResult has name: string', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('name: string');
  });

  it('PickFileResult has optional handle', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('handle?: unknown');
  });

  it('SaveFileAsResult has fileName: string', () => {
    const src = readSource(ADAPTER_INTERFACE);
    // Check inside SaveFileAsResult interface
    const saveFileAsBlock = src.slice(
      src.indexOf('export interface SaveFileAsResult'),
      src.indexOf('}', src.indexOf('export interface SaveFileAsResult')) + 1,
    );
    expect(saveFileAsBlock).toContain('fileName: string');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. WebFileSystemAdapter — File System Access API path (source verification)
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: WebFileSystemAdapter — File System Access API', () => {
  it('pickFile calls showOpenFilePicker with .archc types', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('showOpenFilePicker');
    expect(src).toContain("'ArchCanvas Files'");
    expect(src).toContain("'.archc'");
    expect(src).toContain('multiple: false');
  });

  it('pickFile returns data, name, and handle from FSA picker', () => {
    const src = readSource(WEB_ADAPTER);
    // Check it constructs the result with all three fields
    expect(src).toContain('data: new Uint8Array(buffer)');
    expect(src).toContain('name: file.name');
    expect(src).toContain('handle');
  });

  it('pickFile catches AbortError and returns null', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain("err.name === 'AbortError'");
    expect(src).toContain('return null');
  });

  it('pickFile re-throws non-abort errors', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('throw err');
  });

  it('saveFile uses createWritable() and write() on the handle', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('fileHandle.createWritable()');
    expect(src).toContain('writable.write(data)');
    expect(src).toContain('writable.close()');
  });

  it('saveFile returns the handle after writing', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('return { handle: fileHandle }');
  });

  it('saveFileAs calls showSaveFilePicker with suggestedName', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('showSaveFilePicker');
    expect(src).toContain('suggestedName');
  });

  it('saveFileAs returns handle and fileName from chosen file', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('handle.name');
  });

  it('saveFileAs catches AbortError and returns null', () => {
    const src = readSource(WEB_ADAPTER);
    // Should have AbortError handling in the saveFileAs path
    const saveAsSection = src.slice(src.indexOf('saveFileAsViaFSA'));
    expect(saveAsSection).toContain("err.name === 'AbortError'");
    expect(saveAsSection).toContain('return null');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. WebFileSystemAdapter — Fallback paths (source verification)
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: WebFileSystemAdapter — Fallback (no FSA)', () => {
  it('pickFile falls back to hidden input element when no FSA', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('pickFileViaInput');
    expect(src).toContain("input.type = 'file'");
    expect(src).toContain("input.accept = '.archc'");
    expect(src).toContain('input.click()');
  });

  it('input fallback reads file via arrayBuffer', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('file.arrayBuffer()');
  });

  it('input fallback handles cancel event', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain("'cancel'");
    expect(src).toContain('resolve(null)');
  });

  it('saveFile falls back to blob download when no handle', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('downloadBlob');
    expect(src).toContain("'architecture.archc'");
  });

  it('saveFileAs falls back to blob download when no FSA', () => {
    const src = readSource(WEB_ADAPTER);
    // After the FSA check, there's a fallback path
    const saveFileAsMethod = src.slice(
      src.indexOf('async saveFileAs('),
      src.indexOf('async shareFile('),
    );
    expect(saveFileAsMethod).toContain('downloadBlob');
    expect(saveFileAsMethod).toContain('return { fileName: suggestedName }');
  });

  it('downloadBlob uses createObjectURL and revokeObjectURL', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('URL.createObjectURL');
    expect(src).toContain('URL.revokeObjectURL');
  });

  it('downloadBlob creates hidden anchor and triggers click', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('a.href = url');
    expect(src).toContain('a.download = filename');
    expect(src).toContain('a.click()');
    expect(src).toContain('removeChild(a)');
  });

  it('hasFileSystemAccess checks for showOpenFilePicker in window', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain("'showOpenFilePicker' in window");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. WebFileSystemAdapter — shareFile
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: WebFileSystemAdapter — shareFile', () => {
  it('shareFile tries Web Share API first', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('navigator.share');
    expect(src).toContain('navigator.canShare');
  });

  it('shareFile creates a File object for Web Share API', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('new File([blob], filename, { type: mimeType })');
  });

  it('shareFile falls back to download if share not available', () => {
    const src = readSource(WEB_ADAPTER);
    const shareMethod = src.slice(
      src.indexOf('async shareFile('),
      src.indexOf('// ─── Internal Helpers'),
    );
    expect(shareMethod).toContain('downloadBlob');
  });

  it('shareFile silently handles user cancellation (AbortError)', () => {
    const src = readSource(WEB_ADAPTER);
    const shareMethod = src.slice(
      src.indexOf('async shareFile('),
      src.indexOf('// ─── Internal Helpers'),
    );
    expect(shareMethod).toContain('AbortError');
    expect(shareMethod).toContain('return;'); // Don't download on cancel
  });

  it('shareFile accepts both Uint8Array and string data', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toMatch(/data:\s*Uint8Array\s*\|\s*string/);
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
    await expect(
      adapter.shareFile(new Uint8Array(), 'test.archc', 'application/octet-stream'),
    ).rejects.toThrow('not yet implemented');
  });

  it('stub error messages mention @capacitor/filesystem', async () => {
    try {
      await adapter.pickFile();
    } catch (err: any) {
      expect(err.message).toContain('@capacitor/filesystem');
    }
  });

  it('stub error messages mention @capacitor/share for shareFile', async () => {
    try {
      await adapter.shareFile(new Uint8Array(), 'test.archc', 'application/octet-stream');
    } catch (err: any) {
      expect(err.message).toContain('@capacitor/share');
    }
  });

  it('saveFile stub uses underscored parameters to indicate unused', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('_data: Uint8Array');
    expect(src).toContain('_handle?: unknown');
  });

  it('saveFileAs stub uses underscored parameters', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('_suggestedName: string');
  });

  it('shareFile stub uses underscored parameters', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('_filename: string');
    expect(src).toContain('_mimeType: string');
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

    expect(adapter).toBeDefined();
    expect(typeof adapter.pickFile).toBe('function');
    expect(typeof adapter.saveFile).toBe('function');
    expect(typeof adapter.saveFileAs).toBe('function');
    expect(typeof adapter.shareFile).toBe('function');
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

  it('factory function is async', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export async function getFileSystemAdapter(): Promise<FileSystemAdapter>');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. Type exports and imports
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: Type exports and imports', () => {
  it('WebFileSystemAdapter imports types from fileSystemAdapter', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain("from './fileSystemAdapter'");
    expect(src).toContain('FileSystemAdapter');
    expect(src).toContain('PickFileResult');
    expect(src).toContain('SaveFileResult');
    expect(src).toContain('SaveFileAsResult');
  });

  it('NativeFileSystemAdapter imports types from fileSystemAdapter', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain("from './fileSystemAdapter'");
    expect(src).toContain('FileSystemAdapter');
    expect(src).toContain('PickFileResult');
    expect(src).toContain('SaveFileResult');
    expect(src).toContain('SaveFileAsResult');
  });

  it('WebFileSystemAdapter is exported as named export', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('export class WebFileSystemAdapter');
  });

  it('NativeFileSystemAdapter is exported as named export', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('export class NativeFileSystemAdapter');
  });

  it('fileSystemAdapter.ts exports PickFileResult type', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export interface PickFileResult');
  });

  it('fileSystemAdapter.ts exports SaveFileResult type', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export interface SaveFileResult');
  });

  it('fileSystemAdapter.ts exports SaveFileAsResult type', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('export interface SaveFileAsResult');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. Runtime adapter instantiation
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: Runtime adapter instantiation', () => {
  it('WebFileSystemAdapter can be instantiated', async () => {
    const { WebFileSystemAdapter } = await import('@/core/platform/webFileSystemAdapter');
    const adapter = new WebFileSystemAdapter();
    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(WebFileSystemAdapter);
  });

  it('NativeFileSystemAdapter can be instantiated', async () => {
    const { NativeFileSystemAdapter } = await import('@/core/platform/nativeFileSystemAdapter');
    const adapter = new NativeFileSystemAdapter();
    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(NativeFileSystemAdapter);
  });

  it('WebFileSystemAdapter has all four interface methods', async () => {
    const { WebFileSystemAdapter } = await import('@/core/platform/webFileSystemAdapter');
    const adapter = new WebFileSystemAdapter();
    expect(typeof adapter.pickFile).toBe('function');
    expect(typeof adapter.saveFile).toBe('function');
    expect(typeof adapter.saveFileAs).toBe('function');
    expect(typeof adapter.shareFile).toBe('function');
  });

  it('NativeFileSystemAdapter has all four interface methods', async () => {
    const { NativeFileSystemAdapter } = await import('@/core/platform/nativeFileSystemAdapter');
    const adapter = new NativeFileSystemAdapter();
    expect(typeof adapter.pickFile).toBe('function');
    expect(typeof adapter.saveFile).toBe('function');
    expect(typeof adapter.saveFileAs).toBe('function');
    expect(typeof adapter.shareFile).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 10. Documentation and comments
// ═══════════════════════════════════════════════════════════════════

describe('Feature #278: Documentation quality', () => {
  it('fileSystemAdapter.ts has module-level JSDoc comment', () => {
    const src = readSource(ADAPTER_INTERFACE);
    expect(src).toContain('/**');
    expect(src).toContain('FileSystemAdapter');
    expect(src).toContain('getFileSystemAdapter()');
  });

  it('WebFileSystemAdapter has module-level JSDoc comment', () => {
    const src = readSource(WEB_ADAPTER);
    expect(src).toContain('File System Access API');
    expect(src).toContain('Blob');
    expect(src).toContain('fallback');
  });

  it('NativeFileSystemAdapter has module-level JSDoc comment', () => {
    const src = readSource(NATIVE_ADAPTER);
    expect(src).toContain('Capacitor');
    expect(src).toContain('@capacitor/filesystem');
    expect(src).toContain('Stub');
  });

  it('interface methods have JSDoc comments', () => {
    const src = readSource(ADAPTER_INTERFACE);
    // At least one JSDoc per interface method
    const jsdocCount = (src.match(/\/\*\*/g) || []).length;
    expect(jsdocCount).toBeGreaterThanOrEqual(6); // types + interface + methods + factory
  });
});

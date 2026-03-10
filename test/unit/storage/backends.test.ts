// @vitest-environment happy-dom
/**
 * Tests for FileSystemAccessBackend, FileDownloadBackend, and createDefaultBackend factory.
 *
 * Since these backends depend on browser APIs (File System Access API, DOM elements),
 * we mock the relevant globals. The tests verify that each backend:
 * - Implements the StorageBackend interface correctly
 * - Has the correct type and capabilities
 * - Delegates to the appropriate browser APIs
 * - Handles user cancellation gracefully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileSystemAccessBackend } from '@/core/storage/backends/fileSystemAccess';
import { FileDownloadBackend } from '@/core/storage/backends/fileDownload';
import { createDefaultBackend } from '@/core/storage/backends/factory';
import type { StorageHandle } from '@/core/storage/types';

// ─── FileSystemAccessBackend ──────────────────────────────────────

describe('FileSystemAccessBackend', () => {
  let backend: FileSystemAccessBackend;

  beforeEach(() => {
    backend = new FileSystemAccessBackend();
  });

  it('has correct type and capabilities', () => {
    expect(backend.type).toBe('file-system-access');
    expect(backend.capabilities).toEqual({
      supportsDirectWrite: true,
      supportsLastModified: true,
    });
  });

  describe('read()', () => {
    it('reads bytes from a FileSystemFileHandle', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockFile = { arrayBuffer: vi.fn().mockResolvedValue(testData.buffer) };
      const mockFsHandle = { getFile: vi.fn().mockResolvedValue(mockFile), name: 'test.archc' };
      const handle: StorageHandle = {
        backend: 'file-system-access',
        name: 'test.archc',
        _internal: mockFsHandle,
      };

      const result = await backend.read(handle);

      expect(mockFsHandle.getFile).toHaveBeenCalled();
      expect(mockFile.arrayBuffer).toHaveBeenCalled();
      expect(result).toEqual(testData);
    });
  });

  describe('write()', () => {
    it('writes bytes via createWritable()', async () => {
      const testData = new Uint8Array([10, 20, 30]);
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockFsHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
        name: 'test.archc',
      };
      const handle: StorageHandle = {
        backend: 'file-system-access',
        name: 'test.archc',
        _internal: mockFsHandle,
      };

      const result = await backend.write(handle, testData);

      expect(mockFsHandle.createWritable).toHaveBeenCalled();
      expect(mockWritable.write).toHaveBeenCalledWith(testData);
      expect(mockWritable.close).toHaveBeenCalled();
      expect(result).toBe(handle);
    });
  });

  describe('openFilePicker()', () => {
    it('returns a handle when user picks a file', async () => {
      const mockFsHandle = { name: 'project.archc' };
      (window as Record<string, unknown>).showOpenFilePicker = vi.fn().mockResolvedValue([mockFsHandle]);

      const handle = await backend.openFilePicker();

      expect(handle).not.toBeNull();
      expect(handle!.backend).toBe('file-system-access');
      expect(handle!.name).toBe('project.archc');
      expect(handle!._internal).toBe(mockFsHandle);

      delete (window as Record<string, unknown>).showOpenFilePicker;
    });

    it('returns null when user cancels the picker', async () => {
      const abortError = new DOMException('User cancelled', 'AbortError');
      (window as Record<string, unknown>).showOpenFilePicker = vi.fn().mockRejectedValue(abortError);

      const handle = await backend.openFilePicker();

      expect(handle).toBeNull();

      delete (window as Record<string, unknown>).showOpenFilePicker;
    });

    it('rethrows non-AbortError exceptions', async () => {
      const otherError = new Error('Network failure');
      (window as Record<string, unknown>).showOpenFilePicker = vi.fn().mockRejectedValue(otherError);

      await expect(backend.openFilePicker()).rejects.toThrow('Network failure');

      delete (window as Record<string, unknown>).showOpenFilePicker;
    });

    it('passes accept options to the picker', async () => {
      const mockFsHandle = { name: 'test.archc' };
      const mockPicker = vi.fn().mockResolvedValue([mockFsHandle]);
      (window as Record<string, unknown>).showOpenFilePicker = mockPicker;

      await backend.openFilePicker({ accept: ['.archc', '.json'] });

      expect(mockPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          types: [
            {
              description: 'ArchCanvas Files',
              accept: { 'application/x-archcanvas': ['.archc', '.json'] },
            },
          ],
        }),
      );

      delete (window as Record<string, unknown>).showOpenFilePicker;
    });
  });

  describe('saveFilePicker()', () => {
    it('writes data and returns a handle', async () => {
      const testData = new Uint8Array([42, 43, 44]);
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockFsHandle = {
        name: 'saved.archc',
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      };
      (window as Record<string, unknown>).showSaveFilePicker = vi.fn().mockResolvedValue(mockFsHandle);

      const handle = await backend.saveFilePicker(testData, { suggestedName: 'myfile.archc' });

      expect(handle).not.toBeNull();
      expect(handle!.name).toBe('saved.archc');
      expect(mockWritable.write).toHaveBeenCalledWith(testData);
      expect(mockWritable.close).toHaveBeenCalled();

      delete (window as Record<string, unknown>).showSaveFilePicker;
    });

    it('returns null when user cancels the save picker', async () => {
      const abortError = new DOMException('User cancelled', 'AbortError');
      (window as Record<string, unknown>).showSaveFilePicker = vi.fn().mockRejectedValue(abortError);

      const handle = await backend.saveFilePicker(new Uint8Array([1]));

      expect(handle).toBeNull();

      delete (window as Record<string, unknown>).showSaveFilePicker;
    });

    it('uses suggestedName in the picker options', async () => {
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockFsHandle = {
        name: 'custom.archc',
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      };
      const mockPicker = vi.fn().mockResolvedValue(mockFsHandle);
      (window as Record<string, unknown>).showSaveFilePicker = mockPicker;

      await backend.saveFilePicker(new Uint8Array([1]), { suggestedName: 'custom.archc' });

      expect(mockPicker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: 'custom.archc',
        }),
      );

      delete (window as Record<string, unknown>).showSaveFilePicker;
    });
  });
});

// ─── FileDownloadBackend ──────────────────────────────────────────

describe('FileDownloadBackend', () => {
  let backend: FileDownloadBackend;

  beforeEach(() => {
    backend = new FileDownloadBackend();
  });

  it('has correct type and capabilities', () => {
    expect(backend.type).toBe('file-download');
    expect(backend.capabilities).toEqual({
      supportsDirectWrite: false,
      supportsLastModified: false,
    });
  });

  describe('read()', () => {
    it('reads bytes from a File object', async () => {
      const testData = new Uint8Array([7, 8, 9]);
      const file = new File([testData], 'test.archc', { type: 'application/octet-stream' });
      const handle: StorageHandle = {
        backend: 'file-download',
        name: 'test.archc',
        _internal: file,
      };

      const result = await backend.read(handle);

      expect(result).toEqual(testData);
    });
  });

  describe('write()', () => {
    it('triggers a download and returns the handle', async () => {
      // Mock DOM elements for download
      const mockAnchor = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockReturnValue(mockAnchor as unknown as Node);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockReturnValue(mockAnchor as unknown as Node);
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const testData = new Uint8Array([1, 2, 3]);
      const handle: StorageHandle = {
        backend: 'file-download',
        name: 'output.archc',
        _internal: new File([testData], 'output.archc'),
      };

      const result = await backend.write(handle, testData);

      expect(result).toBe(handle);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toBe('output.archc');

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('openFilePicker()', () => {
    it('creates an input element and returns handle when file is selected', async () => {
      const testData = new Uint8Array([42]);
      const mockFile = new File([testData], 'selected.archc', { type: 'application/octet-stream' });

      // Mock createElement to capture the input
      let capturedInput: HTMLInputElement | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'input') {
          const input = originalCreateElement('input') as HTMLInputElement;
          capturedInput = input;
          // Override click to simulate file selection
          Object.defineProperty(input, 'click', {
            value: () => {
              // Simulate file selection via onchange
              Object.defineProperty(input, 'files', {
                value: [mockFile],
                configurable: true,
              });
              input.onchange?.(new Event('change') as unknown as Parameters<NonNullable<typeof input.onchange>>[0]);
            },
          });
          return input;
        }
        return originalCreateElement(tag);
      });

      const handle = await backend.openFilePicker();

      expect(handle).not.toBeNull();
      expect(handle!.backend).toBe('file-download');
      expect(handle!.name).toBe('selected.archc');
      expect(handle!._internal).toBeInstanceOf(File);
      expect(capturedInput).not.toBeNull();
      expect(capturedInput!.type).toBe('file');
      expect(capturedInput!.accept).toBe('.archc');

      vi.restoreAllMocks();
    });

    it('returns null when user cancels', async () => {
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'input') {
          const input = originalCreateElement('input') as HTMLInputElement;
          Object.defineProperty(input, 'click', {
            value: () => {
              // Simulate cancellation (no files selected, dispatch cancel)
              input.dispatchEvent(new Event('cancel'));
            },
          });
          return input;
        }
        return originalCreateElement(tag);
      });

      const handle = await backend.openFilePicker();

      expect(handle).toBeNull();

      vi.restoreAllMocks();
    });
  });

  describe('saveFilePicker()', () => {
    it('downloads the file and returns a handle with File internal', async () => {
      // Mock DOM elements for download
      const mockAnchor = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
      vi.spyOn(document.body, 'appendChild').mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const testData = new Uint8Array([10, 20, 30]);

      const handle = await backend.saveFilePicker(testData, { suggestedName: 'export.archc' });

      expect(handle).not.toBeNull();
      expect(handle!.backend).toBe('file-download');
      expect(handle!.name).toBe('export.archc');
      expect(handle!._internal).toBeInstanceOf(File);

      vi.restoreAllMocks();
    });

    it('uses default filename when no suggestedName provided', async () => {
      const mockAnchor = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
      vi.spyOn(document.body, 'appendChild').mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(document.body, 'removeChild').mockReturnValue(mockAnchor as unknown as Node);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const handle = await backend.saveFilePicker(new Uint8Array([1]));

      expect(handle!.name).toBe('architecture.archc');
      expect(mockAnchor.download).toBe('architecture.archc');

      vi.restoreAllMocks();
    });
  });
});

// ─── createDefaultBackend factory ─────────────────────────────────

describe('createDefaultBackend', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns FileSystemAccessBackend when showOpenFilePicker is available', () => {
    // Add showOpenFilePicker to window to simulate Chrome/Edge
    (window as Record<string, unknown>).showOpenFilePicker = vi.fn();

    const backend = createDefaultBackend();

    expect(backend.type).toBe('file-system-access');
    expect(backend.capabilities.supportsDirectWrite).toBe(true);
    expect(backend.capabilities.supportsLastModified).toBe(true);

    delete (window as Record<string, unknown>).showOpenFilePicker;
  });

  it('returns FileDownloadBackend when showOpenFilePicker is not available', () => {
    // Ensure showOpenFilePicker does NOT exist on window
    delete (window as Record<string, unknown>).showOpenFilePicker;

    const backend = createDefaultBackend();

    expect(backend.type).toBe('file-download');
    expect(backend.capabilities.supportsDirectWrite).toBe(false);
    expect(backend.capabilities.supportsLastModified).toBe(false);
  });
});

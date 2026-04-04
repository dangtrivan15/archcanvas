import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFileSaver } from '@/platform/fileSaver';
import type { FileSaver } from '@/platform/fileSaver';

describe('createFileSaver', () => {
  it('returns the override when provided', () => {
    const mock: FileSaver = {
      saveBlob: vi.fn().mockResolvedValue(true),
      saveText: vi.fn().mockResolvedValue(true),
    };

    const saver = createFileSaver(mock);
    expect(saver).toBe(mock);
  });

  it('returns a WebFileSaver in non-Tauri environments', () => {
    // happy-dom doesn't define __TAURI_INTERNALS__
    const saver = createFileSaver();
    expect(saver).toBeDefined();
    expect(typeof saver.saveBlob).toBe('function');
    expect(typeof saver.saveText).toBe('function');
  });
});

describe('WebFileSaver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('saveText creates an anchor element for download when no File System Access API', async () => {
    // Ensure showSaveFilePicker is NOT available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).showSaveFilePicker;

    const saver = createFileSaver();

    // Mock URL.createObjectURL
    const mockUrl = 'blob:mock-url';
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    // Mock appendChild/removeChild/click
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    const result = await saver.saveText('hello world', {
      defaultName: 'test.md',
      mimeType: 'text/markdown',
    });

    expect(result).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();

    // The anchor element should have the correct attributes
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe('A');
    expect(anchor.download).toBe('test.md');
    expect(anchor.href).toContain(mockUrl);

    // Restore
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('saveBlob creates an anchor element for download when no File System Access API', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).showSaveFilePicker;

    const saver = createFileSaver();

    const mockUrl = 'blob:mock-url-2';
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    const blob = new Blob(['data'], { type: 'image/png' });
    const result = await saver.saveBlob(blob, {
      defaultName: 'test.png',
      mimeType: 'image/png',
    });

    expect(result).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);

    // Restore
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

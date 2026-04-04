import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('WebFileSaver — anchor download fallback', () => {
  const mockUrl = 'blob:mock-url';
  let origCreateObjectURL: typeof URL.createObjectURL;
  let origRevokeObjectURL: typeof URL.revokeObjectURL;
  let appendSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Ensure showSaveFilePicker is NOT available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).showSaveFilePicker;

    // Save and mock URL methods
    origCreateObjectURL = URL.createObjectURL;
    origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
  });

  afterEach(() => {
    // Always restore URL methods even if test throws
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('saveText creates an anchor element with correct attributes and triggers click', async () => {
    const saver = createFileSaver();

    const result = await saver.saveText('hello world', {
      defaultName: 'test.md',
      mimeType: 'text/markdown',
    });

    expect(result).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();

    // Verify anchor element attributes
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe('A');
    expect(anchor.download).toBe('test.md');
    expect(anchor.href).toContain(mockUrl);
  });

  it('saveBlob creates an anchor element for blob download', async () => {
    const saver = createFileSaver();
    const blob = new Blob(['data'], { type: 'image/png' });

    const result = await saver.saveBlob(blob, {
      defaultName: 'test.png',
      mimeType: 'image/png',
    });

    expect(result).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe('test.png');
  });

  it('saveText delegates to saveBlob internally', async () => {
    const saver = createFileSaver();

    await saver.saveText('content', {
      defaultName: 'doc.md',
      mimeType: 'text/markdown',
    });

    // URL.createObjectURL should receive a Blob with the text content
    const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
  });
});

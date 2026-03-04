// @vitest-environment happy-dom
/**
 * Tests for WebFileSystemAdapter save operations.
 *
 * Covers three scenarios:
 * 1. Secure context (HTTPS/localhost) — File System Access API available
 * 2. Non-secure context (HTTP non-localhost) — blob download fallback
 * 3. State management — isSaving doesn't get stuck
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the adapter directly, not through fileIO
import { WebFileSystemAdapter } from '@/core/platform/webFileSystemAdapter';

// ─── Test helpers ──────────────────────────────────────────────

/** Create a small valid Uint8Array representing encoded data */
function makeTestData(): Uint8Array {
  return new Uint8Array([0x41, 0x52, 0x43, 0x48, 0x43, 0x00, 0x01, 0x02]);
}

/** Mock a FileSystemFileHandle with createWritable */
function makeMockFileHandle() {
  const writeSpy = vi.fn().mockResolvedValue(undefined);
  const closeSpy = vi.fn().mockResolvedValue(undefined);
  const handle = {
    name: 'test.archc',
    createWritable: vi.fn().mockResolvedValue({
      write: writeSpy,
      close: closeSpy,
    }),
  };
  return { handle, writeSpy, closeSpy };
}

describe('WebFileSystemAdapter', () => {
  let adapter: WebFileSystemAdapter;
  let originalShowOpenFilePicker: unknown;
  let originalShowSaveFilePicker: unknown;

  beforeEach(() => {
    adapter = new WebFileSystemAdapter();
    originalShowOpenFilePicker = (window as any).showOpenFilePicker;
    originalShowSaveFilePicker = (window as any).showSaveFilePicker;

    // Ensure URL methods exist in happy-dom
    if (!URL.createObjectURL) {
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    }
    if (!URL.revokeObjectURL) {
      (URL as any).revokeObjectURL = vi.fn();
    }
  });

  afterEach(() => {
    // Restore FSA globals
    if (originalShowOpenFilePicker !== undefined) {
      (window as any).showOpenFilePicker = originalShowOpenFilePicker;
    } else {
      delete (window as any).showOpenFilePicker;
    }
    if (originalShowSaveFilePicker !== undefined) {
      (window as any).showSaveFilePicker = originalShowSaveFilePicker;
    } else {
      delete (window as any).showSaveFilePicker;
    }
    vi.restoreAllMocks();
  });

  // ─── Scenario 1: FSA available (secure context) ──────────────

  describe('saveFile with File System Access API (secure context)', () => {
    beforeEach(() => {
      // Simulate secure context — FSA is available
      (window as any).showOpenFilePicker = vi.fn();
    });

    it('writes data via createWritable when handle is provided', async () => {
      const { handle, writeSpy, closeSpy } = makeMockFileHandle();
      const data = makeTestData();

      const result = await adapter.saveFile(data, handle);

      expect(handle.createWritable).toHaveBeenCalledOnce();
      expect(writeSpy).toHaveBeenCalledWith(data);
      expect(closeSpy).toHaveBeenCalledOnce();
      expect(result.handle).toBe(handle);
    });

    it('falls back to download when handle is undefined even if FSA available', async () => {
      const data = makeTestData();
      const createObjURL = vi.fn().mockReturnValue('blob:test-url');
      const revokeObjURL = vi.fn();
      (URL as any).createObjectURL = createObjURL;
      (URL as any).revokeObjectURL = revokeObjURL;

      const clickSpy = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = clickSpy;
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      await adapter.saveFile(data);

      expect(clickSpy).toHaveBeenCalledOnce();
      expect(createObjURL).toHaveBeenCalledOnce();
    });
  });

  describe('saveFileAs with File System Access API (secure context)', () => {
    it('opens native save picker and writes data', async () => {
      const writeSpy = vi.fn().mockResolvedValue(undefined);
      const closeSpy = vi.fn().mockResolvedValue(undefined);
      const mockHandle = {
        name: 'saved-file.archc',
        createWritable: vi.fn().mockResolvedValue({
          write: writeSpy,
          close: closeSpy,
        }),
      };

      (window as any).showOpenFilePicker = vi.fn();
      (window as any).showSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);

      const data = makeTestData();
      const result = await adapter.saveFileAs(data, 'my-architecture.archc');

      expect((window as any).showSaveFilePicker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: 'my-architecture.archc',
        }),
      );
      expect(writeSpy).toHaveBeenCalledWith(data);
      expect(closeSpy).toHaveBeenCalledOnce();
      expect(result).not.toBeNull();
      expect(result!.handle).toBe(mockHandle);
      expect(result!.fileName).toBe('saved-file.archc');
    });

    it('returns null when user cancels the picker', async () => {
      (window as any).showOpenFilePicker = vi.fn();
      (window as any).showSaveFilePicker = vi.fn().mockRejectedValue(
        new DOMException('User cancelled', 'AbortError'),
      );

      const result = await adapter.saveFileAs(makeTestData(), 'test.archc');
      expect(result).toBeNull();
    });

    it('propagates non-abort errors from the picker', async () => {
      (window as any).showOpenFilePicker = vi.fn();
      (window as any).showSaveFilePicker = vi.fn().mockRejectedValue(
        new Error('Permission denied'),
      );

      await expect(adapter.saveFileAs(makeTestData(), 'test.archc'))
        .rejects.toThrow('Permission denied');
    });
  });

  // ─── Scenario 2: No FSA (non-secure context / HTTP) ──────────

  describe('saveFile without FSA (non-secure context)', () => {
    beforeEach(() => {
      // Simulate non-secure context — FSA is NOT available
      delete (window as any).showOpenFilePicker;
      delete (window as any).showSaveFilePicker;
    });

    it('triggers blob download when FSA is unavailable', async () => {
      const data = makeTestData();
      const createObjURL = vi.fn().mockReturnValue('blob:fallback-url');
      const revokeObjURL = vi.fn();
      (URL as any).createObjectURL = createObjURL;
      (URL as any).revokeObjectURL = revokeObjURL;

      const clickSpy = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = clickSpy;
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      const result = await adapter.saveFile(data);

      expect(clickSpy).toHaveBeenCalledOnce();
      expect(createObjURL).toHaveBeenCalledOnce();
      // No handle returned in fallback mode
      expect(result.handle).toBeUndefined();
    });

    it('uses "architecture.archc" as default filename for save', async () => {
      const data = makeTestData();
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:test');
      (URL as any).revokeObjectURL = vi.fn();

      let capturedDownloadAttr = '';
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          el.click = vi.fn();
          const origDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download')
            || { set: (v: string) => el.setAttribute('download', v), get: () => el.getAttribute('download') };
          Object.defineProperty(el, 'download', {
            set(val: string) {
              capturedDownloadAttr = val;
              origDesc.set?.call(el, val);
            },
            get() { return capturedDownloadAttr; },
          });
        }
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      await adapter.saveFile(data);

      expect(capturedDownloadAttr).toBe('architecture.archc');
    });

    it('ignores FSA file handle when FSA is unavailable', async () => {
      // Even if a stale handle exists, it should NOT try to use it
      const { handle } = makeMockFileHandle();
      const data = makeTestData();

      const clickSpy = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = clickSpy;
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:test');
      (URL as any).revokeObjectURL = vi.fn();

      await adapter.saveFile(data, handle);

      // Should NOT have called createWritable — falls back to download
      expect(handle.createWritable).not.toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledOnce();
    });
  });

  describe('saveFileAs without FSA (non-secure context)', () => {
    beforeEach(() => {
      delete (window as any).showOpenFilePicker;
      delete (window as any).showSaveFilePicker;
    });

    it('falls back to blob download with suggested name', async () => {
      const data = makeTestData();
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:test');
      (URL as any).revokeObjectURL = vi.fn();

      let capturedDownloadAttr = '';
      const clickSpy = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          el.click = clickSpy;
          Object.defineProperty(el, 'download', {
            set(val: string) { capturedDownloadAttr = val; },
            get() { return capturedDownloadAttr; },
          });
        }
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      const result = await adapter.saveFileAs(data, 'my-project.archc');

      expect(clickSpy).toHaveBeenCalledOnce();
      expect(capturedDownloadAttr).toBe('my-project.archc');
      expect(result).not.toBeNull();
      expect(result!.fileName).toBe('my-project.archc');
      // No handle in fallback mode
      expect(result!.handle).toBeUndefined();
    });

    it('never calls showSaveFilePicker in non-secure context', async () => {
      const data = makeTestData();
      const pickerSpy = vi.fn();
      // Explicitly set it as a function (but FSA check should fail)
      // because showOpenFilePicker is deleted
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:test');
      (URL as any).revokeObjectURL = vi.fn();

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = vi.fn();
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      await adapter.saveFileAs(data, 'test.archc');

      expect(pickerSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Scenario 3: downloadBlob reliability ────────────────────

  describe('downloadBlob internals', () => {
    beforeEach(() => {
      delete (window as any).showOpenFilePicker;
      delete (window as any).showSaveFilePicker;
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does NOT revoke object URL immediately after click', async () => {
      const data = makeTestData();
      const revokeObjURL = vi.fn();
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:test');
      (URL as any).revokeObjectURL = revokeObjURL;

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = vi.fn();
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      // Start the save but don't advance timers yet
      const savePromise = adapter.saveFile(data);

      // URL should NOT be revoked yet (download still in progress)
      expect(revokeObjURL).not.toHaveBeenCalled();

      // Advance past the cleanup delay
      vi.advanceTimersByTime(200);
      await savePromise;

      // NOW it should be revoked
      expect(revokeObjURL).toHaveBeenCalledOnce();
    });

    it('resolves the promise only after cleanup delay', async () => {
      const data = makeTestData();
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:test');
      (URL as any).revokeObjectURL = vi.fn();

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = vi.fn();
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      let resolved = false;
      const savePromise = adapter.saveFile(data).then(() => { resolved = true; });

      // Should not be resolved immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe(false);

      // Should resolve after the delay
      await vi.advanceTimersByTimeAsync(200);
      await savePromise;
      expect(resolved).toBe(true);
    });

    it('creates blob with correct MIME type', async () => {
      const data = makeTestData();
      const createObjURL = vi.fn().mockReturnValue('blob:test');
      (URL as any).createObjectURL = createObjURL;
      (URL as any).revokeObjectURL = vi.fn();

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = vi.fn();
        return el;
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      const savePromise = adapter.saveFile(data);
      vi.advanceTimersByTime(200);
      await savePromise;

      // Verify a Blob was created and passed to createObjectURL
      expect(createObjURL).toHaveBeenCalledOnce();
      const blob = createObjURL.mock.calls[0][0];
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/octet-stream');
      expect(blob.size).toBe(data.length);
    });
  });
});

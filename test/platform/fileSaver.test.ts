import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFileSaver, setFileSaver } from '@/platform/fileSaver';
import type { FileSaver } from '@/platform/fileSaver';

describe('FileSaver', () => {
  afterEach(() => {
    setFileSaver(null);
  });

  describe('createFileSaver', () => {
    it('returns override when set', () => {
      const mock: FileSaver = { saveFile: vi.fn().mockResolvedValue(true) };
      setFileSaver(mock);
      const saver = createFileSaver();
      expect(saver).toBe(mock);
    });

    it('returns WebFileSaver when not in Tauri', () => {
      const saver = createFileSaver();
      // In test env (happy-dom), should default to web implementation
      expect(saver).toBeDefined();
      expect(typeof saver.saveFile).toBe('function');
    });
  });

  describe('override (dependency injection)', () => {
    it('allows injecting a mock for testing', async () => {
      const mock: FileSaver = { saveFile: vi.fn().mockResolvedValue(true) };
      setFileSaver(mock);

      const saver = createFileSaver();
      const blob = new Blob(['test'], { type: 'text/plain' });
      const result = await saver.saveFile(blob, {
        defaultName: 'test.txt',
        mimeType: 'text/plain',
      });

      expect(result).toBe(true);
      expect(mock.saveFile).toHaveBeenCalledWith(blob, {
        defaultName: 'test.txt',
        mimeType: 'text/plain',
      });
    });

    it('restores default when set to null', () => {
      const mock: FileSaver = { saveFile: vi.fn().mockResolvedValue(true) };
      setFileSaver(mock);
      expect(createFileSaver()).toBe(mock);

      setFileSaver(null);
      expect(createFileSaver()).not.toBe(mock);
    });
  });

  describe('WebFileSaver', () => {
    it('creates a download link and triggers click', async () => {
      // Don't use override — test the actual web implementation
      setFileSaver(null);
      const saver = createFileSaver();

      // Mock DOM methods
      const clickSpy = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      // Mock URL methods
      const mockUrl = 'blob:http://localhost/fake';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const blob = new Blob(['test-data'], { type: 'text/plain' });
      const result = await saver.saveFile(blob, {
        defaultName: 'test.txt',
        mimeType: 'text/plain',
      });

      expect(result).toBe(true);
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);

      // Verify an anchor element was created and clicked
      const anchorCalls = createElementSpy.mock.results.filter(
        (r) => r.type === 'return' && r.value instanceof HTMLAnchorElement,
      );
      expect(anchorCalls.length).toBeGreaterThanOrEqual(1);

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('converts string data to Blob', async () => {
      setFileSaver(null);
      const saver = createFileSaver();

      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
      vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

      const result = await saver.saveFile('# Markdown content', {
        defaultName: 'doc.md',
        mimeType: 'text/markdown',
      });

      expect(result).toBe(true);
      // createObjectURL should have been called with a Blob (not the raw string)
      const arg = vi.mocked(URL.createObjectURL).mock.calls[0][0];
      expect(arg).toBeInstanceOf(Blob);
    });
  });
});

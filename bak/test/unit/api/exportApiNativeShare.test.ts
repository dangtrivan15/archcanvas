/**
 * Feature #295: Export PNG/SVG via native share sheet on iOS.
 *
 * Verifies that:
 * - On native (Capacitor iOS), exportToPng and exportToSvg use the
 *   FileSystemAdapter.shareFile() method (native share sheet) instead of
 *   the browser anchor download.
 * - On web, the existing Blob download behavior is preserved.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock platform bridge
const mockIsNative = vi.fn(() => false);
vi.mock('@/core/platform/platformBridge', () => ({
  isNative: () => mockIsNative(),
}));

// Mock file system adapter
const mockShareFile = vi.fn().mockResolvedValue(undefined);
const mockAdapter = {
  pickFile: vi.fn(),
  saveFile: vi.fn(),
  saveFileAs: vi.fn(),
  shareFile: mockShareFile,
};
vi.mock('@/core/platform/fileSystemAdapter', () => ({
  getFileSystemAdapter: vi.fn().mockResolvedValue(mockAdapter),
}));

// Mock html-to-image
const FAKE_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const FAKE_SVG_DATA_URL =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3C%2Fsvg%3E';

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue(FAKE_PNG_DATA_URL),
  toSvg: vi.fn().mockResolvedValue(FAKE_SVG_DATA_URL),
}));

// Provide a mock viewport element
function setupViewportElement(): HTMLElement {
  const viewport = document.createElement('div');
  viewport.className = 'react-flow__viewport';
  document.body.appendChild(viewport);
  return viewport;
}

function cleanupViewport(): void {
  const el = document.querySelector('.react-flow__viewport');
  if (el) el.remove();
}

describe('ExportApi native share sheet (Feature #295)', () => {
  let ExportApi: typeof import('@/api/exportApi').ExportApi;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIsNative.mockReturnValue(false);

    // Dynamically import to pick up the fresh mocks
    const mod = await import('@/api/exportApi');
    ExportApi = mod.ExportApi;

    setupViewportElement();
  });

  afterEach(() => {
    cleanupViewport();
  });

  // ─── PNG Export ──────────────────────────────────────────────

  describe('exportToPng', () => {
    it('on web: uses anchor download (existing behavior)', async () => {
      mockIsNative.mockReturnValue(false);
      const api = new ExportApi();

      // Mock appendChild/removeChild to track anchor usage
      const appendSpy = vi.spyOn(document.body, 'appendChild');
      const clickSpy = vi.fn();

      // Mock document.createElement for the anchor
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const result = await api.exportToPng('test-arch');
      expect(result).toBe(true);

      // Verify anchor download was used
      expect(clickSpy).toHaveBeenCalled();
      expect(appendSpy).toHaveBeenCalled();
      // Verify shareFile was NOT called
      expect(mockShareFile).not.toHaveBeenCalled();

      appendSpy.mockRestore();
      vi.mocked(document.createElement).mockRestore();
    });

    it('on native: uses adapter.shareFile with PNG binary data', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();

      const result = await api.exportToPng('my-diagram.archc');
      expect(result).toBe(true);

      // Verify shareFile was called
      expect(mockShareFile).toHaveBeenCalledTimes(1);
      const [data, filename, mimeType] = mockShareFile.mock.calls[0]!;

      // Should be Uint8Array (binary PNG data decoded from base64)
      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);

      // Filename should strip .archc and add .png
      expect(filename).toBe('my-diagram.png');
      expect(mimeType).toBe('image/png');
    });

    it('on native: strips .archc and .png extensions from filename', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();

      await api.exportToPng('project.archc');
      expect(mockShareFile.mock.calls[0]![1]).toBe('project.png');

      mockShareFile.mockClear();
      await api.exportToPng('already.png');
      expect(mockShareFile.mock.calls[0]![1]).toBe('already.png');
    });

    it('returns false when viewport is missing', async () => {
      cleanupViewport(); // remove viewport
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();
      const result = await api.exportToPng('test');
      expect(result).toBe(false);
      expect(mockShareFile).not.toHaveBeenCalled();
    });
  });

  // ─── SVG Export ──────────────────────────────────────────────

  describe('exportToSvg', () => {
    it('on web: uses blob download (existing behavior)', async () => {
      mockIsNative.mockReturnValue(false);
      const api = new ExportApi();

      const appendSpy = vi.spyOn(document.body, 'appendChild');
      const clickSpy = vi.fn();
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const result = await api.exportToSvg('test-arch');
      expect(result).toBe(true);

      expect(clickSpy).toHaveBeenCalled();
      expect(appendSpy).toHaveBeenCalled();
      expect(mockShareFile).not.toHaveBeenCalled();

      appendSpy.mockRestore();
      vi.mocked(document.createElement).mockRestore();
    });

    it('on native: uses adapter.shareFile with SVG text', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();

      const result = await api.exportToSvg('my-diagram.archc');
      expect(result).toBe(true);

      expect(mockShareFile).toHaveBeenCalledTimes(1);
      const [data, filename, mimeType] = mockShareFile.mock.calls[0]!;

      // SVG is shared as text (string), not binary
      expect(typeof data).toBe('string');
      expect(data).toContain('<svg');

      expect(filename).toBe('my-diagram.svg');
      expect(mimeType).toBe('image/svg+xml');
    });

    it('on native: strips .archc and .svg extensions from filename', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();

      await api.exportToSvg('project.archc');
      expect(mockShareFile.mock.calls[0]![1]).toBe('project.svg');

      mockShareFile.mockClear();
      await api.exportToSvg('already.svg');
      expect(mockShareFile.mock.calls[0]![1]).toBe('already.svg');
    });

    it('returns false when viewport is missing', async () => {
      cleanupViewport();
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();
      const result = await api.exportToSvg('test');
      expect(result).toBe(false);
      expect(mockShareFile).not.toHaveBeenCalled();
    });
  });

  // ─── Error handling ──────────────────────────────────────────

  describe('error handling', () => {
    it('exportToPng catches shareFile errors and returns false', async () => {
      mockIsNative.mockReturnValue(true);
      mockShareFile.mockRejectedValueOnce(new Error('Share cancelled'));
      const api = new ExportApi();

      const result = await api.exportToPng('test');
      expect(result).toBe(false);
    });

    it('exportToSvg catches shareFile errors and returns false', async () => {
      mockIsNative.mockReturnValue(true);
      mockShareFile.mockRejectedValueOnce(new Error('Share cancelled'));
      const api = new ExportApi();

      const result = await api.exportToSvg('test');
      expect(result).toBe(false);
    });
  });

  // ─── Platform branching logic ────────────────────────────────

  describe('platform branching', () => {
    it('isNative() determines which export path is used for PNG', async () => {
      const api = new ExportApi();

      // Web path
      mockIsNative.mockReturnValue(false);
      await api.exportToPng('test');
      expect(mockShareFile).not.toHaveBeenCalled();

      // Native path
      mockIsNative.mockReturnValue(true);
      await api.exportToPng('test');
      expect(mockShareFile).toHaveBeenCalledTimes(1);
    });

    it('isNative() determines which export path is used for SVG', async () => {
      const api = new ExportApi();

      // Web path
      mockIsNative.mockReturnValue(false);
      await api.exportToSvg('test');
      expect(mockShareFile).not.toHaveBeenCalled();

      // Native path
      mockIsNative.mockReturnValue(true);
      await api.exportToSvg('test');
      expect(mockShareFile).toHaveBeenCalledTimes(1);
    });
  });
});

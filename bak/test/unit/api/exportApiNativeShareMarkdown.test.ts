/**
 * Feature #296: Mermaid and markdown export via share sheet on iOS.
 *
 * Verifies that:
 * - On native (Capacitor iOS), exportToMarkdown and exportToMermaid use the
 *   FileSystemAdapter.shareFile() method (native share sheet) instead of
 *   the browser Blob download.
 * - On web, the existing Blob download behavior is used.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ArchGraph } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

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

// Mock html-to-image (required by exportApi even if not used by markdown/mermaid)
vi.mock('html-to-image', () => ({
  toPng: vi.fn(),
  toSvg: vi.fn(),
}));

function makeGraph(overrides?: Partial<ArchGraph>): ArchGraph {
  return {
    name: overrides?.name ?? 'Test Architecture',
    description: overrides?.description ?? 'A test graph',
    owners: overrides?.owners ?? ['Team A'],
    nodes: overrides?.nodes ?? [
      {
        id: generateId(),
        type: 'compute/service',
        displayName: 'API Server',
        args: { language: 'TypeScript' },
        codeRefs: [],
        notes: [],
        properties: {},
        position: { x: 0, y: 0, width: 200, height: 100 },
        children: [],
      },
    ],
    edges: overrides?.edges ?? [],
  };
}

describe('ExportApi markdown/mermaid native share (Feature #296)', () => {
  let ExportApi: typeof import('@/api/exportApi').ExportApi;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIsNative.mockReturnValue(false);

    const mod = await import('@/api/exportApi');
    ExportApi = mod.ExportApi;
  });

  // ─── Markdown Export ─────────────────────────────────────────

  describe('exportToMarkdown', () => {
    it('on web: creates a blob download with .md extension', async () => {
      mockIsNative.mockReturnValue(false);
      const api = new ExportApi();
      const graph = makeGraph();

      const clickSpy = vi.fn();
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const result = await api.exportToMarkdown(graph, 'my-project.archc');
      expect(result).toBe(true);

      // Verify anchor download was used
      expect(clickSpy).toHaveBeenCalled();
      expect(mockShareFile).not.toHaveBeenCalled();

      vi.mocked(document.createElement).mockRestore();
    });

    it('on native: uses adapter.shareFile with markdown text', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();
      const graph = makeGraph({ name: 'My System' });

      const result = await api.exportToMarkdown(graph, 'my-system.archc');
      expect(result).toBe(true);

      expect(mockShareFile).toHaveBeenCalledTimes(1);
      const [data, filename, mimeType] = mockShareFile.mock.calls[0]!;

      // Should be string (markdown text)
      expect(typeof data).toBe('string');
      expect(data).toContain('# My System');

      expect(filename).toBe('my-system.md');
      expect(mimeType).toBe('text/markdown');
    });

    it('on native: strips .archc and .md extensions from filename', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();
      const graph = makeGraph();

      await api.exportToMarkdown(graph, 'project.archc');
      expect(mockShareFile.mock.calls[0]![1]).toBe('project.md');

      mockShareFile.mockClear();
      await api.exportToMarkdown(graph, 'already.md');
      expect(mockShareFile.mock.calls[0]![1]).toBe('already.md');
    });

    it('includes mermaid diagram in markdown content', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();
      const graph = makeGraph();

      await api.exportToMarkdown(graph, 'test');
      const content = mockShareFile.mock.calls[0]![0] as string;
      expect(content).toContain('```mermaid');
      expect(content).toContain('graph LR');
    });

    it('catches errors and returns false', async () => {
      mockIsNative.mockReturnValue(true);
      mockShareFile.mockRejectedValueOnce(new Error('Share failed'));
      const api = new ExportApi();
      const graph = makeGraph();

      const result = await api.exportToMarkdown(graph, 'test');
      expect(result).toBe(false);
    });
  });

  // ─── Mermaid Export ──────────────────────────────────────────

  describe('exportToMermaid', () => {
    it('on web: creates a blob download with .mmd extension', async () => {
      mockIsNative.mockReturnValue(false);
      const api = new ExportApi();
      const graph = makeGraph();

      const clickSpy = vi.fn();
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const result = await api.exportToMermaid(graph, 'my-project.archc');
      expect(result).toBe(true);

      expect(clickSpy).toHaveBeenCalled();
      expect(mockShareFile).not.toHaveBeenCalled();

      vi.mocked(document.createElement).mockRestore();
    });

    it('on native: uses adapter.shareFile with mermaid text', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();
      const graph = makeGraph();

      const result = await api.exportToMermaid(graph, 'my-project.archc');
      expect(result).toBe(true);

      expect(mockShareFile).toHaveBeenCalledTimes(1);
      const [data, filename, mimeType] = mockShareFile.mock.calls[0]!;

      // Should be string (mermaid diagram text)
      expect(typeof data).toBe('string');
      expect(data).toContain('graph LR');

      expect(filename).toBe('my-project.mmd');
      expect(mimeType).toBe('text/plain');
    });

    it('on native: strips .archc and .mmd extensions from filename', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();
      const graph = makeGraph();

      await api.exportToMermaid(graph, 'project.archc');
      expect(mockShareFile.mock.calls[0]![1]).toBe('project.mmd');

      mockShareFile.mockClear();
      await api.exportToMermaid(graph, 'already.mmd');
      expect(mockShareFile.mock.calls[0]![1]).toBe('already.mmd');
    });

    it('mermaid content contains node definitions', async () => {
      mockIsNative.mockReturnValue(true);
      const api = new ExportApi();
      const graph = makeGraph();

      await api.exportToMermaid(graph, 'test');
      const content = mockShareFile.mock.calls[0]![0] as string;
      expect(content).toContain('API Server');
    });

    it('catches errors and returns false', async () => {
      mockIsNative.mockReturnValue(true);
      mockShareFile.mockRejectedValueOnce(new Error('Share failed'));
      const api = new ExportApi();
      const graph = makeGraph();

      const result = await api.exportToMermaid(graph, 'test');
      expect(result).toBe(false);
    });
  });

  // ─── Platform branching ──────────────────────────────────────

  describe('platform branching', () => {
    it('isNative() determines which path is used for markdown', async () => {
      const api = new ExportApi();
      const graph = makeGraph();

      mockIsNative.mockReturnValue(false);
      await api.exportToMarkdown(graph, 'test');
      expect(mockShareFile).not.toHaveBeenCalled();

      mockIsNative.mockReturnValue(true);
      await api.exportToMarkdown(graph, 'test');
      expect(mockShareFile).toHaveBeenCalledTimes(1);
    });

    it('isNative() determines which path is used for mermaid', async () => {
      const api = new ExportApi();
      const graph = makeGraph();

      mockIsNative.mockReturnValue(false);
      await api.exportToMermaid(graph, 'test');
      expect(mockShareFile).not.toHaveBeenCalled();

      mockIsNative.mockReturnValue(true);
      await api.exportToMermaid(graph, 'test');
      expect(mockShareFile).toHaveBeenCalledTimes(1);
    });
  });
});

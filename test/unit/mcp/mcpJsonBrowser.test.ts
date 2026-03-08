/**
 * Tests for browser-compatible MCP JSON auto-registration.
 *
 * Uses a mock FileSystemDirectoryHandle to simulate the File System Access API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  autoRegisterMcpConfig,
  buildArchcanvasEntryBrowser,
  ARCHCANVAS_SERVER_KEY,
} from '@/mcp/mcpJsonBrowser';

// ── Mock FileSystem helpers ────────────────────────────────────────────────

interface MockFile {
  content: string;
}

/**
 * Create a mock FileSystemDirectoryHandle that simulates reading/writing files.
 */
function createMockDirHandle(files: Record<string, MockFile> = {}): FileSystemDirectoryHandle {
  const storage = new Map<string, string>();
  for (const [name, file] of Object.entries(files)) {
    storage.set(name, file.content);
  }

  const dirHandle = {
    kind: 'directory' as const,
    name: 'test-project',
    getFileHandle: vi.fn(async (name: string, options?: { create?: boolean }) => {
      const exists = storage.has(name);
      if (!exists && !options?.create) {
        const err = new DOMException(`File not found: ${name}`, 'NotFoundError');
        throw err;
      }

      return {
        kind: 'file' as const,
        name,
        getFile: vi.fn(async () => ({
          text: vi.fn(async () => storage.get(name) || ''),
          arrayBuffer: vi.fn(async () => new TextEncoder().encode(storage.get(name) || '').buffer),
        })),
        createWritable: vi.fn(async () => {
          let buffer = '';
          return {
            write: vi.fn(async (data: string | Uint8Array) => {
              buffer += typeof data === 'string' ? data : new TextDecoder().decode(data);
            }),
            close: vi.fn(async () => {
              storage.set(name, buffer);
            }),
          };
        }),
      } as unknown as FileSystemFileHandle;
    }),
    getDirectoryHandle: vi.fn(),
    removeEntry: vi.fn(),
    resolve: vi.fn(),
    keys: vi.fn(),
    values: vi.fn(),
    entries: vi.fn(),
    isSameEntry: vi.fn(),
    queryPermission: vi.fn(),
    requestPermission: vi.fn(),
    [Symbol.asyncIterator]: vi.fn(),
  } as unknown as FileSystemDirectoryHandle;

  // Expose storage for test assertions
  (dirHandle as unknown as { _storage: Map<string, string> })._storage = storage;

  return dirHandle;
}

function getStorage(dirHandle: FileSystemDirectoryHandle): Map<string, string> {
  return (dirHandle as unknown as { _storage: Map<string, string> })._storage;
}

function readWrittenMcpJson(dirHandle: FileSystemDirectoryHandle): unknown {
  const storage = getStorage(dirHandle);
  const raw = storage.get('.mcp.json');
  if (!raw) return null;
  return JSON.parse(raw);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('mcpJsonBrowser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildArchcanvasEntryBrowser', () => {
    it('returns entry with archcanvas command and mcp --file args', () => {
      const entry = buildArchcanvasEntryBrowser();
      expect(entry.command).toBe('archcanvas');
      expect(entry.args).toEqual(['mcp', '--file', '.archcanvas/main.archc']);
    });
  });

  describe('autoRegisterMcpConfig', () => {
    it('creates .mcp.json when file does not exist', async () => {
      const dirHandle = createMockDirHandle();

      const result = await autoRegisterMcpConfig(dirHandle);

      expect(result).toEqual({ written: true, created: true, merged: false });

      const written = readWrittenMcpJson(dirHandle);
      expect(written).toEqual({
        mcpServers: {
          [ARCHCANVAS_SERVER_KEY]: buildArchcanvasEntryBrowser(),
        },
      });
    });

    it('overwrites existing archcanvas entry to keep config up-to-date', async () => {
      const existingContent = {
        mcpServers: {
          [ARCHCANVAS_SERVER_KEY]: { command: 'npx', args: ['archcanvas-mcp', 'old.archc'] },
        },
      };
      const dirHandle = createMockDirHandle({
        '.mcp.json': { content: JSON.stringify(existingContent) },
      });

      const result = await autoRegisterMcpConfig(dirHandle);

      expect(result).toEqual({ written: true, created: false, merged: false });
      // File should have been overwritten with new entry
      const written = readWrittenMcpJson(dirHandle) as { mcpServers: Record<string, { command: string; args: string[] }> };
      expect(written.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual(buildArchcanvasEntryBrowser());
    });

    it('merges with existing servers without overwriting them', async () => {
      const existingContent = {
        mcpServers: {
          'other-server': { command: 'node', args: ['other.js'] },
        },
      };
      const dirHandle = createMockDirHandle({
        '.mcp.json': { content: JSON.stringify(existingContent) },
      });

      const result = await autoRegisterMcpConfig(dirHandle);

      expect(result).toEqual({ written: true, created: false, merged: true });

      const written = readWrittenMcpJson(dirHandle) as { mcpServers: Record<string, unknown> };
      // Other server preserved
      expect(written.mcpServers['other-server']).toEqual({ command: 'node', args: ['other.js'] });
      // Archcanvas added
      expect(written.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual(buildArchcanvasEntryBrowser());
    });

    it('preserves other top-level keys in .mcp.json', async () => {
      const existingContent = {
        mcpServers: {
          'other-server': { command: 'node', args: ['x'] },
        },
        customField: 'keep-me',
      };
      const dirHandle = createMockDirHandle({
        '.mcp.json': { content: JSON.stringify(existingContent) },
      });

      const result = await autoRegisterMcpConfig(dirHandle);

      expect(result?.written).toBe(true);
      const written = readWrittenMcpJson(dirHandle) as Record<string, unknown>;
      expect(written.customField).toBe('keep-me');
    });

    it('handles malformed JSON gracefully by overwriting', async () => {
      const dirHandle = createMockDirHandle({
        '.mcp.json': { content: '{ invalid json !!!' },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await autoRegisterMcpConfig(dirHandle);

      expect(result).toEqual({ written: true, created: true, merged: false });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('invalid JSON'),
      );

      const written = readWrittenMcpJson(dirHandle);
      expect(written).toEqual({
        mcpServers: {
          [ARCHCANVAS_SERVER_KEY]: buildArchcanvasEntryBrowser(),
        },
      });
    });

    it('handles non-object JSON gracefully', async () => {
      const dirHandle = createMockDirHandle({
        '.mcp.json': { content: '"just a string"' },
      });

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await autoRegisterMcpConfig(dirHandle);

      expect(result).toEqual({ written: true, created: true, merged: false });
    });

    it('handles missing mcpServers key', async () => {
      const dirHandle = createMockDirHandle({
        '.mcp.json': { content: JSON.stringify({ someOtherField: true }) },
      });

      const result = await autoRegisterMcpConfig(dirHandle);

      expect(result).toEqual({ written: true, created: false, merged: false });

      const written = readWrittenMcpJson(dirHandle) as { mcpServers: Record<string, unknown>; someOtherField: boolean };
      expect(written.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual(buildArchcanvasEntryBrowser());
      expect(written.someOtherField).toBe(true);
    });

    it('handles write permission denied gracefully', async () => {
      const dirHandle = createMockDirHandle();
      // Override getFileHandle to throw permission error on create
      (dirHandle.getFileHandle as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new DOMException('Not found', 'NotFoundError'),
      ).mockRejectedValueOnce(
        new DOMException('Permission denied', 'NotAllowedError'),
      );

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await autoRegisterMcpConfig(dirHandle);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
      );
    });

    it('handles generic errors gracefully without crashing', async () => {
      const dirHandle = createMockDirHandle();
      (dirHandle.getFileHandle as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new DOMException('Not found', 'NotFoundError'),
      ).mockRejectedValueOnce(
        new Error('Unexpected disk error'),
      );

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await autoRegisterMcpConfig(dirHandle);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to auto-register'),
        expect.any(Error),
      );
    });

    it('writes formatted JSON with trailing newline', async () => {
      const dirHandle = createMockDirHandle();

      await autoRegisterMcpConfig(dirHandle);

      const raw = getStorage(dirHandle).get('.mcp.json');
      expect(raw).toBeDefined();
      // Should end with newline
      expect(raw!.endsWith('\n')).toBe(true);
      // Should be formatted (indented)
      expect(raw).toContain('  ');
    });

    it('always overwrites archcanvas entry on repeated calls', async () => {
      const dirHandle = createMockDirHandle();

      // First call creates the file
      const result1 = await autoRegisterMcpConfig(dirHandle);
      expect(result1?.written).toBe(true);
      expect(result1?.created).toBe(true);

      // Second call overwrites (keeps config up-to-date)
      const result2 = await autoRegisterMcpConfig(dirHandle);
      expect(result2?.written).toBe(true);
      expect(result2?.created).toBe(false);

      // Third call also overwrites
      const result3 = await autoRegisterMcpConfig(dirHandle);
      expect(result3?.written).toBe(true);
      expect(result3?.created).toBe(false);

      // Final content should be correct
      const written = readWrittenMcpJson(dirHandle) as { mcpServers: Record<string, unknown> };
      expect(written.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual(buildArchcanvasEntryBrowser());
    });
  });

  describe('projectStore integration', () => {
    it('does not block project open when .mcp.json write fails', async () => {
      // This tests the contract: autoRegisterMcpConfig never throws
      const dirHandle = createMockDirHandle();
      // Make every getFileHandle call fail
      (dirHandle.getFileHandle as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Total failure'),
      );

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      const result = await autoRegisterMcpConfig(dirHandle);
      expect(result).toBeNull();
    });
  });
});

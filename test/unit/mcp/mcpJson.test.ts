/**
 * Tests for merge-aware .mcp.json writer.
 *
 * Verifies write/merge/remove operations for the archcanvas MCP server
 * entry in .mcp.json files, including malformed file handling and
 * file deletion when no servers remain.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  writeMcpJson,
  removeMcpJson,
  buildArchcanvasEntry,
  ARCHCANVAS_SERVER_KEY,
} from '@/mcp/mcpJson';

describe('Merge-aware .mcp.json writer', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'archcanvas-mcpjson-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  function mcpPath(): string {
    return join(testDir, '.mcp.json');
  }

  async function fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async function readJson(path: string): Promise<unknown> {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  }

  // --- buildArchcanvasEntry ---

  describe('buildArchcanvasEntry', () => {
    it('returns the correct server entry shape', () => {
      const entry = buildArchcanvasEntry('/path/to/main.archc');
      expect(entry).toEqual({
        command: 'npx',
        args: ['archcanvas-mcp', '/path/to/main.archc'],
      });
    });
  });

  // --- writeMcpJson ---

  describe('writeMcpJson', () => {
    it('creates new .mcp.json when none exists with archcanvas server config', async () => {
      const result = await writeMcpJson(mcpPath(), '/project/main.archc');

      expect(result.created).toBe(true);
      expect(result.merged).toBe(false);
      expect(result.backedUp).toBeNull();

      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers).toBeDefined();
      expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual({
        command: 'npx',
        args: ['archcanvas-mcp', '/project/main.archc'],
      });
    });

    it('merges into existing .mcp.json that has other mcpServers defined', async () => {
      // Pre-existing file with another server
      const existing = {
        mcpServers: {
          'other-server': {
            command: 'node',
            args: ['other-server.js'],
          },
        },
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      const result = await writeMcpJson(mcpPath(), '/project/main.archc');

      expect(result.created).toBe(false);
      expect(result.merged).toBe(true);

      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers['other-server']).toEqual({
        command: 'node',
        args: ['other-server.js'],
      });
      expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual({
        command: 'npx',
        args: ['archcanvas-mcp', '/project/main.archc'],
      });
    });

    it('preserves all existing server entries when merging', async () => {
      const existing = {
        mcpServers: {
          'server-a': { command: 'a', args: ['a1'] },
          'server-b': { command: 'b', args: ['b1', 'b2'] },
          'server-c': { command: 'c', args: [] },
        },
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      await writeMcpJson(mcpPath(), '/my/file.archc');

      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(Object.keys(data.mcpServers)).toHaveLength(4);
      expect(data.mcpServers['server-a']).toEqual({ command: 'a', args: ['a1'] });
      expect(data.mcpServers['server-b']).toEqual({ command: 'b', args: ['b1', 'b2'] });
      expect(data.mcpServers['server-c']).toEqual({ command: 'c', args: [] });
      expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toBeDefined();
    });

    it('overwrites existing archcanvas entry if already present (idempotent)', async () => {
      const existing = {
        mcpServers: {
          [ARCHCANVAS_SERVER_KEY]: {
            command: 'npx',
            args: ['archcanvas-mcp', '/old/path.archc'],
          },
        },
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      const result = await writeMcpJson(mcpPath(), '/new/path.archc');

      expect(result.merged).toBe(true);

      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual({
        command: 'npx',
        args: ['archcanvas-mcp', '/new/path.archc'],
      });
    });

    it('preserves other top-level keys in existing file', async () => {
      const existing = {
        mcpServers: {
          other: { command: 'x', args: [] },
        },
        customSetting: true,
        version: '1.0',
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      await writeMcpJson(mcpPath(), '/file.archc');

      const data = (await readJson(mcpPath())) as Record<string, unknown>;
      expect(data.customSetting).toBe(true);
      expect(data.version).toBe('1.0');
    });

    it('handles malformed .mcp.json gracefully (warn and back up before overwriting)', async () => {
      await writeFile(mcpPath(), '{{not valid json!!', 'utf-8');

      const result = await writeMcpJson(mcpPath(), '/project/main.archc');

      expect(result.created).toBe(true);
      expect(result.backedUp).toBe(mcpPath() + '.bak');

      // Backup file should contain the original malformed content
      const bakContent = await readFile(mcpPath() + '.bak', 'utf-8');
      expect(bakContent).toBe('{{not valid json!!');

      // New file should be valid
      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toBeDefined();
    });

    it('writes formatted JSON with trailing newline', async () => {
      await writeMcpJson(mcpPath(), '/file.archc');

      const content = await readFile(mcpPath(), 'utf-8');
      expect(content.endsWith('\n')).toBe(true);
      expect(content).toContain('  "mcpServers"');
    });

    it('handles empty mcpServers object in existing file', async () => {
      await writeFile(mcpPath(), JSON.stringify({ mcpServers: {} }, null, 2), 'utf-8');

      const result = await writeMcpJson(mcpPath(), '/file.archc');

      // No other servers existed, and no archcanvas entry was there
      expect(result.created).toBe(false);

      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toBeDefined();
    });

    it('handles existing file with missing mcpServers key', async () => {
      await writeFile(mcpPath(), JSON.stringify({ otherKey: 'value' }, null, 2), 'utf-8');

      await writeMcpJson(mcpPath(), '/file.archc');

      const data = (await readJson(mcpPath())) as Record<string, unknown>;
      expect(data.otherKey).toBe('value');
      expect((data.mcpServers as Record<string, unknown>)[ARCHCANVAS_SERVER_KEY]).toBeDefined();
    });

    it('creates parent directories if needed', async () => {
      const nestedPath = join(testDir, 'nested', 'dir', '.mcp.json');

      await writeMcpJson(nestedPath, '/file.archc');

      expect(await fileExists(nestedPath)).toBe(true);
    });
  });

  // --- removeMcpJson ---

  describe('removeMcpJson', () => {
    it('removes only the archcanvas key from mcpServers', async () => {
      const existing = {
        mcpServers: {
          [ARCHCANVAS_SERVER_KEY]: { command: 'npx', args: ['archcanvas-mcp', '/f.archc'] },
          'other-server': { command: 'node', args: ['other.js'] },
        },
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      const result = await removeMcpJson(mcpPath());

      expect(result.removed).toBe(true);
      expect(result.fileDeleted).toBe(false);

      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toBeUndefined();
      expect(data.mcpServers['other-server']).toBeDefined();
    });

    it('deletes the .mcp.json file entirely if no other servers remain after removal', async () => {
      const existing = {
        mcpServers: {
          [ARCHCANVAS_SERVER_KEY]: { command: 'npx', args: ['archcanvas-mcp', '/f.archc'] },
        },
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      const result = await removeMcpJson(mcpPath());

      expect(result.removed).toBe(true);
      expect(result.fileDeleted).toBe(true);
      expect(await fileExists(mcpPath())).toBe(false);
    });

    it('leaves the .mcp.json file intact if other servers remain after removal', async () => {
      const existing = {
        mcpServers: {
          [ARCHCANVAS_SERVER_KEY]: { command: 'npx', args: ['archcanvas-mcp', '/f.archc'] },
          'keep-me': { command: 'keep', args: [] },
        },
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      await removeMcpJson(mcpPath());

      expect(await fileExists(mcpPath())).toBe(true);
      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers['keep-me']).toBeDefined();
    });

    it('is a no-op when .mcp.json does not exist', async () => {
      const result = await removeMcpJson(mcpPath());

      expect(result.removed).toBe(false);
      expect(result.fileDeleted).toBe(false);
      expect(result.backedUp).toBeNull();
    });

    it('is a no-op when archcanvas entry is not present', async () => {
      const existing = {
        mcpServers: {
          'other-server': { command: 'node', args: ['other.js'] },
        },
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      const result = await removeMcpJson(mcpPath());

      expect(result.removed).toBe(false);
      expect(result.fileDeleted).toBe(false);
    });

    it('handles malformed .mcp.json gracefully (backs up and removes)', async () => {
      await writeFile(mcpPath(), 'not json content!!!', 'utf-8');

      const result = await removeMcpJson(mcpPath());

      expect(result.removed).toBe(true);
      expect(result.fileDeleted).toBe(true);
      expect(result.backedUp).toBe(mcpPath() + '.bak');

      // Original file should be gone
      expect(await fileExists(mcpPath())).toBe(false);

      // Backup should contain original content
      const bakContent = await readFile(mcpPath() + '.bak', 'utf-8');
      expect(bakContent).toBe('not json content!!!');
    });

    it('keeps file if other top-level keys exist even with empty mcpServers', async () => {
      const existing = {
        mcpServers: {
          [ARCHCANVAS_SERVER_KEY]: { command: 'npx', args: ['archcanvas-mcp', '/f.archc'] },
        },
        customConfig: { setting: true },
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      const result = await removeMcpJson(mcpPath());

      expect(result.removed).toBe(true);
      expect(result.fileDeleted).toBe(false);
      expect(await fileExists(mcpPath())).toBe(true);

      const data = (await readJson(mcpPath())) as Record<string, unknown>;
      expect(data.customConfig).toEqual({ setting: true });
    });
  });

  // --- Integration / Round-trip ---

  describe('round-trip', () => {
    it('write then remove leaves no file when archcanvas is the only server', async () => {
      await writeMcpJson(mcpPath(), '/project/main.archc');
      expect(await fileExists(mcpPath())).toBe(true);

      await removeMcpJson(mcpPath());
      expect(await fileExists(mcpPath())).toBe(false);
    });

    it('write then remove preserves other servers', async () => {
      // Start with another server
      const existing = {
        mcpServers: {
          'other-server': { command: 'node', args: ['server.js'] },
        },
      };
      await writeFile(mcpPath(), JSON.stringify(existing, null, 2), 'utf-8');

      // Add archcanvas
      await writeMcpJson(mcpPath(), '/project/main.archc');

      // Remove archcanvas
      await removeMcpJson(mcpPath());

      // Other server should still be there
      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers['other-server']).toEqual({
        command: 'node',
        args: ['server.js'],
      });
      expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toBeUndefined();
    });

    it('multiple writes are idempotent — last path wins', async () => {
      await writeMcpJson(mcpPath(), '/first.archc');
      await writeMcpJson(mcpPath(), '/second.archc');
      await writeMcpJson(mcpPath(), '/third.archc');

      const data = (await readJson(mcpPath())) as { mcpServers: Record<string, unknown> };
      expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual({
        command: 'npx',
        args: ['archcanvas-mcp', '/third.archc'],
      });
      // Only one server entry
      expect(Object.keys(data.mcpServers)).toHaveLength(1);
    });
  });
});

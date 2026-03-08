/**
 * Tests for MCP project registry file management.
 *
 * Verifies ~/.archcanvas/mcp-registry.json creation, read/write,
 * atomic writes, deduplication, and round-trip integrity.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// We'll mock homedir() so the registry writes to a temp directory
// instead of the real ~/.archcanvas/
let testHomeDir: string;

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => testHomeDir,
  };
});

// Import after mock setup
import {
  getRegistryDir,
  getRegistryPath,
  ensureRegistryDir,
  readRegistry,
  writeRegistry,
  addProject,
  removeProject,
  setGlobal,
  type McpRegistry,
} from '@/mcp/registry';

describe('MCP Registry File Management', () => {
  beforeEach(async () => {
    testHomeDir = await mkdtemp(join(tmpdir(), 'archcanvas-test-'));
  });

  afterEach(async () => {
    await rm(testHomeDir, { recursive: true, force: true });
  });

  // --- Directory and path helpers ---

  describe('getRegistryDir', () => {
    it('returns ~/.archcanvas path', () => {
      const dir = getRegistryDir();
      expect(dir).toBe(join(testHomeDir, '.archcanvas'));
    });
  });

  describe('getRegistryPath', () => {
    it('returns ~/.archcanvas/mcp-registry.json path', () => {
      const path = getRegistryPath();
      expect(path).toBe(join(testHomeDir, '.archcanvas', 'mcp-registry.json'));
    });
  });

  // --- ensureRegistryDir ---

  describe('ensureRegistryDir', () => {
    it('creates ~/.archcanvas/ directory if it does not exist', async () => {
      await ensureRegistryDir();
      const info = await stat(join(testHomeDir, '.archcanvas'));
      expect(info.isDirectory()).toBe(true);
    });

    it('does not error if directory already exists', async () => {
      await mkdir(join(testHomeDir, '.archcanvas'), { recursive: true });
      await expect(ensureRegistryDir()).resolves.toBeUndefined();
    });
  });

  // --- readRegistry ---

  describe('readRegistry', () => {
    it('returns defaults when file does not exist', async () => {
      const registry = await readRegistry();
      expect(registry.global).toBe(false);
      expect(registry.projects).toEqual([]);
      expect(registry.version).toBe('0.1.0');
      expect(typeof registry.installed_at).toBe('string');
      // installed_at should be a valid ISO date
      expect(new Date(registry.installed_at).getTime()).not.toBeNaN();
    });

    it('reads existing registry file', async () => {
      const dir = join(testHomeDir, '.archcanvas');
      await mkdir(dir, { recursive: true });
      const data: McpRegistry = {
        global: false,
        projects: ['/home/user/project-a'],
        installed_at: '2026-01-15T10:00:00.000Z',
        version: '0.2.0',
      };
      await writeFile(join(dir, 'mcp-registry.json'), JSON.stringify(data), 'utf-8');

      const registry = await readRegistry();
      expect(registry.projects).toEqual(['/home/user/project-a']);
      expect(registry.installed_at).toBe('2026-01-15T10:00:00.000Z');
      expect(registry.version).toBe('0.2.0');
    });

    it('returns defaults for malformed JSON', async () => {
      const dir = join(testHomeDir, '.archcanvas');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'mcp-registry.json'), '{{not json', 'utf-8');

      const registry = await readRegistry();
      expect(registry.projects).toEqual([]);
      expect(registry.version).toBe('0.1.0');
    });

    it('filters out non-string entries in projects array', async () => {
      const dir = join(testHomeDir, '.archcanvas');
      await mkdir(dir, { recursive: true });
      const data = {
        projects: ['/valid/path', 42, null, '/another/path', true],
        installed_at: '2026-01-15T10:00:00.000Z',
        version: '0.1.0',
      };
      await writeFile(join(dir, 'mcp-registry.json'), JSON.stringify(data), 'utf-8');

      const registry = await readRegistry();
      expect(registry.projects).toEqual(['/valid/path', '/another/path']);
    });

    it('handles missing fields gracefully', async () => {
      const dir = join(testHomeDir, '.archcanvas');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'mcp-registry.json'), '{}', 'utf-8');

      const registry = await readRegistry();
      expect(registry.global).toBe(false);
      expect(registry.projects).toEqual([]);
      expect(typeof registry.installed_at).toBe('string');
      expect(registry.version).toBe('0.1.0');
    });

    it('reads global=true from existing file', async () => {
      const dir = join(testHomeDir, '.archcanvas');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'mcp-registry.json'), JSON.stringify({
        global: true,
        projects: [],
        installed_at: '2026-01-01T00:00:00.000Z',
        version: '0.1.0',
      }), 'utf-8');

      const registry = await readRegistry();
      expect(registry.global).toBe(true);
    });

    it('defaults global to false for non-boolean values', async () => {
      const dir = join(testHomeDir, '.archcanvas');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'mcp-registry.json'), JSON.stringify({
        global: 'yes',
        projects: [],
        installed_at: '2026-01-01T00:00:00.000Z',
        version: '0.1.0',
      }), 'utf-8');

      const registry = await readRegistry();
      expect(registry.global).toBe(false);
    });
  });

  // --- writeRegistry ---

  describe('writeRegistry', () => {
    it('creates directory and writes registry file', async () => {
      const registry: McpRegistry = {
        global: false,
        projects: ['/home/user/project-x'],
        installed_at: '2026-03-08T12:00:00.000Z',
        version: '0.1.0',
      };

      await writeRegistry(registry);

      const content = await readFile(getRegistryPath(), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.projects).toEqual(['/home/user/project-x']);
      expect(parsed.installed_at).toBe('2026-03-08T12:00:00.000Z');
      expect(parsed.version).toBe('0.1.0');
    });

    it('writes formatted JSON with trailing newline', async () => {
      const registry: McpRegistry = {
        global: false,
        projects: [],
        installed_at: '2026-03-08T12:00:00.000Z',
        version: '0.1.0',
      };

      await writeRegistry(registry);

      const content = await readFile(getRegistryPath(), 'utf-8');
      expect(content.endsWith('\n')).toBe(true);
      // Should be pretty-printed (2-space indent)
      expect(content).toContain('  "projects"');
    });

    it('overwrites existing file', async () => {
      const dir = join(testHomeDir, '.archcanvas');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'mcp-registry.json'), '{"old": true}', 'utf-8');

      const registry: McpRegistry = {
        global: false,
        projects: ['/new/project'],
        installed_at: '2026-03-08T12:00:00.000Z',
        version: '0.1.0',
      };
      await writeRegistry(registry);

      const content = await readFile(getRegistryPath(), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.projects).toEqual(['/new/project']);
      expect(parsed).not.toHaveProperty('old');
    });

    it('does not leave temp files on success', async () => {
      const registry: McpRegistry = {
        global: false,
        projects: [],
        installed_at: '2026-03-08T12:00:00.000Z',
        version: '0.1.0',
      };
      await writeRegistry(registry);

      const fs = await import('node:fs/promises');
      const dir = getRegistryDir();
      const files = await fs.readdir(dir);
      // Only the registry file should exist, no .tmp files
      expect(files.filter((f) => f.includes('.tmp'))).toEqual([]);
    });
  });

  // --- addProject ---

  describe('addProject', () => {
    it('adds a project path to empty registry', async () => {
      const result = await addProject('/home/user/my-project');
      expect(result.projects).toContain('/home/user/my-project');
    });

    it('deduplicates - does not add same path twice', async () => {
      await addProject('/home/user/project-a');
      const result = await addProject('/home/user/project-a');
      expect(result.projects.filter((p) => p === '/home/user/project-a')).toHaveLength(1);
    });

    it('adds multiple distinct projects', async () => {
      await addProject('/home/user/project-a');
      await addProject('/home/user/project-b');
      const result = await addProject('/home/user/project-c');
      expect(result.projects).toEqual([
        '/home/user/project-a',
        '/home/user/project-b',
        '/home/user/project-c',
      ]);
    });

    it('persists to disk', async () => {
      await addProject('/home/user/persisted-project');

      const content = await readFile(getRegistryPath(), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.projects).toContain('/home/user/persisted-project');
    });
  });

  // --- removeProject ---

  describe('removeProject', () => {
    it('removes an existing project path', async () => {
      await addProject('/home/user/project-a');
      await addProject('/home/user/project-b');
      const result = await removeProject('/home/user/project-a');
      expect(result.projects).toEqual(['/home/user/project-b']);
    });

    it('is a no-op for non-existent path', async () => {
      await addProject('/home/user/project-a');
      const result = await removeProject('/home/user/non-existent');
      expect(result.projects).toEqual(['/home/user/project-a']);
    });

    it('persists removal to disk', async () => {
      await addProject('/home/user/project-a');
      await removeProject('/home/user/project-a');

      const content = await readFile(getRegistryPath(), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.projects).toEqual([]);
    });
  });

  // --- setGlobal ---

  describe('setGlobal', () => {
    it('sets global flag to true', async () => {
      const result = await setGlobal(true);
      expect(result.global).toBe(true);
    });

    it('clears global flag to false', async () => {
      await setGlobal(true);
      const result = await setGlobal(false);
      expect(result.global).toBe(false);
    });

    it('persists global flag to disk', async () => {
      await setGlobal(true);

      const content = await readFile(getRegistryPath(), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.global).toBe(true);
    });

    it('preserves existing projects when setting global', async () => {
      await addProject('/home/user/project');
      const result = await setGlobal(true);

      expect(result.global).toBe(true);
      expect(result.projects).toEqual(['/home/user/project']);
    });

    it('preserves installed_at and version when toggling global', async () => {
      const original: McpRegistry = {
        global: false,
        projects: [],
        installed_at: '2026-01-01T00:00:00.000Z',
        version: '0.5.0',
      };
      await writeRegistry(original);

      const result = await setGlobal(true);
      expect(result.installed_at).toBe('2026-01-01T00:00:00.000Z');
      expect(result.version).toBe('0.5.0');
    });
  });

  // --- Round-trip ---

  describe('round-trip', () => {
    it('survives read/write round-trip with all fields including global', async () => {
      const original: McpRegistry = {
        global: true,
        projects: ['/project/alpha', '/project/beta', '/project/gamma'],
        installed_at: '2026-06-15T08:30:00.000Z',
        version: '1.2.3',
      };

      await writeRegistry(original);
      const loaded = await readRegistry();

      expect(loaded).toEqual(original);
    });

    it('survives multiple add/remove cycles', async () => {
      await addProject('/a');
      await addProject('/b');
      await addProject('/c');
      await removeProject('/b');
      await addProject('/d');
      await removeProject('/a');

      const registry = await readRegistry();
      expect(registry.projects).toEqual(['/c', '/d']);
    });

    it('survives combined project and global mutations', async () => {
      await addProject('/first');
      await setGlobal(true);
      await addProject('/second');
      await removeProject('/first');
      await setGlobal(false);
      await setGlobal(true);

      const final = await readRegistry();
      expect(final.global).toBe(true);
      expect(final.projects).toEqual(['/second']);
    });
  });
});

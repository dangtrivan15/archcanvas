/**
 * Tests for CLI: archcanvas mcp install (Feature #482)
 *
 * Verifies:
 * - Creates .mcp.json in CWD with archcanvas server entry
 * - Written config contains command 'archcanvas' and args ['mcp']
 * - Merges into existing .mcp.json without overwriting other servers
 * - Updates ~/.archcanvas/mcp-registry.json with the project path
 * - --global flag writes to ~/.mcp.json instead
 * - Global install sets global flag in registry
 * - Prints confirmation message with path written to
 * - Running install twice is idempotent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import {
  buildInstallEntry,
  resolveMcpJsonPath,
  registerMcpInstallCommand,
} from '@/cli/commands/mcpInstall';
import { ARCHCANVAS_SERVER_KEY } from '@/mcp/mcpJson';
import { Command } from 'commander';

// ─── Unit tests for helper functions ────────────────────────

describe('buildInstallEntry', () => {
  it('returns command "archcanvas" and args ["mcp"]', () => {
    const entry = buildInstallEntry();
    expect(entry).toEqual({
      command: 'archcanvas',
      args: ['mcp'],
    });
  });
});

describe('resolveMcpJsonPath', () => {
  it('returns CWD/.mcp.json when not global', () => {
    const result = resolveMcpJsonPath(false);
    expect(result).toBe(join(process.cwd(), '.mcp.json'));
  });

  it('returns ~/.mcp.json when global', () => {
    const result = resolveMcpJsonPath(true);
    expect(result).toBe(join(homedir(), '.mcp.json'));
  });
});

// ─── Integration tests for mcp install command ──────────────

describe('archcanvas mcp install', () => {
  let testDir: string;
  let origCwd: string;
  let registryDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'archcanvas-mcp-install-test-'));
    registryDir = join(testDir, 'registry');
    await mkdir(registryDir, { recursive: true });
    origCwd = process.cwd();
    process.chdir(testDir);

    // Mock registry functions to use test directory
    vi.doMock('@/mcp/registry', () => ({
      getRegistryDir: () => registryDir,
      getRegistryPath: () => join(registryDir, 'mcp-registry.json'),
      ensureRegistryDir: async () => {
        await mkdir(registryDir, { recursive: true });
      },
      readRegistry: async () => {
        try {
          const content = await readFile(join(registryDir, 'mcp-registry.json'), 'utf-8');
          return JSON.parse(content);
        } catch {
          return {
            global: false,
            projects: [],
            installed_at: new Date().toISOString(),
            version: '0.1.0',
          };
        }
      },
      writeRegistry: async (registry: unknown) => {
        const path = join(registryDir, 'mcp-registry.json');
        await writeFile(path, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
      },
      addProject: async (projectPath: string) => {
        const regPath = join(registryDir, 'mcp-registry.json');
        let registry;
        try {
          registry = JSON.parse(await readFile(regPath, 'utf-8'));
        } catch {
          registry = {
            global: false,
            projects: [],
            installed_at: new Date().toISOString(),
            version: '0.1.0',
          };
        }
        if (!registry.projects.includes(projectPath)) {
          registry.projects.push(projectPath);
        }
        await writeFile(regPath, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
        return registry;
      },
      setGlobal: async (value: boolean) => {
        const regPath = join(registryDir, 'mcp-registry.json');
        let registry;
        try {
          registry = JSON.parse(await readFile(regPath, 'utf-8'));
        } catch {
          registry = {
            global: false,
            projects: [],
            installed_at: new Date().toISOString(),
            version: '0.1.0',
          };
        }
        registry.global = value;
        await writeFile(regPath, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
        return registry;
      },
    }));
  });

  afterEach(async () => {
    process.chdir(origCwd);
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function readJson(path: string): Promise<unknown> {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  }

  // --- Local install tests ---

  it('creates .mcp.json in current working directory', async () => {
    const { registerMcpInstallCommand: register } = await import(
      '@/cli/commands/mcpInstall'
    );

    const mcpCmd = new Command('mcp');
    register(mcpCmd);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd.parseAsync(['install'], { from: 'user' });
    consoleSpy.mockRestore();

    const mcpJsonPath = join(testDir, '.mcp.json');
    const data = (await readJson(mcpJsonPath)) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toBeDefined();
  });

  it('written config contains command "archcanvas" and args ["mcp"]', async () => {
    const { registerMcpInstallCommand: register } = await import(
      '@/cli/commands/mcpInstall'
    );

    const mcpCmd = new Command('mcp');
    register(mcpCmd);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd.parseAsync(['install'], { from: 'user' });
    consoleSpy.mockRestore();

    const mcpJsonPath = join(testDir, '.mcp.json');
    const data = (await readJson(mcpJsonPath)) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual({
      command: 'archcanvas',
      args: ['mcp'],
    });
  });

  it('merges into existing .mcp.json without overwriting other servers', async () => {
    // Pre-create .mcp.json with another server
    const existing = {
      mcpServers: {
        'other-server': { command: 'node', args: ['other.js'] },
      },
    };
    await writeFile(join(testDir, '.mcp.json'), JSON.stringify(existing, null, 2), 'utf-8');

    const { registerMcpInstallCommand: register } = await import(
      '@/cli/commands/mcpInstall'
    );

    const mcpCmd = new Command('mcp');
    register(mcpCmd);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd.parseAsync(['install'], { from: 'user' });
    consoleSpy.mockRestore();

    const data = (await readJson(join(testDir, '.mcp.json'))) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    // Other server preserved
    expect(data.mcpServers['other-server']).toEqual({
      command: 'node',
      args: ['other.js'],
    });
    // Archcanvas added
    expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual({
      command: 'archcanvas',
      args: ['mcp'],
    });
  });

  it('updates ~/.archcanvas/mcp-registry.json with the project path', async () => {
    const { registerMcpInstallCommand: register } = await import(
      '@/cli/commands/mcpInstall'
    );

    const mcpCmd = new Command('mcp');
    register(mcpCmd);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd.parseAsync(['install'], { from: 'user' });
    consoleSpy.mockRestore();

    const registryPath = join(registryDir, 'mcp-registry.json');
    const registry = (await readJson(registryPath)) as { projects: string[] };
    expect(registry.projects).toContain(testDir);
  });

  it('prints confirmation message with path written to', async () => {
    const { registerMcpInstallCommand: register } = await import(
      '@/cli/commands/mcpInstall'
    );

    const mcpCmd = new Command('mcp');
    register(mcpCmd);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd.parseAsync(['install'], { from: 'user' });

    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    consoleSpy.mockRestore();

    expect(output).toContain(ARCHCANVAS_SERVER_KEY);
    expect(output).toContain('.mcp.json');
  });

  it('running install twice in same directory is idempotent', async () => {
    const { registerMcpInstallCommand: register } = await import(
      '@/cli/commands/mcpInstall'
    );

    // First install
    const mcpCmd1 = new Command('mcp');
    register(mcpCmd1);
    const spy1 = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd1.parseAsync(['install'], { from: 'user' });
    spy1.mockRestore();

    // Second install
    const { registerMcpInstallCommand: register2 } = await import(
      '@/cli/commands/mcpInstall'
    );
    const mcpCmd2 = new Command('mcp');
    register2(mcpCmd2);
    const spy2 = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd2.parseAsync(['install'], { from: 'user' });
    spy2.mockRestore();

    // Should still have exactly one archcanvas entry
    const data = (await readJson(join(testDir, '.mcp.json'))) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(data.mcpServers)).toHaveLength(1);
    expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual({
      command: 'archcanvas',
      args: ['mcp'],
    });

    // Registry should have the project only once
    const registry = (await readJson(join(registryDir, 'mcp-registry.json'))) as {
      projects: string[];
    };
    const matches = registry.projects.filter((p: string) => p === testDir);
    expect(matches).toHaveLength(1);
  });

  // --- Global install tests ---

  it('--global writes to ~/.mcp.json instead', async () => {
    // For --global test, we point to our test dir instead of real home
    const fakeHome = join(testDir, 'fake-home');
    await mkdir(fakeHome, { recursive: true });
    const origHomedir = homedir;

    // Override homedir for this test via module mock
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return { ...actual, homedir: () => fakeHome };
    });

    // Re-import to pick up the mock
    const { registerMcpInstallCommand: register } = await import(
      '@/cli/commands/mcpInstall'
    );

    const mcpCmd = new Command('mcp');
    register(mcpCmd);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd.parseAsync(['install', '--global'], { from: 'user' });
    consoleSpy.mockRestore();

    const globalMcpPath = join(fakeHome, '.mcp.json');
    const data = (await readJson(globalMcpPath)) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(data.mcpServers[ARCHCANVAS_SERVER_KEY]).toEqual({
      command: 'archcanvas',
      args: ['mcp'],
    });
  });

  it('global install sets global flag in registry', async () => {
    const fakeHome = join(testDir, 'fake-home-2');
    await mkdir(fakeHome, { recursive: true });

    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return { ...actual, homedir: () => fakeHome };
    });

    const { registerMcpInstallCommand: register } = await import(
      '@/cli/commands/mcpInstall'
    );

    const mcpCmd = new Command('mcp');
    register(mcpCmd);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd.parseAsync(['install', '--global'], { from: 'user' });
    consoleSpy.mockRestore();

    const registryPath = join(registryDir, 'mcp-registry.json');
    const registry = (await readJson(registryPath)) as { global: boolean };
    expect(registry.global).toBe(true);
  });
});

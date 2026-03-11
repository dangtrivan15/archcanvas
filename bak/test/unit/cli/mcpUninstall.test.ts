/**
 * Tests for CLI: archcanvas mcp uninstall (Feature #483)
 *
 * Verifies:
 * - Read ~/.archcanvas/mcp-registry.json to get list of tracked projects
 * - For each tracked project path, remove archcanvas entry from .mcp.json
 * - If global flag is set, remove archcanvas entry from ~/.mcp.json
 * - Skip silently if a tracked project directory no longer exists
 * - Skip silently if a tracked .mcp.json is missing or unreadable
 * - Delete ~/.archcanvas/mcp-registry.json after cleanup
 * - Print summary of what was cleaned (N projects cleaned, M skipped)
 * - Running uninstall with no registry is a no-op (no error)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  mcpUninstall,
  formatUninstallSummary,
  registerMcpUninstallCommand,
  type UninstallResult,
} from '@/cli/commands/mcpUninstall';
import { ARCHCANVAS_SERVER_KEY } from '@/mcp/mcpJson';
import { Command } from 'commander';

// ─── Helpers ────────────────────────────────────────────────

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function readJson(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function createMcpJson(
  servers: Record<string, { command: string; args: string[] }>,
): { mcpServers: Record<string, { command: string; args: string[] }> } {
  return { mcpServers: servers };
}

function createRegistry(opts: {
  global?: boolean;
  projects?: string[];
}): { global: boolean; projects: string[]; installed_at: string; version: string } {
  return {
    global: opts.global ?? false,
    projects: opts.projects ?? [],
    installed_at: new Date().toISOString(),
    version: '0.1.0',
  };
}

// ─── Unit tests for formatUninstallSummary ──────────────────

describe('formatUninstallSummary', () => {
  it('returns "Nothing to clean up." for empty result', () => {
    const result: UninstallResult = {
      projectsCleaned: 0,
      projectsSkipped: 0,
      globalCleaned: false,
      registryDeleted: false,
    };
    expect(formatUninstallSummary(result)).toBe('Nothing to clean up.');
  });

  it('formats single project cleaned', () => {
    const result: UninstallResult = {
      projectsCleaned: 1,
      projectsSkipped: 0,
      globalCleaned: false,
      registryDeleted: true,
    };
    const summary = formatUninstallSummary(result);
    expect(summary).toContain('1 project cleaned');
    expect(summary).not.toContain('projects cleaned'); // singular
    expect(summary).toContain('Registry removed');
  });

  it('formats multiple projects cleaned and skipped', () => {
    const result: UninstallResult = {
      projectsCleaned: 3,
      projectsSkipped: 2,
      globalCleaned: false,
      registryDeleted: true,
    };
    const summary = formatUninstallSummary(result);
    expect(summary).toContain('3 projects cleaned');
    expect(summary).toContain('2 projects skipped');
  });

  it('includes global cleaned message', () => {
    const result: UninstallResult = {
      projectsCleaned: 0,
      projectsSkipped: 0,
      globalCleaned: true,
      registryDeleted: true,
    };
    const summary = formatUninstallSummary(result);
    expect(summary).toContain('Global ~/.mcp.json cleaned');
  });

  it('includes registry removed message', () => {
    const result: UninstallResult = {
      projectsCleaned: 1,
      projectsSkipped: 0,
      globalCleaned: false,
      registryDeleted: true,
    };
    expect(formatUninstallSummary(result)).toContain('Registry removed');
  });

  it('shows all fields combined', () => {
    const result: UninstallResult = {
      projectsCleaned: 2,
      projectsSkipped: 1,
      globalCleaned: true,
      registryDeleted: true,
    };
    const summary = formatUninstallSummary(result);
    expect(summary).toContain('2 projects cleaned');
    expect(summary).toContain('1 project skipped');
    expect(summary).toContain('Global ~/.mcp.json cleaned');
    expect(summary).toContain('Registry removed');
  });
});

// ─── Integration tests for mcpUninstall() ───────────────────

describe('mcpUninstall', () => {
  let testDir: string;
  let registryDir: string;
  let registryPath: string;
  let fakeHome: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'archcanvas-mcp-uninstall-test-'));
    registryDir = join(testDir, '.archcanvas');
    registryPath = join(registryDir, 'mcp-registry.json');
    fakeHome = join(testDir, 'home');
    await mkdir(registryDir, { recursive: true });
    await mkdir(fakeHome, { recursive: true });

    // Mock registry functions to use test directory
    vi.doMock('@/mcp/registry', async () => {
      const actual = await vi.importActual<typeof import('@/mcp/registry')>('@/mcp/registry');
      return {
        ...actual,
        getRegistryDir: () => registryDir,
        getRegistryPath: () => registryPath,
        readRegistry: async () => {
          try {
            const content = await readFile(registryPath, 'utf-8');
            const parsed = JSON.parse(content);
            return {
              global: typeof parsed.global === 'boolean' ? parsed.global : false,
              projects: Array.isArray(parsed.projects)
                ? parsed.projects.filter((p: unknown) => typeof p === 'string')
                : [],
              installed_at:
                typeof parsed.installed_at === 'string'
                  ? parsed.installed_at
                  : new Date().toISOString(),
              version: typeof parsed.version === 'string' ? parsed.version : '0.1.0',
            };
          } catch {
            return {
              global: false,
              projects: [],
              installed_at: new Date().toISOString(),
              version: '0.1.0',
            };
          }
        },
      };
    });

    // Mock homedir for global .mcp.json path
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return { ...actual, homedir: () => fakeHome };
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  // Step 8: Running uninstall with no registry is a no-op
  it('no-op when registry file does not exist', async () => {
    // Remove registry dir to ensure no registry file
    await rm(registryDir, { recursive: true, force: true });

    const { mcpUninstall: uninstall } = await import('@/cli/commands/mcpUninstall');
    const result = await uninstall();

    expect(result.projectsCleaned).toBe(0);
    expect(result.projectsSkipped).toBe(0);
    expect(result.globalCleaned).toBe(false);
    expect(result.registryDeleted).toBe(false);
  });

  // Step 1: Read registry to get list of tracked projects
  // Step 2: For each tracked project, remove archcanvas entry from .mcp.json
  it('reads registry and removes archcanvas from each tracked project .mcp.json', async () => {
    // Create two project dirs with .mcp.json files containing archcanvas
    const proj1 = join(testDir, 'proj1');
    const proj2 = join(testDir, 'proj2');
    await mkdir(proj1, { recursive: true });
    await mkdir(proj2, { recursive: true });

    await writeJson(join(proj1, '.mcp.json'), createMcpJson({
      [ARCHCANVAS_SERVER_KEY]: { command: 'archcanvas', args: ['mcp'] },
      'other-server': { command: 'node', args: ['server.js'] },
    }));
    await writeJson(join(proj2, '.mcp.json'), createMcpJson({
      [ARCHCANVAS_SERVER_KEY]: { command: 'archcanvas', args: ['mcp'] },
    }));

    // Create registry pointing to both projects
    await writeJson(registryPath, createRegistry({ projects: [proj1, proj2] }));

    const { mcpUninstall: uninstall } = await import('@/cli/commands/mcpUninstall');
    const result = await uninstall();

    expect(result.projectsCleaned).toBe(2);
    expect(result.projectsSkipped).toBe(0);

    // proj1: archcanvas removed, other-server preserved
    const proj1Json = (await readJson(join(proj1, '.mcp.json'))) as {
      mcpServers: Record<string, unknown>;
    };
    expect(proj1Json.mcpServers[ARCHCANVAS_SERVER_KEY]).toBeUndefined();
    expect(proj1Json.mcpServers['other-server']).toBeDefined();

    // proj2: file deleted entirely (archcanvas was only server)
    expect(await fileExists(join(proj2, '.mcp.json'))).toBe(false);
  });

  // Step 3: If global flag is set, remove from ~/.mcp.json
  it('removes archcanvas from global ~/.mcp.json when global flag is set', async () => {
    // Write global .mcp.json
    await writeJson(join(fakeHome, '.mcp.json'), createMcpJson({
      [ARCHCANVAS_SERVER_KEY]: { command: 'archcanvas', args: ['mcp'] },
    }));

    // Registry with global=true, no projects
    await writeJson(registryPath, createRegistry({ global: true, projects: [] }));

    const { mcpUninstall: uninstall } = await import('@/cli/commands/mcpUninstall');
    const result = await uninstall();

    expect(result.globalCleaned).toBe(true);
    // Global .mcp.json file should be deleted (only had archcanvas)
    expect(await fileExists(join(fakeHome, '.mcp.json'))).toBe(false);
  });

  it('does not touch global ~/.mcp.json when global flag is false', async () => {
    // Write global .mcp.json with archcanvas
    await writeJson(join(fakeHome, '.mcp.json'), createMcpJson({
      [ARCHCANVAS_SERVER_KEY]: { command: 'archcanvas', args: ['mcp'] },
    }));

    // Registry with global=false
    await writeJson(registryPath, createRegistry({ global: false, projects: [] }));

    const { mcpUninstall: uninstall } = await import('@/cli/commands/mcpUninstall');
    const result = await uninstall();

    expect(result.globalCleaned).toBe(false);
    // Global .mcp.json should still exist
    expect(await fileExists(join(fakeHome, '.mcp.json'))).toBe(true);
  });

  // Step 4: Skip silently if a tracked project directory no longer exists
  it('skips silently when project directory no longer exists', async () => {
    const existingProj = join(testDir, 'existing');
    const missingProj = join(testDir, 'missing-project'); // never created
    await mkdir(existingProj, { recursive: true });

    await writeJson(join(existingProj, '.mcp.json'), createMcpJson({
      [ARCHCANVAS_SERVER_KEY]: { command: 'archcanvas', args: ['mcp'] },
    }));

    await writeJson(registryPath, createRegistry({
      projects: [existingProj, missingProj],
    }));

    const { mcpUninstall: uninstall } = await import('@/cli/commands/mcpUninstall');
    const result = await uninstall();

    expect(result.projectsCleaned).toBe(1);
    expect(result.projectsSkipped).toBe(1);
  });

  // Step 5: Skip silently if a tracked .mcp.json is missing or unreadable
  it('skips silently when project .mcp.json is missing', async () => {
    const proj = join(testDir, 'proj-no-mcp');
    await mkdir(proj, { recursive: true });
    // No .mcp.json in this project dir

    await writeJson(registryPath, createRegistry({ projects: [proj] }));

    const { mcpUninstall: uninstall } = await import('@/cli/commands/mcpUninstall');
    const result = await uninstall();

    // removeMcpJson returns removed:false for missing file → counted as skipped
    expect(result.projectsSkipped).toBe(1);
    expect(result.projectsCleaned).toBe(0);
  });

  // Step 6: Delete ~/.archcanvas/mcp-registry.json after cleanup
  it('deletes the registry file after cleanup', async () => {
    const proj = join(testDir, 'proj-clean');
    await mkdir(proj, { recursive: true });

    await writeJson(join(proj, '.mcp.json'), createMcpJson({
      [ARCHCANVAS_SERVER_KEY]: { command: 'archcanvas', args: ['mcp'] },
    }));
    await writeJson(registryPath, createRegistry({ projects: [proj] }));

    const { mcpUninstall: uninstall } = await import('@/cli/commands/mcpUninstall');
    const result = await uninstall();

    expect(result.registryDeleted).toBe(true);
    expect(await fileExists(registryPath)).toBe(false);
  });

  // Step 7: Print summary (tested via formatUninstallSummary above, but also
  // verify the CLI command prints it)
  it('CLI command prints summary output', async () => {
    const proj = join(testDir, 'proj-summary');
    await mkdir(proj, { recursive: true });
    await writeJson(join(proj, '.mcp.json'), createMcpJson({
      [ARCHCANVAS_SERVER_KEY]: { command: 'archcanvas', args: ['mcp'] },
    }));
    await writeJson(registryPath, createRegistry({ projects: [proj] }));

    const { registerMcpUninstallCommand: register } = await import(
      '@/cli/commands/mcpUninstall'
    );

    const mcpCmd = new Command('mcp');
    register(mcpCmd);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mcpCmd.parseAsync(['uninstall'], { from: 'user' });

    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    consoleSpy.mockRestore();

    expect(output).toContain('1 project cleaned');
    expect(output).toContain('Registry removed');
  });

  // Mixed scenario: projects + global + missing dirs
  it('handles mixed scenario with projects, global, and missing dirs', async () => {
    const proj1 = join(testDir, 'proj-ok');
    const proj2 = join(testDir, 'proj-gone'); // missing dir
    await mkdir(proj1, { recursive: true });

    await writeJson(join(proj1, '.mcp.json'), createMcpJson({
      [ARCHCANVAS_SERVER_KEY]: { command: 'archcanvas', args: ['mcp'] },
    }));

    // Global .mcp.json
    await writeJson(join(fakeHome, '.mcp.json'), createMcpJson({
      [ARCHCANVAS_SERVER_KEY]: { command: 'archcanvas', args: ['mcp'] },
      'other-global': { command: 'node', args: ['global.js'] },
    }));

    await writeJson(registryPath, createRegistry({
      global: true,
      projects: [proj1, proj2],
    }));

    const { mcpUninstall: uninstall } = await import('@/cli/commands/mcpUninstall');
    const result = await uninstall();

    expect(result.projectsCleaned).toBe(1);
    expect(result.projectsSkipped).toBe(1);
    expect(result.globalCleaned).toBe(true);
    expect(result.registryDeleted).toBe(true);

    // Global .mcp.json should still exist (other-global remains)
    const globalJson = (await readJson(join(fakeHome, '.mcp.json'))) as {
      mcpServers: Record<string, unknown>;
    };
    expect(globalJson.mcpServers[ARCHCANVAS_SERVER_KEY]).toBeUndefined();
    expect(globalJson.mcpServers['other-global']).toBeDefined();
  });

  // Empty registry (no projects, no global)
  it('handles empty registry with no projects and no global flag', async () => {
    await writeJson(registryPath, createRegistry({ projects: [], global: false }));

    const { mcpUninstall: uninstall } = await import('@/cli/commands/mcpUninstall');
    const result = await uninstall();

    expect(result.projectsCleaned).toBe(0);
    expect(result.projectsSkipped).toBe(0);
    expect(result.globalCleaned).toBe(false);
    expect(result.registryDeleted).toBe(true); // registry still gets deleted
  });
});

// ─── CLI command registration ────────────────────────────────

describe('registerMcpUninstallCommand', () => {
  it('registers uninstall subcommand on parent command', () => {
    const mcpCmd = new Command('mcp');
    registerMcpUninstallCommand(mcpCmd);

    const uninstall = mcpCmd.commands.find((c) => c.name() === 'uninstall');
    expect(uninstall).toBeDefined();
    expect(uninstall!.description()).toContain('Remove');
  });
});

// ─── CLI program registration ─────────────────────────────

describe('CLI program integration', () => {
  it('uninstall subcommand is registered under mcp', async () => {
    const { createProgram } = await import('@/cli/index');
    const program = createProgram();
    const mcp = program.commands.find((c) => c.name() === 'mcp');
    expect(mcp).toBeDefined();
    const uninstall = mcp!.commands.find((c) => c.name() === 'uninstall');
    expect(uninstall).toBeDefined();
  });
});

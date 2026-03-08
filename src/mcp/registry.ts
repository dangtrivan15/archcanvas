/**
 * MCP Project Registry File Management
 *
 * Manages ~/.archcanvas/mcp-registry.json that tracks all projects where
 * archcanvas has written .mcp.json config. Simple array of project paths
 * for cleanup on uninstall.
 *
 * The registry file schema:
 * {
 *   global: boolean,        // whether ~/.mcp.json was written
 *   projects: string[],     // deduplicated absolute project paths
 *   installed_at: string,   // ISO 8601 timestamp of first install
 *   version: string         // tool version that last wrote the file
 * }
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

/** Shape of the mcp-registry.json file */
export interface McpRegistry {
  global: boolean;
  projects: string[];
  installed_at: string;
  version: string;
}

/** Default registry values when no file exists */
function createDefaultRegistry(): McpRegistry {
  return {
    global: false,
    projects: [],
    installed_at: new Date().toISOString(),
    version: '0.1.0',
  };
}

/** Returns the path to the ~/.archcanvas directory */
export function getRegistryDir(): string {
  return join(homedir(), '.archcanvas');
}

/** Returns the path to ~/.archcanvas/mcp-registry.json */
export function getRegistryPath(): string {
  return join(getRegistryDir(), 'mcp-registry.json');
}

/**
 * Ensure the ~/.archcanvas/ directory exists.
 * Creates it recursively if it doesn't exist.
 */
export async function ensureRegistryDir(): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.mkdir(getRegistryDir(), { recursive: true });
}

/**
 * Read the MCP registry from disk.
 * Returns default values if the file doesn't exist or is malformed.
 * Never throws — always returns a valid registry object.
 */
export async function readRegistry(): Promise<McpRegistry> {
  const fs = await import('node:fs/promises');
  const filePath = getRegistryPath();

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    // Validate shape — be tolerant of missing fields
    return {
      global: typeof parsed.global === 'boolean' ? parsed.global : false,
      projects: Array.isArray(parsed.projects) ? parsed.projects.filter((p: unknown) => typeof p === 'string') : [],
      installed_at: typeof parsed.installed_at === 'string' ? parsed.installed_at : new Date().toISOString(),
      version: typeof parsed.version === 'string' ? parsed.version : '0.1.0',
    };
  } catch {
    // File doesn't exist, is unreadable, or is malformed JSON
    return createDefaultRegistry();
  }
}

/**
 * Write the MCP registry to disk atomically.
 * Writes to a temp file first, then renames to the target path.
 * This prevents corruption if the process is killed mid-write.
 */
export async function writeRegistry(registry: McpRegistry): Promise<void> {
  const fs = await import('node:fs/promises');

  await ensureRegistryDir();

  const filePath = getRegistryPath();
  const tempPath = filePath + `.tmp.${process.pid}`;

  const content = JSON.stringify(registry, null, 2) + '\n';

  try {
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Add a project path to the registry.
 * Deduplicates — if the path already exists, it's not added again.
 * Creates the registry file if it doesn't exist.
 *
 * @param projectPath - Absolute path to the project directory
 */
export async function addProject(projectPath: string): Promise<McpRegistry> {
  const registry = await readRegistry();

  if (!registry.projects.includes(projectPath)) {
    registry.projects.push(projectPath);
  }

  await writeRegistry(registry);
  return registry;
}

/**
 * Remove a project path from the registry.
 * No-op if the path doesn't exist in the registry.
 *
 * @param projectPath - Absolute path to the project directory
 */
export async function removeProject(projectPath: string): Promise<McpRegistry> {
  const registry = await readRegistry();

  registry.projects = registry.projects.filter((p) => p !== projectPath);

  await writeRegistry(registry);
  return registry;
}

/**
 * Set or clear the global flag in the registry.
 * When true, indicates that ~/.mcp.json was written (global MCP config).
 * When false, indicates only per-project .mcp.json files exist.
 *
 * @param value - true to set, false to clear
 */
export async function setGlobal(value: boolean): Promise<McpRegistry> {
  const registry = await readRegistry();

  registry.global = value;

  await writeRegistry(registry);
  return registry;
}

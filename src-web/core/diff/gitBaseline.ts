/**
 * Git baseline reader — reads canvas YAML files from a git ref.
 *
 * Supports three platform strategies:
 * 1. Tauri: shell command via @tauri-apps/plugin-shell
 * 2. Node.js: child_process (for test/CLI environments)
 * 3. Web fallback: manual paste (returns empty map)
 */

import type { Canvas } from '@/types';
import { parseCanvas } from '@/storage/yamlCodec';
import type { FileSystem } from '@/platform/fileSystem';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface GitBaselineResult {
  /** Map of canvasId → raw YAML content from the git ref */
  yamls: Map<string, string>;
  /** Map of canvasId → parsed Canvas from the git ref */
  canvases: Map<string, Canvas>;
  /** Files that failed to parse from the ref */
  errors: Array<{ canvasId: string; error: string }>;
  /** The ref that was read */
  ref: string;
}

// ---------------------------------------------------------------------------
// Git command execution
// ---------------------------------------------------------------------------

async function execGitShow(
  projectPath: string,
  ref: string,
  filePath: string,
): Promise<string | null> {
  // Try Tauri shell first
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { Command } = await import('@tauri-apps/plugin-shell');
      const result = await Command.create('git', ['show', `${ref}:${filePath}`], {
        cwd: projectPath,
      }).execute();
      if (result.code === 0) return result.stdout;
      // Non-zero exit = file doesn't exist in this ref (expected for new files)
      return null;
    } catch (err) {
      console.warn(`[diff] git show failed for ${ref}:${filePath}:`, err);
      return null;
    }
  }

  // Try Node.js child_process (test/CLI environments)
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('git', ['show', `${ref}:${filePath}`], {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 10000,
      });
      return result;
    } catch (err) {
      console.warn(`[diff] git show failed for ${ref}:${filePath}:`, err);
      return null;
    }
  }

  return null;
}

/**
 * Check if a git repository exists at the given path.
 */
/**
 * Check if a git repository exists at the given path.
 * Throws on unexpected errors (e.g. shell scope misconfiguration).
 * Returns false only when the path genuinely isn't a git repo.
 */
export async function isGitRepo(projectPath: string): Promise<boolean> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { Command } = await import('@tauri-apps/plugin-shell');
      const result = await Command.create('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: projectPath,
      }).execute();
      return result.code === 0;
    } catch (err) {
      // Shell scope misconfiguration, git not installed, etc. — don't hide this.
      throw new Error(
        `Failed to run git command (is the Tauri shell scope configured for "git"?): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const { execFileSync } = await import('child_process');
      execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 5000,
      });
      return true;
    } catch (err: unknown) {
      // Distinguish "not a repo" (exit code 128) from unexpected failures
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 128) {
        return false;
      }
      throw new Error(
        `Failed to run git command: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  return false;
}

/**
 * List canvas YAML files known to the project.
 */
async function listCanvasFiles(fs: FileSystem): Promise<string[]> {
  try {
    const files = await fs.listFiles('.archcanvas');
    return files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Read all canvas YAML files from a git ref and parse them.
 *
 * @param projectPath - Absolute path to the project root
 * @param ref - Git ref to read from (default: "HEAD")
 * @param fs - FileSystem instance to discover canvas files
 */
export async function readGitBaseline(
  projectPath: string,
  ref: string = 'HEAD',
  fs: FileSystem,
): Promise<GitBaselineResult> {
  const canvasFiles = await listCanvasFiles(fs);

  const yamls = new Map<string, string>();
  const canvases = new Map<string, Canvas>();
  const errors: Array<{ canvasId: string; error: string }> = [];

  for (const file of canvasFiles) {
    const gitPath = `.archcanvas/${file}`;
    const yaml = await execGitShow(projectPath, ref, gitPath);
    if (yaml === null) continue; // File doesn't exist in this ref

    // Derive canvas ID from filename (main.yaml → __root__, others → basename without ext)
    const canvasId = file === 'main.yaml'
      ? '__root__'
      : file.replace(/\.(yaml|yml)$/, '');

    yamls.set(canvasId, yaml);

    try {
      const parsed = parseCanvas(yaml);
      canvases.set(canvasId, parsed.data);
    } catch (err) {
      errors.push({
        canvasId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Store empty canvas as fallback
      canvases.set(canvasId, { nodes: [], edges: [], entities: [] });
    }
  }

  return { yamls, canvases, errors, ref };
}

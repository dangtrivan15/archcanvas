import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { FileSystem } from '../platform/fileSystem';
import { createFileSystem } from '../platform/index';
import { useFileStore } from '../store/fileStore';
import { useRegistryStore } from '../store/registryStore';
import { ROOT_CANVAS_KEY } from '../storage/fileResolver';
import { CLIError } from './errors';

export interface CLIContext {
  fs: FileSystem;
}

/**
 * Load the project context for CLI commands.
 *
 * 1. Resolve the project root (explicit path or walk cwd upward for .archcanvas/).
 * 2. Create a NodeFileSystem via the universal factory.
 * 3. Open the project via fileStore.
 * 4. Initialize the registry (builtins from TS objects).
 * 5. Return { fs }.
 */
export async function loadContext(
  projectPath?: string,
): Promise<CLIContext> {
  const resolvedPath = projectPath
    ? resolve(projectPath)
    : findProjectRoot(process.cwd());

  if (!resolvedPath) {
    throw new CLIError(
      'PROJECT_NOT_FOUND',
      'No .archcanvas/ directory found in current directory or any parent.',
    );
  }

  const fs = await createFileSystem(resolvedPath);

  // Open the project via fileStore
  const fileStore = useFileStore.getState();
  await fileStore.openProject(fs);

  // Check if loading succeeded
  const { status, error } = useFileStore.getState();
  if (status === 'error') {
    throw new CLIError(
      'PROJECT_LOAD_FAILED',
      error ?? 'Unknown error loading project.',
    );
  }

  // Initialize the NodeDef registry (builtins from static TS objects)
  await useRegistryStore.getState().initialize();

  return { fs };
}

/**
 * Map a --scope flag value to a canvasId.
 *
 * - undefined or 'root' → ROOT_CANVAS_KEY ('__root__')
 * - anything else → pass through as-is
 */
export function resolveCanvasId(scope?: string): string {
  if (scope === undefined || scope === 'root') {
    return ROOT_CANVAS_KEY;
  }
  return scope;
}

/**
 * Walk from `startDir` upward looking for a directory that contains `.archcanvas/`.
 * Returns the directory path (not the .archcanvas/ path itself), or null if not found.
 */
function findProjectRoot(startDir: string): string | null {
  let dir = resolve(startDir);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = resolve(dir, '.archcanvas');
    if (existsSync(candidate)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      // Reached filesystem root without finding .archcanvas/
      return null;
    }
    dir = parent;
  }
}

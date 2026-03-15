import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { FileSystem } from '../platform/fileSystem';
import { createFileSystem } from '../platform/index';
import { useFileStore } from '../store/fileStore';
import { useRegistryStore } from '../store/registryStore';
import { ROOT_CANVAS_KEY } from '../storage/fileResolver';
import { CLIError } from './errors';

export interface CLIContext {
  fs: FileSystem | null;
  bridgeUrl: string | null;
}

/**
 * The base URL for the AI bridge endpoint.
 * The dev server uses `strictPort: true` in vite.config.ts, so port 5173 is
 * guaranteed — if the port is taken the server refuses to start rather than
 * picking a random one. This makes the health-check URL deterministic.
 *
 * Override via ARCHCANVAS_BRIDGE_PORT for testing (e.g. 4173 to match the
 * Playwright test server port, where no bridge plugin is active).
 */
const BRIDGE_PORT = process.env.ARCHCANVAS_BRIDGE_PORT ?? '5173';
const BRIDGE_BASE_URL = `http://localhost:${BRIDGE_PORT}/__archcanvas_ai`;

/**
 * Probe the dev-server bridge health endpoint.
 *
 * Returns the bridge base URL if the dev server is running and the AI bridge
 * plugin is active, or `null` if the server is unreachable / times out.
 */
export async function detectBridge(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BRIDGE_BASE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return BRIDGE_BASE_URL;
    }
    return null;
  } catch {
    // Network error or abort — bridge not available
    return null;
  }
}

/**
 * Send a request to the bridge HTTP API (reads and writes).
 *
 * @param bridgeUrl - The bridge base URL (from `detectBridge()`).
 * @param action    - The API action name (e.g. 'add-node', 'list', 'catalog').
 * @param args      - The JSON body to POST.
 * @returns The parsed JSON response.
 * @throws {CLIError} on HTTP errors (non-2xx) or network failures.
 */
export async function bridgeRequest(
  bridgeUrl: string,
  action: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(`${bridgeUrl}/api/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
  } catch (err) {
    throw new CLIError(
      'BRIDGE_ERROR',
      `Bridge request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  let body: { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } };
  try {
    body = await res.json() as typeof body;
  } catch {
    throw new CLIError('BRIDGE_ERROR', `Bridge returned non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const code = body.error?.code ?? 'BRIDGE_ERROR';
    const message = body.error?.message ?? `Bridge returned HTTP ${res.status}`;
    throw new CLIError(code, message);
  }

  return body;
}

/**
 * Load the project context for CLI commands.
 *
 * When bridge is detected, the CLI is a thin transport layer — all logic
 * (validation, enrichment, reads, writes) happens in the browser's
 * in-memory stores. We skip filesystem creation, project loading, and
 * registry initialization.
 *
 * When no bridge:
 * 1. Resolve the project root (explicit path or walk cwd upward for .archcanvas/).
 * 2. Create a NodeFileSystem via the universal factory.
 * 3. Open the project via fileStore.
 * 4. Initialize the registry (builtins from TS objects).
 * 5. Return { fs, bridgeUrl: null }.
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

  // Detect bridge early — if found, skip all expensive operations
  const bridgeUrl = await detectBridge();
  if (bridgeUrl) {
    return { fs: null, bridgeUrl };
  }

  // No bridge — load project locally
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

  return { fs, bridgeUrl: null };
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

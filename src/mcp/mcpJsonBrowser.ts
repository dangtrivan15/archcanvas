/**
 * Browser-compatible MCP JSON writer using File System Access API.
 *
 * Reads/writes .mcp.json in a user-selected directory using FileSystemDirectoryHandle.
 * Provides the same merge-aware logic as mcpJson.ts but for browser contexts.
 *
 * Used by projectStore to auto-register the archcanvas MCP server config
 * when the user opens a project directory.
 */

import { ARCHCANVAS_SERVER_KEY } from './mcpJson';
import type { McpServerEntry, McpJsonFile } from './mcpJson';

export { ARCHCANVAS_SERVER_KEY };
export type { McpServerEntry, McpJsonFile };

const MCP_JSON_FILENAME = '.mcp.json';

/**
 * Build the default archcanvas MCP server entry for .mcp.json.
 * Uses '.archcanvas/main.archc' as the default file path since we're
 * registering for the project that was just opened.
 */
export function buildArchcanvasEntryBrowser(): McpServerEntry {
  return {
    command: 'npx',
    args: ['archcanvas-mcp', '.archcanvas/main.archc'],
  };
}

/**
 * Read and parse .mcp.json from a directory handle.
 * Returns null if the file doesn't exist.
 * Returns { content, raw } if the file exists and is valid JSON.
 * Throws if the file exists but is malformed.
 */
async function readMcpJsonFromDir(
  dirHandle: FileSystemDirectoryHandle,
): Promise<{ content: McpJsonFile; raw: string } | null> {
  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await dirHandle.getFileHandle(MCP_JSON_FILENAME);
  } catch (err) {
    // File doesn't exist
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return null;
    }
    throw err;
  }

  const file = await fileHandle.getFile();
  const raw = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON — treat as if not present but warn
    console.warn('[MCP] .mcp.json contains invalid JSON, will overwrite');
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.warn('[MCP] .mcp.json has unexpected shape, will overwrite');
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (!('mcpServers' in obj) || typeof obj.mcpServers !== 'object' || obj.mcpServers === null) {
    return { content: { ...obj, mcpServers: {} } as McpJsonFile, raw };
  }

  return { content: obj as McpJsonFile, raw };
}

/**
 * Write .mcp.json content to a directory handle.
 */
async function writeMcpJsonToDir(
  dirHandle: FileSystemDirectoryHandle,
  content: McpJsonFile,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(MCP_JSON_FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  const jsonStr = JSON.stringify(content, null, 2) + '\n';
  await writable.write(jsonStr);
  await writable.close();
}

export interface AutoRegisterResult {
  /** Whether the operation was performed (false = skipped because already present) */
  written: boolean;
  /** Whether a new file was created (vs merging into existing) */
  created: boolean;
  /** Whether other servers were preserved during merge */
  merged: boolean;
}

/**
 * Auto-register the archcanvas MCP server entry in .mcp.json within the given
 * project directory. This is the main entry point called by projectStore.
 *
 * - If .mcp.json doesn't exist, creates it with the archcanvas entry.
 * - If .mcp.json exists and already has the archcanvas entry, skips (no-op).
 * - If .mcp.json exists with other servers, merges without overwriting them.
 * - Handles errors gracefully: logs warnings, never throws.
 *
 * @param dirHandle - The directory handle for the project folder (has write permission)
 * @returns Result object describing what happened, or null if an error occurred
 */
export async function autoRegisterMcpConfig(
  dirHandle: FileSystemDirectoryHandle,
): Promise<AutoRegisterResult | null> {
  try {
    const existing = await readMcpJsonFromDir(dirHandle);

    if (existing !== null) {
      // Check if archcanvas entry already exists — skip if so
      if (ARCHCANVAS_SERVER_KEY in existing.content.mcpServers) {
        return { written: false, created: false, merged: false };
      }

      // Merge: add archcanvas entry alongside existing servers
      existing.content.mcpServers[ARCHCANVAS_SERVER_KEY] = buildArchcanvasEntryBrowser();
      await writeMcpJsonToDir(dirHandle, existing.content);
      return { written: true, created: false, merged: true };
    }

    // File doesn't exist — create new
    const content: McpJsonFile = {
      mcpServers: { [ARCHCANVAS_SERVER_KEY]: buildArchcanvasEntryBrowser() },
    };
    await writeMcpJsonToDir(dirHandle, content);
    return { written: true, created: true, merged: false };
  } catch (err) {
    // Handle write permission denied gracefully
    if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
      console.warn('[MCP] Permission denied writing .mcp.json — skipping MCP auto-registration');
    } else {
      console.warn('[MCP] Failed to auto-register MCP config:', err);
    }
    return null;
  }
}

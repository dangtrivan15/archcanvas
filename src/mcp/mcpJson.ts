/**
 * Merge-aware .mcp.json writer
 *
 * Writes/merges/removes the archcanvas MCP server entry in a .mcp.json file.
 * - If the file doesn't exist, creates it with the archcanvas entry.
 * - If the file exists with other servers, merges without disturbing them.
 * - If the archcanvas entry already exists, overwrites it (idempotent).
 * - For removal, deletes only the archcanvas key.
 * - Deletes the file entirely if no other servers remain after removal.
 * - Handles malformed .mcp.json gracefully (warns and backs up before overwriting).
 */

import { dirname } from 'node:path';

// Re-export shared types/constants for backward compatibility
export { ARCHCANVAS_SERVER_KEY } from './mcpJsonShared';
export type { McpServerEntry, McpJsonFile } from './mcpJsonShared';

import { ARCHCANVAS_SERVER_KEY } from './mcpJsonShared';
import type { McpServerEntry, McpJsonFile } from './mcpJsonShared';

/**
 * Build the archcanvas server entry for .mcp.json.
 *
 * @param archcFilePath - Path to the .archc file this server should serve
 * @returns The server entry object
 */
export function buildArchcanvasEntry(archcFilePath: string): McpServerEntry {
  return {
    command: 'archcanvas',
    args: ['mcp', '--file', archcFilePath],
  };
}

/**
 * Read and parse an existing .mcp.json file.
 * Returns null if the file doesn't exist.
 * Throws McpJsonMalformedError if the file exists but is not valid JSON.
 */
async function readMcpJsonFile(
  filePath: string,
): Promise<{ content: McpJsonFile; raw: string } | null> {
  const fs = await import('node:fs/promises');

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new McpJsonMalformedError(filePath, raw);
  }

  // Validate basic shape
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new McpJsonMalformedError(filePath, raw);
  }

  const obj = parsed as Record<string, unknown>;

  // If mcpServers is missing, treat as empty
  if (!('mcpServers' in obj) || typeof obj.mcpServers !== 'object' || obj.mcpServers === null) {
    return { content: { ...obj, mcpServers: {} } as McpJsonFile, raw };
  }

  return { content: obj as McpJsonFile, raw };
}

/** Error thrown when .mcp.json exists but contains malformed content */
export class McpJsonMalformedError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly rawContent: string,
  ) {
    super(`Malformed .mcp.json at ${filePath}`);
    this.name = 'McpJsonMalformedError';
  }
}

/**
 * Back up a malformed .mcp.json file before overwriting.
 * Creates a .mcp.json.bak file alongside the original.
 */
async function backupMalformed(filePath: string, rawContent: string): Promise<string> {
  const fs = await import('node:fs/promises');
  const backupPath = filePath + '.bak';
  await fs.writeFile(backupPath, rawContent, 'utf-8');
  return backupPath;
}

/**
 * Write a custom MCP server entry into a .mcp.json file under the archcanvas key.
 *
 * - If the file doesn't exist, creates it with the entry.
 * - If the file exists with other servers, merges without disturbing them.
 * - If the archcanvas entry already exists, overwrites it (idempotent).
 * - If the file is malformed JSON, backs it up and creates a fresh file.
 *
 * @param mcpJsonPath - Absolute path to the .mcp.json file
 * @param entry - The MCP server entry to write
 * @returns Object with info about what happened
 */
export async function writeMcpJsonEntry(
  mcpJsonPath: string,
  entry: McpServerEntry,
): Promise<{ created: boolean; merged: boolean; backedUp: string | null }> {
  return _writeMcpJsonImpl(mcpJsonPath, entry);
}

/**
 * Write the archcanvas MCP server entry into a .mcp.json file.
 *
 * - If the file doesn't exist, creates it with the archcanvas entry.
 * - If the file exists with other servers, merges without disturbing them.
 * - If the archcanvas entry already exists, overwrites it (idempotent).
 * - If the file is malformed JSON, backs it up and creates a fresh file.
 *
 * @param mcpJsonPath - Absolute path to the .mcp.json file
 * @param archcFilePath - Path to the .archc file to serve
 * @returns Object with info about what happened
 */
export async function writeMcpJson(
  mcpJsonPath: string,
  archcFilePath: string,
): Promise<{ created: boolean; merged: boolean; backedUp: string | null }> {
  const entry = buildArchcanvasEntry(archcFilePath);
  return _writeMcpJsonImpl(mcpJsonPath, entry);
}

/** Shared implementation for writeMcpJson and writeMcpJsonEntry */
async function _writeMcpJsonImpl(
  mcpJsonPath: string,
  entry: McpServerEntry,
): Promise<{ created: boolean; merged: boolean; backedUp: string | null }> {
  const fs = await import('node:fs/promises');

  let content: McpJsonFile;
  let created = false;
  let merged = false;
  let backedUp: string | null = null;

  try {
    const existing = await readMcpJsonFile(mcpJsonPath);

    if (existing === null) {
      // File doesn't exist — create new
      content = { mcpServers: { [ARCHCANVAS_SERVER_KEY]: entry } };
      created = true;
    } else {
      // File exists — merge
      content = existing.content;
      const hadOtherServers = Object.keys(content.mcpServers).some(
        (k) => k !== ARCHCANVAS_SERVER_KEY,
      );
      const hadArchcanvas = ARCHCANVAS_SERVER_KEY in content.mcpServers;
      content.mcpServers[ARCHCANVAS_SERVER_KEY] = entry;
      merged = hadOtherServers || hadArchcanvas;
    }
  } catch (err) {
    if (err instanceof McpJsonMalformedError) {
      // Back up the malformed file, then create fresh
      backedUp = await backupMalformed(mcpJsonPath, err.rawContent);
      content = { mcpServers: { [ARCHCANVAS_SERVER_KEY]: entry } };
      created = true;
    } else {
      throw err;
    }
  }

  // Ensure parent directory exists
  await fs.mkdir(dirname(mcpJsonPath), { recursive: true });

  // Write atomically via temp file
  const tempPath = mcpJsonPath + `.tmp.${process.pid}`;
  const jsonStr = JSON.stringify(content, null, 2) + '\n';

  try {
    await fs.writeFile(tempPath, jsonStr, 'utf-8');
    await fs.rename(tempPath, mcpJsonPath);
  } catch (writeErr) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw writeErr;
  }

  return { created, merged, backedUp };
}

/**
 * Remove the archcanvas MCP server entry from a .mcp.json file.
 *
 * - If the file doesn't exist, this is a no-op.
 * - If archcanvas is the only server, deletes the file entirely.
 * - If other servers remain, rewrites the file without archcanvas.
 * - If the file is malformed, backs it up and removes it.
 *
 * @param mcpJsonPath - Absolute path to the .mcp.json file
 * @returns Object with info about what happened
 */
export async function removeMcpJson(
  mcpJsonPath: string,
): Promise<{ removed: boolean; fileDeleted: boolean; backedUp: string | null }> {
  const fs = await import('node:fs/promises');

  let backedUp: string | null = null;

  try {
    const existing = await readMcpJsonFile(mcpJsonPath);

    if (existing === null) {
      // File doesn't exist — nothing to do
      return { removed: false, fileDeleted: false, backedUp: null };
    }

    const content = existing.content;

    if (!(ARCHCANVAS_SERVER_KEY in content.mcpServers)) {
      // archcanvas entry not present — nothing to do
      return { removed: false, fileDeleted: false, backedUp: null };
    }

    // Remove the archcanvas entry
    delete content.mcpServers[ARCHCANVAS_SERVER_KEY];

    const remainingServers = Object.keys(content.mcpServers).length;

    if (remainingServers === 0) {
      // No servers remain — check if there are other top-level keys
      const otherKeys = Object.keys(content).filter((k) => k !== 'mcpServers');
      if (otherKeys.length === 0) {
        // Nothing else in the file — delete it
        await fs.unlink(mcpJsonPath);
        return { removed: true, fileDeleted: true, backedUp: null };
      }
    }

    // Other servers or top-level keys remain — rewrite file
    const tempPath = mcpJsonPath + `.tmp.${process.pid}`;
    const jsonStr = JSON.stringify(content, null, 2) + '\n';

    try {
      await fs.writeFile(tempPath, jsonStr, 'utf-8');
      await fs.rename(tempPath, mcpJsonPath);
    } catch (writeErr) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw writeErr;
    }

    return { removed: true, fileDeleted: false, backedUp: null };
  } catch (err) {
    if (err instanceof McpJsonMalformedError) {
      // Back up and delete the malformed file
      backedUp = await backupMalformed(mcpJsonPath, err.rawContent);
      await fs.unlink(mcpJsonPath);
      return { removed: true, fileDeleted: true, backedUp };
    }
    throw err;
  }
}

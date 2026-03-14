/**
 * Permission persistence — saves "Always Allow" rules to disk so they
 * survive page reloads and dev server restarts.
 *
 * Storage: `.archcanvas/permissions.json` in the project root (gitignored).
 *
 * This is a Node.js-only module (used by the bridge, never bundled for browser).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { PermissionSuggestion } from './types';

// ---------------------------------------------------------------------------
// File layout
// ---------------------------------------------------------------------------

const DIR_NAME = '.archcanvas';
const FILE_NAME = 'permissions.json';

interface PermissionsFile {
  version: 1;
  permissions: PermissionSuggestion[];
}

function permissionsPath(cwd: string): string {
  return join(cwd, DIR_NAME, FILE_NAME);
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

export function loadPermissions(cwd: string): PermissionSuggestion[] {
  const path = permissionsPath(cwd);
  if (!existsSync(path)) return [];
  try {
    const data: PermissionsFile = JSON.parse(readFileSync(path, 'utf-8'));
    if (data.version !== 1 || !Array.isArray(data.permissions)) return [];
    return data.permissions;
  } catch {
    return [];
  }
}

export function savePermission(cwd: string, suggestion: PermissionSuggestion): void {
  const existing = loadPermissions(cwd);

  // Deduplicate
  if (suggestion.type === 'addRules') {
    for (const rule of suggestion.rules) {
      const dup = existing.some(
        (p) =>
          p.type === 'addRules' &&
          p.behavior === suggestion.behavior &&
          p.rules.some(
            (r) => r.toolName === rule.toolName && r.ruleContent === rule.ruleContent,
          ),
      );
      if (dup) return;
    }
  } else if (suggestion.type === 'addDirectories') {
    const existingDirs = new Set(
      existing
        .filter((p): p is Extract<PermissionSuggestion, { type: 'addDirectories' }> => p.type === 'addDirectories')
        .flatMap((p) => p.directories),
    );
    const allExist = suggestion.directories.every((d) => existingDirs.has(d));
    if (allExist) return;
  }

  existing.push(suggestion);

  const dir = join(cwd, DIR_NAME);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const data: PermissionsFile = { version: 1, permissions: existing };
  writeFileSync(permissionsPath(cwd), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Match a Claude Code permission pattern against a command string.
 *
 * Claude Code uses `executable:*` syntax where the part before `:` is the
 * command name and `*` matches any arguments.  Examples:
 *   - `archcanvas:*`  → matches `archcanvas list --json`, `archcanvas add-node`
 *   - `npm:*`         → matches `npm install`, `npm test`
 *   - `git:*`         → matches `git status`, `git commit -m "..."`
 *
 * Also handles plain glob patterns (no colon):
 *   - `*`             → matches everything
 *   - `foo`           → exact match
 */
function matchesPattern(pattern: string, command: string): boolean {
  // Claude Code syntax: "executable:glob"
  const colonIdx = pattern.indexOf(':');
  if (colonIdx !== -1) {
    const executable = pattern.slice(0, colonIdx);
    const glob = pattern.slice(colonIdx + 1);

    // Extract the first word (executable) from the command
    const firstSpace = command.indexOf(' ');
    const cmdExecutable = firstSpace === -1 ? command : command.slice(0, firstSpace);

    if (cmdExecutable !== executable) return false;
    if (glob === '*') return true;

    // Match the glob against the rest of the command
    const rest = firstSpace === -1 ? '' : command.slice(firstSpace + 1);
    return globMatch(glob, rest);
  }

  // Plain glob (no colon separator)
  return globMatch(pattern, command);
}

/**
 * Simple glob matching: `*` matches any sequence of characters.
 */
function globMatch(pattern: string, str: string): boolean {
  if (pattern === '*') return true;

  const parts = pattern.split('*');
  if (parts.length === 1) return pattern === str;

  // Must start with first segment and end with last segment
  if (!str.startsWith(parts[0])) return false;
  if (!str.endsWith(parts[parts.length - 1])) return false;

  // Check middle segments appear in order
  let pos = parts[0].length;
  for (let i = 1; i < parts.length - 1; i++) {
    const idx = str.indexOf(parts[i], pos);
    if (idx === -1) return false;
    pos = idx + parts[i].length;
  }
  return true;
}

/**
 * Check whether a tool invocation is auto-approved by saved permissions.
 */
export function isAutoApproved(
  permissions: PermissionSuggestion[],
  toolName: string,
  input: Record<string, unknown>,
): boolean {
  for (const perm of permissions) {
    if (perm.type === 'addRules') {
      if (perm.behavior !== 'allow') continue;
      for (const rule of perm.rules) {
        if (rule.toolName !== toolName) continue;
        // No ruleContent → match all invocations of this tool
        if (!rule.ruleContent) return true;
        // Pattern match against the command string
        const command = typeof input.command === 'string' ? input.command : '';
        if (command && matchesPattern(rule.ruleContent, command)) return true;
      }
    } else if (perm.type === 'addDirectories') {
      // For file tools (Read, Write, Edit, Glob, Grep), check path
      const filePath =
        typeof input.file_path === 'string'
          ? input.file_path
          : typeof input.path === 'string'
            ? input.path
            : '';
      if (filePath) {
        for (const dir of perm.directories) {
          if (filePath.startsWith(dir)) return true;
        }
      }
    }
  }
  return false;
}

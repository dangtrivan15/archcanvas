/**
 * Filesystem Scanner with Gitignore Support
 *
 * Recursively walks a directory, collecting file metadata while respecting
 * .gitignore rules. Produces a structured FileTree with directory hierarchy
 * and file statistics.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  relativePath: string;
  size: number;
  extension: string;
  lastModified: number; // epoch ms
}

export interface DirectoryEntry {
  name: string;
  relativePath: string;
  files: FileEntry[];
  directories: DirectoryEntry[];
}

export interface FileTree {
  root: DirectoryEntry;
}

export interface LanguageBreakdown {
  [extension: string]: number;
}

export interface ScanResult {
  fileTree: FileTree;
  totalFiles: number;
  totalDirs: number;
  languageBreakdown: LanguageBreakdown;
}

export interface ScanOptions {
  maxDepth?: number;        // default 10
  maxFiles?: number;        // default 10000
  additionalIgnore?: string[]; // extra glob-like patterns to ignore
}

// ── Built-in ignore patterns ─────────────────────────────────────────────────

const BUILTIN_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '__pycache__',
  'target',
  'vendor',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'coverage',
  '.cache',
  '.turbo',
  '.parcel-cache',
  '.output',
]);

// ── Gitignore Parser ─────────────────────────────────────────────────────────

interface IgnoreRule {
  pattern: string;
  negated: boolean;
  dirOnly: boolean;
  regex: RegExp;
}

/**
 * Parse a .gitignore file content into a list of rules.
 */
export function parseGitignore(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];

  for (let line of content.split('\n')) {
    line = line.trimEnd();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Handle trailing spaces (only if not escaped)
    line = line.replace(/(?<!\\)\s+$/, '');
    if (!line) continue;

    let negated = false;
    if (line.startsWith('!')) {
      negated = true;
      line = line.slice(1);
    }

    // Remove leading backslash (escape for # or !)
    if (line.startsWith('\\')) {
      line = line.slice(1);
    }

    let dirOnly = false;
    if (line.endsWith('/')) {
      dirOnly = true;
      line = line.slice(0, -1);
    }

    const regex = gitignorePatternToRegex(line);
    rules.push({ pattern: line, negated, dirOnly, regex });
  }

  return rules;
}

/**
 * Convert a gitignore glob pattern to a RegExp.
 * Supports: *, **, ?, character classes [abc], path separators.
 */
function gitignorePatternToRegex(pattern: string): RegExp {
  // If pattern contains a slash (not trailing, which we removed), it's relative to the .gitignore location
  const hasSlash = pattern.includes('/');

  let regexStr = '';
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // **
        if (pattern[i + 2] === '/') {
          // **/ matches zero or more directories
          regexStr += '(?:.+/)?';
          i += 3;
          continue;
        } else if (i + 2 === pattern.length) {
          // trailing ** matches everything
          regexStr += '.*';
          i += 2;
          continue;
        } else {
          // ** in middle without /
          regexStr += '.*';
          i += 2;
          continue;
        }
      } else {
        // single * matches anything except /
        regexStr += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      regexStr += '[^/]';
      i++;
    } else if (ch === '[') {
      // Character class - find the closing bracket
      const end = pattern.indexOf(']', i + 1);
      if (end === -1) {
        regexStr += '\\[';
        i++;
      } else {
        regexStr += pattern.slice(i, end + 1);
        i = end + 1;
      }
    } else if (ch === '\\') {
      // Escaped character
      if (i + 1 < pattern.length) {
        regexStr += '\\' + pattern[i + 1];
        i += 2;
      } else {
        regexStr += '\\\\';
        i++;
      }
    } else if ('.+^${}()|'.includes(ch)) {
      regexStr += '\\' + ch;
      i++;
    } else {
      regexStr += ch;
      i++;
    }
  }

  // If pattern has no slash, it matches against the basename only
  // If pattern has a slash, it matches against the relative path
  if (!hasSlash) {
    // Match against basename: the pattern should match the last path component
    return new RegExp(`(?:^|/)${regexStr}$`);
  } else {
    // Match against relative path from .gitignore location
    return new RegExp(`^${regexStr}$`);
  }
}

/**
 * Check if a relative path is ignored by the given rules.
 * @param relativePath - Path relative to the .gitignore location (forward slashes)
 * @param isDirectory - Whether the path is a directory
 * @param rules - Parsed gitignore rules
 */
export function isIgnored(
  relativePath: string,
  isDirectory: boolean,
  rules: IgnoreRule[],
): boolean {
  let ignored = false;

  for (const rule of rules) {
    if (rule.dirOnly && !isDirectory) continue;

    const matches = rule.regex.test(relativePath);
    if (matches) {
      ignored = !rule.negated;
    }
  }

  return ignored;
}

// ── Scanner ──────────────────────────────────────────────────────────────────

/**
 * Scan a directory recursively, building a FileTree.
 */
export async function scanDirectory(
  rootPath: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const maxDepth = options.maxDepth ?? 10;
  const maxFiles = options.maxFiles ?? 10000;
  const additionalIgnore = options.additionalIgnore ?? [];

  // Parse additional ignore patterns as gitignore rules
  const additionalRules = additionalIgnore.length > 0
    ? parseGitignore(additionalIgnore.join('\n'))
    : [];

  const resolvedRoot = path.resolve(rootPath);
  const languageBreakdown: LanguageBreakdown = {};
  let totalFiles = 0;
  let totalDirs = 0;
  let fileLimitReached = false;

  /**
   * Load .gitignore rules for a directory (if the file exists).
   */
  function loadGitignoreRules(dirPath: string): IgnoreRule[] {
    const gitignorePath = path.join(dirPath, '.gitignore');
    try {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      return parseGitignore(content);
    } catch {
      return [];
    }
  }

  /**
   * Recursively walk a directory.
   */
  function walk(
    dirPath: string,
    depth: number,
    parentRules: IgnoreRule[],
  ): DirectoryEntry {
    const dirName = path.basename(dirPath);
    const relativePath = path.relative(resolvedRoot, dirPath).replace(/\\/g, '/');

    const entry: DirectoryEntry = {
      name: dirName,
      relativePath: relativePath || '.',
      files: [],
      directories: [],
    };

    if (depth > maxDepth || fileLimitReached) {
      return entry;
    }

    // Load this directory's .gitignore and merge with parent rules
    const localRules = loadGitignoreRules(dirPath);
    const combinedRules = [...parentRules, ...localRules];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return entry;
    }

    // Sort for deterministic output
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const dirent of entries) {
      if (fileLimitReached) break;

      const childPath = path.join(dirPath, dirent.name);
      const childRelative = path.relative(resolvedRoot, childPath).replace(/\\/g, '/');

      if (dirent.isDirectory()) {
        // Check built-in ignores
        if (BUILTIN_IGNORE_DIRS.has(dirent.name)) continue;

        // Check gitignore rules
        if (isIgnored(childRelative, true, combinedRules)) continue;
        if (isIgnored(childRelative, true, additionalRules)) continue;

        totalDirs++;
        const subDir = walk(childPath, depth + 1, combinedRules);
        entry.directories.push(subDir);
      } else if (dirent.isFile()) {
        // Check gitignore rules
        if (isIgnored(childRelative, false, combinedRules)) continue;
        if (isIgnored(childRelative, false, additionalRules)) continue;

        if (totalFiles >= maxFiles) {
          fileLimitReached = true;
          break;
        }

        let stat: fs.Stats;
        try {
          stat = fs.statSync(childPath);
        } catch {
          continue;
        }

        const ext = path.extname(dirent.name).toLowerCase();

        const fileEntry: FileEntry = {
          name: dirent.name,
          relativePath: childRelative,
          size: stat.size,
          extension: ext,
          lastModified: stat.mtimeMs,
        };

        entry.files.push(fileEntry);
        totalFiles++;

        // Update language breakdown
        const langKey = ext || '(no extension)';
        languageBreakdown[langKey] = (languageBreakdown[langKey] ?? 0) + 1;
      }
      // Skip symlinks, sockets, etc.
    }

    return entry;
  }

  const rootDir = walk(resolvedRoot, 0, []);

  return {
    fileTree: { root: rootDir },
    totalFiles,
    totalDirs,
    languageBreakdown,
  };
}

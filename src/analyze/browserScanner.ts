/**
 * Browser-compatible filesystem scanner.
 *
 * Uses the File System Access API (FileSystemDirectoryHandle) to recursively
 * walk a directory and build a ScanResult compatible with the Node.js scanner.
 * This allows the existing detector, file selector, and pipeline to work
 * unchanged in the browser environment.
 */

import type {
  FileEntry,
  DirectoryEntry,
  FileTree,
  LanguageBreakdown,
  ScanResult,
  ScanOptions,
} from './scanner';
import { parseGitignore, isIgnored } from './scanner';

// ── Built-in ignore patterns (same as Node.js scanner) ──────────────────────

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

// ── Browser Scanner ─────────────────────────────────────────────────────────

/**
 * Read a text file from a directory handle, returning its content or null.
 */
async function readTextFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<string | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

/**
 * Get file extension from a filename (lowercase, including the dot).
 */
function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(dotIndex).toLowerCase() : '';
}

/**
 * Scan a directory using the File System Access API, building the same
 * ScanResult structure as the Node.js scanner.
 *
 * @param dirHandle - FileSystemDirectoryHandle from showDirectoryPicker()
 * @param options - Scan options (maxDepth, maxFiles, additionalIgnore)
 * @param signal - Optional AbortSignal for cancellation
 * @returns ScanResult compatible with the Node.js scanner output
 */
export async function scanDirectoryBrowser(
  dirHandle: FileSystemDirectoryHandle,
  options: ScanOptions = {},
  signal?: AbortSignal,
): Promise<ScanResult> {
  const maxDepth = options.maxDepth ?? 10;
  const maxFiles = options.maxFiles ?? 10000;
  const additionalIgnore = options.additionalIgnore ?? [];

  const additionalRules =
    additionalIgnore.length > 0 ? parseGitignore(additionalIgnore.join('\n')) : [];

  const languageBreakdown: LanguageBreakdown = {};
  let totalFiles = 0;
  let totalDirs = 0;
  let fileLimitReached = false;

  /**
   * Recursively walk a directory handle.
   */
  async function walk(
    handle: FileSystemDirectoryHandle,
    relativePath: string,
    depth: number,
    parentRules: import('./scanner').IgnoreRule[],
  ): Promise<DirectoryEntry> {
    const entry: DirectoryEntry = {
      name: handle.name,
      relativePath: relativePath || '.',
      files: [],
      directories: [],
    };

    if (depth > maxDepth || fileLimitReached) {
      return entry;
    }

    if (signal?.aborted) throw new Error('Scan aborted');

    // Try to read .gitignore in this directory
    const gitignoreContent = await readTextFile(handle, '.gitignore');
    const localRules = gitignoreContent ? parseGitignore(gitignoreContent) : [];
    const combinedRules = [...parentRules, ...localRules];

    // Collect entries and sort for deterministic output
    const entries: Array<{ name: string; kind: 'file' | 'directory'; handle: FileSystemHandle }> = [];
    for await (const [name, childHandle] of handle.entries()) {
      entries.push({ name, kind: childHandle.kind, handle: childHandle });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const child of entries) {
      if (fileLimitReached) break;
      if (signal?.aborted) throw new Error('Scan aborted');

      const childRelative = relativePath ? `${relativePath}/${child.name}` : child.name;

      if (child.kind === 'directory') {
        // Check built-in ignores
        if (BUILTIN_IGNORE_DIRS.has(child.name)) continue;

        // Check gitignore rules
        if (isIgnored(childRelative, true, combinedRules)) continue;
        if (isIgnored(childRelative, true, additionalRules)) continue;

        totalDirs++;
        const subDir = await walk(
          child.handle as FileSystemDirectoryHandle,
          childRelative,
          depth + 1,
          combinedRules,
        );
        entry.directories.push(subDir);
      } else if (child.kind === 'file') {
        // Check gitignore rules
        if (isIgnored(childRelative, false, combinedRules)) continue;
        if (isIgnored(childRelative, false, additionalRules)) continue;

        if (totalFiles >= maxFiles) {
          fileLimitReached = true;
          break;
        }

        // Get file metadata
        const fileHandle = child.handle as FileSystemFileHandle;
        let file: File;
        try {
          file = await fileHandle.getFile();
        } catch {
          continue;
        }

        const ext = getExtension(child.name);

        const fileEntry: FileEntry = {
          name: child.name,
          relativePath: childRelative,
          size: file.size,
          extension: ext,
          lastModified: file.lastModified,
        };

        entry.files.push(fileEntry);
        totalFiles++;

        // Update language breakdown
        const langKey = ext || '(no extension)';
        languageBreakdown[langKey] = (languageBreakdown[langKey] ?? 0) + 1;
      }
    }

    return entry;
  }

  const rootDir = await walk(dirHandle, '', 0, []);

  return {
    fileTree: { root: rootDir },
    totalFiles,
    totalDirs,
    languageBreakdown,
  };
}

/**
 * Read a file's text content from a directory handle by relative path.
 * Handles nested paths by traversing subdirectory handles.
 *
 * @param dirHandle - Root directory handle
 * @param relativePath - Forward-slash-separated relative path
 * @param maxLines - Maximum lines to read (truncates after this)
 * @returns File content as a string, or a placeholder on error
 */
export async function readFileBrowser(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
  maxLines: number = 500,
): Promise<string> {
  try {
    const parts = relativePath.split('/');
    let currentDir = dirHandle;

    // Navigate to the correct subdirectory
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i]!);
    }

    const fileName = parts[parts.length - 1]!;
    const fileHandle = await currentDir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const content = await file.text();

    const lines = content.split('\n');
    if (lines.length <= maxLines) {
      return content;
    }

    const truncated = lines.slice(0, maxLines).join('\n');
    const remainingLines = lines.length - maxLines;
    return truncated + `\n\n// ... truncated (${remainingLines} more lines)`;
  } catch {
    return '// [File could not be read]';
  }
}

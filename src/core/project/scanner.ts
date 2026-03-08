/**
 * Project folder scanner — discovers .archc files and reads/builds manifests.
 *
 * Uses the File System Access API's directory handle to scan a user-selected
 * folder. Checks for a .archcanvas/ subdirectory:
 * - If .archcanvas/ exists, scans it for .archc files (main.archc is the root).
 * - If .archcanvas/ does not exist, returns an empty project result so the UI
 *   can prompt the user to create a new project.
 *
 * For backward compatibility, also detects the legacy .archproject.json manifest
 * and .archc files at the root level (flat layout).
 */

import type { ProjectManifest } from '@/types/project';
import {
  PROJECT_MANIFEST_FILENAME,
  ARCHCANVAS_DIR_NAME,
  ARCHCANVAS_MAIN_FILE,
} from '@/types/project';
import { parseManifest, createManifest, serializeManifest } from './manifest';

/**
 * Common source file extensions to detect whether a folder contains code.
 */
export const SOURCE_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.go',
  '.java', '.kt', '.kts',
  '.rs',
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.swift',
  '.scala',
  '.dart',
  '.vue', '.svelte',
  '.lua',
  '.zig',
  '.ex', '.exs',
  '.hs',
  '.ml', '.mli',
  '.clj', '.cljs',
]);

/**
 * Result of scanning a project folder.
 */
export interface ScanResult {
  /** The parsed or generated project manifest. */
  manifest: ProjectManifest;
  /** The root directory handle selected by the user. */
  directoryHandle: FileSystemDirectoryHandle;
  /**
   * The .archcanvas/ subdirectory handle for file operations.
   * If present, all .archc reads/writes should use this handle.
   * Falls back to directoryHandle for legacy flat layouts.
   */
  archcanvasHandle: FileSystemDirectoryHandle | null;
  /** Whether the manifest was read from an existing file. */
  manifestExisted: boolean;
  /** Whether the folder contained no .archc files and no .archcanvas/ dir (empty project). */
  isEmpty: boolean;
  /** Whether the folder contains recognizable source files (only populated when isEmpty=true). */
  hasSourceFiles: boolean;
}

/**
 * Scan a directory handle for an ArchCanvas project.
 *
 * Detection order:
 * 1. Look for .archcanvas/ subdirectory (new convention).
 * 2. Fall back to .archproject.json manifest (legacy).
 * 3. Fall back to loose .archc files at root (legacy).
 * 4. If none found, return isEmpty=true.
 *
 * @param dirHandle - FileSystemDirectoryHandle from showDirectoryPicker()
 * @returns ScanResult with manifest and directory handles
 */
export async function scanProjectFolder(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ScanResult> {
  // ── 1. Check for .archcanvas/ subdirectory ───────────────────────
  let archcanvasHandle: FileSystemDirectoryHandle | null = null;
  try {
    archcanvasHandle = await dirHandle.getDirectoryHandle(ARCHCANVAS_DIR_NAME);
  } catch {
    // Directory doesn't exist — continue to legacy detection
  }

  if (archcanvasHandle) {
    return scanArchcanvasDir(dirHandle, archcanvasHandle);
  }

  // ── 2. Legacy: scan root for .archproject.json and .archc files ──
  return scanLegacyProject(dirHandle);
}

/**
 * Scan the .archcanvas/ subdirectory for .archc files.
 * Uses main.archc as the root entry point.
 */
async function scanArchcanvasDir(
  rootHandle: FileSystemDirectoryHandle,
  archcanvasHandle: FileSystemDirectoryHandle,
): Promise<ScanResult> {
  const archcFiles: string[] = [];

  for await (const entry of archcanvasHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.archc')) {
      archcFiles.push(entry.name);
    }
  }

  const projectName = rootHandle.name || 'Untitled Project';

  if (archcFiles.length === 0) {
    // .archcanvas/ exists but is empty — treat as empty project
    const emptyManifest: ProjectManifest = {
      version: 1,
      name: projectName,
      rootFile: '',
      files: [],
      links: [],
    };
    return {
      manifest: emptyManifest,
      directoryHandle: rootHandle,
      archcanvasHandle,
      manifestExisted: false,
      isEmpty: true,
      hasSourceFiles: false,
    };
  }

  // Sort for consistent ordering
  archcFiles.sort();

  // Use main.archc as root if it exists, otherwise first file
  const rootFile = archcFiles.includes(ARCHCANVAS_MAIN_FILE)
    ? ARCHCANVAS_MAIN_FILE
    : archcFiles[0]!;

  const manifest = createManifest(projectName, archcFiles, rootFile);

  return {
    manifest,
    directoryHandle: rootHandle,
    archcanvasHandle,
    manifestExisted: true, // .archcanvas/ dir serves as the "manifest"
    isEmpty: false,
    hasSourceFiles: false,
  };
}

/**
 * Legacy scanner: looks for .archproject.json and loose .archc files
 * at the root level of the selected directory.
 */
async function scanLegacyProject(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ScanResult> {
  const archcFiles: string[] = [];
  let manifestHandle: FileSystemFileHandle | null = null;
  let hasSourceFiles = false;

  // Iterate directory entries (non-recursive, top-level only)
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      if (entry.name === PROJECT_MANIFEST_FILENAME) {
        manifestHandle = entry;
      } else if (entry.name.endsWith('.archc')) {
        archcFiles.push(entry.name);
      } else {
        // Check for source file extensions
        const dotIndex = entry.name.lastIndexOf('.');
        if (dotIndex > 0) {
          const ext = entry.name.slice(dotIndex).toLowerCase();
          if (SOURCE_FILE_EXTENSIONS.has(ext)) {
            hasSourceFiles = true;
          }
        }
      }
    } else if (entry.kind === 'directory') {
      // Common source directories indicate a code project
      const srcDirs = new Set(['src', 'lib', 'app', 'pkg', 'cmd', 'internal', 'components', 'pages']);
      if (srcDirs.has(entry.name.toLowerCase())) {
        hasSourceFiles = true;
      }
    }
  }

  // If manifest exists, parse and validate it
  if (manifestHandle) {
    const file = await manifestHandle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    const manifest = parseManifest(data);
    return {
      manifest,
      directoryHandle: dirHandle,
      archcanvasHandle: null,
      manifestExisted: true,
      isEmpty: false,
      hasSourceFiles: false,
    };
  }

  const projectName = dirHandle.name || 'Untitled Project';

  // No manifest and no .archc files — return empty project result
  if (archcFiles.length === 0) {
    const emptyManifest: ProjectManifest = {
      version: 1,
      name: projectName,
      rootFile: '',
      files: [],
      links: [],
    };
    return {
      manifest: emptyManifest,
      directoryHandle: dirHandle,
      archcanvasHandle: null,
      manifestExisted: false,
      isEmpty: true,
      hasSourceFiles,
    };
  }

  // Sort alphabetically for consistent ordering
  archcFiles.sort();

  const manifest = createManifest(projectName, archcFiles);

  return {
    manifest,
    directoryHandle: dirHandle,
    archcanvasHandle: null,
    manifestExisted: false,
    isEmpty: false,
    hasSourceFiles: false,
  };
}

/**
 * Read a specific .archc file from the project directory.
 *
 * @param dirHandle - The directory handle to read from (.archcanvas/ or project root)
 * @param relativePath - Relative path to the .archc file
 * @returns Raw binary data of the .archc file
 * @throws Error if the file cannot be found or read
 */
export async function readProjectFile(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<Uint8Array> {
  // Normalize path: strip leading './' — getFileHandle only accepts bare filenames
  const normalized = relativePath.replace(/^\.\//, '');
  const fileHandle = await dirHandle.getFileHandle(normalized);
  const file = await fileHandle.getFile();
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Write the manifest to the project directory as .archproject.json.
 *
 * @param dirHandle - The project directory handle
 * @param manifest - The manifest to write
 */
export async function writeManifestToFolder(
  dirHandle: FileSystemDirectoryHandle,
  manifest: ProjectManifest,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(PROJECT_MANIFEST_FILENAME, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(serializeManifest(manifest));
  await writable.close();
}

/**
 * Write a binary .archc file to a directory.
 *
 * @param dirHandle - The directory handle (.archcanvas/ or project root)
 * @param fileName - File name (e.g., "main.archc")
 * @param data - Raw binary .archc data
 */
export async function writeArchcToFolder(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  data: Uint8Array,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

/**
 * Initialize the .archcanvas/ subdirectory inside a user-selected folder.
 * Creates the directory if it doesn't exist.
 *
 * @param dirHandle - The root directory handle from showDirectoryPicker()
 * @returns The FileSystemDirectoryHandle for the .archcanvas/ directory
 */
export async function initArchcanvasDir(
  dirHandle: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle> {
  return dirHandle.getDirectoryHandle(ARCHCANVAS_DIR_NAME, { create: true });
}

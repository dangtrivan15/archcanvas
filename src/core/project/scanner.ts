/**
 * Project folder scanner — discovers .archc files in .archcanvas/ directories.
 *
 * Uses the File System Access API's directory handle to scan a user-selected
 * folder. Checks for a .archcanvas/ subdirectory:
 * - If .archcanvas/ exists, scans it for .archc files (main.archc is the root).
 * - If .archcanvas/ does not exist, falls back to scanning for loose .archc
 *   files at the root level (legacy layout).
 * - If none found, returns isEmpty=true.
 *
 * The old .archproject.json manifest system has been removed. Project state
 * is now derived from the .archcanvas/ folder structure (ProjectDescriptor).
 */

import type { ProjectDescriptor, ProjectFile } from '@/types/project';
import {
  ARCHCANVAS_DIR_NAME,
  ARCHCANVAS_MAIN_FILE,
} from '@/types/project';

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
  /** The project descriptor derived from the folder contents. */
  manifest: ProjectDescriptor;
  /** The root directory handle selected by the user. */
  directoryHandle: FileSystemDirectoryHandle;
  /**
   * The .archcanvas/ subdirectory handle for file operations.
   * If present, all .archc reads/writes should use this handle.
   * Falls back to directoryHandle for legacy flat layouts.
   */
  archcanvasHandle: FileSystemDirectoryHandle | null;
  /** Whether the project descriptor was derived from an existing .archcanvas/ dir. */
  manifestExisted: boolean;
  /** Whether the folder contained no .archc files and no .archcanvas/ dir (empty project). */
  isEmpty: boolean;
  /** Whether the folder contains recognizable source files (only populated when isEmpty=true). */
  hasSourceFiles: boolean;
}

/**
 * Build a ProjectDescriptor from discovered .archc file paths.
 * Display names are derived from filenames by removing the .archc extension.
 */
function buildDescriptor(
  projectName: string,
  archcPaths: string[],
  rootFile?: string,
): ProjectDescriptor {
  const files: ProjectFile[] = archcPaths.map((path) => ({
    path,
    displayName: path.replace(/\.archc$/, '').replace(/^.*[\\/]/, ''),
  }));

  const root = rootFile ?? archcPaths[0] ?? '';

  return {
    name: projectName,
    rootFile: root,
    files,
  };
}

/**
 * Scan a directory handle for an ArchCanvas project.
 *
 * Detection order:
 * 1. Look for .archcanvas/ subdirectory (current convention).
 * 2. Fall back to loose .archc files at root (legacy flat layout).
 * 3. If none found, return isEmpty=true.
 *
 * @param dirHandle - FileSystemDirectoryHandle from showDirectoryPicker()
 * @returns ScanResult with project descriptor and directory handles
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

  // ── 2. Legacy: scan root for loose .archc files ──────────────────
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
    const emptyDescriptor: ProjectDescriptor = {
      name: projectName,
      rootFile: '',
      files: [],
    };
    return {
      manifest: emptyDescriptor,
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

  const manifest = buildDescriptor(projectName, archcFiles, rootFile);

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
 * Legacy scanner: looks for loose .archc files at the root level
 * of the selected directory (no .archcanvas/ subdirectory).
 * Note: .archproject.json files are ignored (legacy manifest removed).
 */
async function scanLegacyProject(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ScanResult> {
  const archcFiles: string[] = [];
  let hasSourceFiles = false;

  // Iterate directory entries (non-recursive, top-level only)
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      if (entry.name.endsWith('.archc')) {
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

  const projectName = dirHandle.name || 'Untitled Project';

  // No .archc files — return empty project result
  if (archcFiles.length === 0) {
    const emptyDescriptor: ProjectDescriptor = {
      name: projectName,
      rootFile: '',
      files: [],
    };
    return {
      manifest: emptyDescriptor,
      directoryHandle: dirHandle,
      archcanvasHandle: null,
      manifestExisted: false,
      isEmpty: true,
      hasSourceFiles,
    };
  }

  // Sort alphabetically for consistent ordering
  archcFiles.sort();

  const manifest = buildDescriptor(projectName, archcFiles);

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

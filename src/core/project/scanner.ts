/**
 * Project folder scanner — discovers .archc files and reads/builds manifests.
 *
 * Uses the File System Access API's directory handle to iterate files
 * in a user-selected folder. If an .archproject.json manifest exists,
 * it is read and validated. Otherwise, a manifest is built from the
 * discovered .archc files.
 */

import type { ProjectManifest } from '@/types/project';
import { PROJECT_MANIFEST_FILENAME } from '@/types/project';
import { parseManifest, createManifest, serializeManifest } from './manifest';

/**
 * Result of scanning a project folder.
 */
export interface ScanResult {
  /** The parsed or generated project manifest. */
  manifest: ProjectManifest;
  /** The directory handle for the project folder (for reading files). */
  directoryHandle: FileSystemDirectoryHandle;
  /** Whether the manifest was read from an existing .archproject.json file. */
  manifestExisted: boolean;
}

/**
 * Scan a directory handle for .archc files and read or build a manifest.
 *
 * 1. Iterates all entries in the directory.
 * 2. If .archproject.json exists, reads and validates it.
 * 3. Otherwise, collects all .archc file paths and creates a manifest.
 *
 * @param dirHandle - FileSystemDirectoryHandle from showDirectoryPicker()
 * @returns ScanResult with manifest and directory handle
 * @throws Error if no .archc files are found and no manifest exists
 */
export async function scanProjectFolder(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ScanResult> {
  const archcFiles: string[] = [];
  let manifestHandle: FileSystemFileHandle | null = null;

  // Iterate directory entries (non-recursive, top-level only)
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      if (entry.name === PROJECT_MANIFEST_FILENAME) {
        manifestHandle = entry;
      } else if (entry.name.endsWith('.archc')) {
        archcFiles.push(entry.name);
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
      manifestExisted: true,
    };
  }

  // No manifest — build one from discovered .archc files
  if (archcFiles.length === 0) {
    throw new Error(
      'No .archc files found in the selected folder. ' +
        'Please select a folder containing .archc architecture files.',
    );
  }

  // Sort alphabetically for consistent ordering
  archcFiles.sort();

  const projectName = dirHandle.name || 'Untitled Project';
  const manifest = createManifest(projectName, archcFiles);

  return {
    manifest,
    directoryHandle: dirHandle,
    manifestExisted: false,
  };
}

/**
 * Read a specific .archc file from the project directory.
 *
 * @param dirHandle - The project directory handle
 * @param relativePath - Relative path to the .archc file (from the manifest)
 * @returns Raw binary data of the .archc file
 * @throws Error if the file cannot be found or read
 */
export async function readProjectFile(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<Uint8Array> {
  const fileHandle = await dirHandle.getFileHandle(relativePath);
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
 * Write a binary .archc file to the project directory.
 *
 * @param dirHandle - The project directory handle
 * @param fileName - File name (e.g., "my-stack.archc")
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

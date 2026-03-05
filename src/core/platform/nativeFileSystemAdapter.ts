/**
 * NativeFileSystemAdapter — File operations for Capacitor iOS.
 *
 * Implements the FileSystemAdapter interface using:
 * - @capawesome/capacitor-file-picker: Presents the native document picker
 *   (UIDocumentPickerViewController) so the user can choose .archc files.
 * - @capacitor/filesystem: Reads/writes binary files to the app's Documents
 *   directory for save-in-place and Save As.
 * - @capacitor/share: Shares files via the native iOS share sheet for exports
 *   (PNG, SVG, markdown, .archc).
 *
 * Data encoding note:
 *   The Capacitor Filesystem plugin uses base64 for binary data by default.
 *   We encode Uint8Array → base64 for writes and decode base64 → Uint8Array
 *   for reads. For text data (e.g. markdown), we use Encoding.UTF8.
 */

import type {
  FileSystemAdapter,
  PickFileResult,
  SaveFileResult,
  SaveFileAsResult,
} from './fileSystemAdapter';

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FilePicker } from '@capawesome/capacitor-file-picker';

// ─── Base64 Helpers ──────────────────────────────────────────

/**
 * Encode a Uint8Array to a base64 string.
 * Uses the built-in btoa + String.fromCharCode approach.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Decode a base64 string to a Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Constants ───────────────────────────────────────────────

/** Default directory for saved .archc files on iOS. */
const ARCHC_DIRECTORY = Directory.Documents;

/** Subdirectory within Documents for ArchCanvas files. */
const ARCHC_SUBFOLDER = 'ArchCanvas';

// ─── Adapter ─────────────────────────────────────────────────

export class NativeFileSystemAdapter implements FileSystemAdapter {
  /**
   * Pick a .archc file from the user using the native document picker.
   *
   * Uses @capawesome/capacitor-file-picker to present UIDocumentPickerViewController.
   * The picker returns a file path; we then read the file contents via Filesystem.readFile.
   * Returns null if the user cancels.
   */
  async pickFile(): Promise<PickFileResult | null> {
    try {
      const result = await FilePicker.pickFiles({
        types: ['application/octet-stream'],
        limit: 1,
        readData: false, // Don't read into memory via picker (large files can crash)
      });

      const pickedFile = result.files[0];
      if (!pickedFile || !pickedFile.path) {
        return null;
      }

      // Read the file contents via Filesystem (base64 for binary)
      const fileContent = await Filesystem.readFile({
        path: pickedFile.path,
      });

      // fileContent.data is a base64 string on native
      const data =
        typeof fileContent.data === 'string'
          ? base64ToUint8Array(fileContent.data)
          : new Uint8Array(await (fileContent.data as Blob).arrayBuffer());

      return {
        data,
        name: pickedFile.name,
        handle: pickedFile.path, // Use the file path as the "handle" for save-in-place
      };
    } catch (err) {
      // User cancelled the picker
      if (err instanceof Error && err.message.includes('cancel')) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Save binary data to an existing file location (save-in-place).
   *
   * If a handle (file path) is provided, writes to that path.
   * Otherwise, saves to the default ArchCanvas documents directory.
   */
  async saveFile(data: Uint8Array, handle?: unknown): Promise<SaveFileResult> {
    const filePath = handle as string | undefined;

    if (filePath) {
      // Save to the existing path (save-in-place)
      await Filesystem.writeFile({
        path: filePath,
        data: uint8ArrayToBase64(data),
        recursive: true,
      });
      return { handle: filePath };
    }

    // No handle — save to default location
    const defaultPath = `${ARCHC_SUBFOLDER}/architecture.archc`;
    const result = await Filesystem.writeFile({
      path: defaultPath,
      data: uint8ArrayToBase64(data),
      directory: ARCHC_DIRECTORY,
      recursive: true,
    });
    return { handle: result.uri };
  }

  /**
   * Save binary data to a new file location.
   *
   * On iOS, there's no native "Save As" dialog, so we:
   * 1. Write the file to the Documents directory with the suggested name
   * 2. Present the share sheet so the user can export it elsewhere
   */
  async saveFileAs(data: Uint8Array, suggestedName: string): Promise<SaveFileAsResult | null> {
    // Ensure the file has a .archc extension
    const fileName = suggestedName.endsWith('.archc') ? suggestedName : `${suggestedName}.archc`;

    const filePath = `${ARCHC_SUBFOLDER}/${fileName}`;

    // Write to Documents directory
    const writeResult = await Filesystem.writeFile({
      path: filePath,
      data: uint8ArrayToBase64(data),
      directory: ARCHC_DIRECTORY,
      recursive: true,
    });

    // Present share sheet so the user can export/move the file
    try {
      await Share.share({
        title: fileName,
        url: writeResult.uri,
        dialogTitle: `Save ${fileName}`,
      });
    } catch {
      // User cancelled share — file is still saved locally, that's OK
    }

    return {
      handle: writeResult.uri,
      fileName,
    };
  }

  /**
   * Share a file via the native iOS share sheet.
   *
   * Writes the data to a temporary file, then presents the share sheet
   * with that file's URI. Works for .archc, PNG, SVG, markdown, etc.
   */
  async shareFile(data: Uint8Array | string, filename: string, _mimeType: string): Promise<void> {
    // Write to a temporary file
    const tempPath = `tmp/${filename}`;

    if (typeof data === 'string') {
      // Text data (markdown, SVG, etc.)
      await Filesystem.writeFile({
        path: tempPath,
        data,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } else {
      // Binary data (PNG, .archc, etc.)
      await Filesystem.writeFile({
        path: tempPath,
        data: uint8ArrayToBase64(data),
        directory: Directory.Cache,
        recursive: true,
      });
    }

    // Get the file:// URI for sharing
    const uriResult = await Filesystem.getUri({
      path: tempPath,
      directory: Directory.Cache,
    });

    // Present the native share sheet
    await Share.share({
      title: filename,
      url: uriResult.uri,
      dialogTitle: `Share ${filename}`,
    });
  }
}

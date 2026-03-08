/**
 * Project module barrel exports.
 *
 * Provides manifest parsing/creation and folder scanning for
 * multi-file architecture projects.
 */

export { parseManifest, serializeManifest, createManifest, PROJECT_MANIFEST_FILENAME } from './manifest';
export { scanProjectFolder, readProjectFile, writeManifestToFolder, writeArchcToFolder, initArchcanvasDir } from './scanner';
export type { ScanResult } from './scanner';
export { FileLoaderService, LRUCache, FileNotFoundError, CircularReferenceError, CorruptedFileError } from './fileLoaderService';
export type { CachedFileEntry } from './fileLoaderService';

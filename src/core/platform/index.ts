/**
 * Platform abstraction barrel export.
 *
 * File system, clipboard, and preferences adapters for web and native (iOS).
 */

// Platform detection
export type { PlatformType } from './platformBridge';
export { isNative, isWeb, isIOS, getPlatformType } from './platformBridge';

// File system
export type { PickFileResult, SaveFileResult, SaveFileAsResult, FileSystemAdapter } from './fileSystemAdapter';
export { getFileSystemAdapter, _resetFileSystemAdapter } from './fileSystemAdapter';
export { WebFileSystemAdapter } from './webFileSystemAdapter';
export { NativeFileSystemAdapter } from './nativeFileSystemAdapter';
export { NodeFileSystemAdapter, NodeFileSystemError } from './nodeFileSystemAdapter';

// Clipboard
export type { ClipboardAdapter } from './clipboardAdapter';
export { WebClipboardAdapter, NativeClipboardAdapter, getClipboardAdapter, _resetClipboardAdapter } from './clipboardAdapter';

// Preferences
export { preferences } from './preferencesAdapter';

/**
 * Type declarations for @tauri-apps/plugin-fs.
 * This module is only available at runtime inside a Tauri build.
 * These declarations allow TypeScript to check tauriFileSystem.ts
 * without requiring the npm package to be installed.
 */
declare module '@tauri-apps/plugin-fs' {
  interface DirEntry {
    name: string | null;
    isFile: boolean;
    isDirectory: boolean;
    isSymlink: boolean;
  }

  export function readTextFile(path: string): Promise<string>;
  export function writeTextFile(path: string, content: string): Promise<void>;
  export function exists(path: string): Promise<boolean>;
  export function mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<void>;
  export function readDir(path: string): Promise<DirEntry[]>;
}

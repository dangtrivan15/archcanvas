export interface FileSystem {
  getName(): string;
  /** Return the absolute filesystem path to the project root, or null if unavailable (Web/InMemory). */
  getPath(): string | null;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  /** List direct entries (files and directories) under `path`. */
  listEntries(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]>;
  /** List all file paths under `path` recursively, relative to project root. */
  listFilesRecursive(path: string, ignore?: string[]): Promise<string[]>;
  /** Delete a file at `path`. Throws if the file does not exist. */
  deleteFile(path: string): Promise<void>;
}

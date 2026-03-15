export interface FileSystem {
  getName(): string;
  /** Return the absolute filesystem path to the project root, or null if unavailable (Web/InMemory). */
  getPath(): string | null;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}

export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}

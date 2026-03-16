import type { FileSystem } from './fileSystem';
import {
  readTextFile,
  writeTextFile,
  exists as tauriExists,
  mkdir as tauriMkdir,
  readDir,
} from '@tauri-apps/plugin-fs';

export class TauriFileSystem implements FileSystem {
  constructor(private rootPath: string) {}

  getName(): string {
    const segments = this.rootPath.replace(/[\\/]+$/, '').split(/[\\/]/);
    return segments[segments.length - 1] || this.rootPath;
  }

  getPath(): string {
    return this.rootPath;
  }

  private resolve(path: string): string {
    const root = this.rootPath.replace(/\/+$/, '');
    const rel = path.replace(/^\/+/, '');
    return `${root}/${rel}`;
  }

  async readFile(path: string): Promise<string> {
    return readTextFile(this.resolve(path));
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeTextFile(this.resolve(path), content);
  }

  async listFiles(path: string): Promise<string[]> {
    const entries = await readDir(this.resolve(path));
    return entries
      .filter((e) => e.isFile)
      .map((e) => e.name)
      .filter((name): name is string => name != null);
  }

  async exists(path: string): Promise<boolean> {
    return tauriExists(this.resolve(path));
  }

  async mkdir(path: string): Promise<void> {
    await tauriMkdir(this.resolve(path), { recursive: true });
  }
}

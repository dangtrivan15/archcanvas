import type { FileSystem } from './fileSystem';
import {
  readTextFile,
  writeTextFile,
  exists as tauriExists,
  mkdir as tauriMkdir,
  readDir,
} from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export class TauriFileSystem implements FileSystem {
  constructor(private rootPath: string) {}

  getName(): string {
    const segments = this.rootPath.replace(/[\\/]+$/, '').split(/[\\/]/);
    return segments[segments.length - 1] || this.rootPath;
  }

  getPath(): string {
    return this.rootPath;
  }

  private async resolve(path: string): Promise<string> {
    return join(this.rootPath, path);
  }

  async readFile(path: string): Promise<string> {
    return readTextFile(await this.resolve(path));
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeTextFile(await this.resolve(path), content);
  }

  async listFiles(path: string): Promise<string[]> {
    const entries = await readDir(await this.resolve(path));
    return entries
      .filter((e) => e.isFile)
      .map((e) => e.name)
      .filter((name): name is string => name != null);
  }

  async exists(path: string): Promise<boolean> {
    return tauriExists(await this.resolve(path));
  }

  async mkdir(path: string): Promise<void> {
    await tauriMkdir(await this.resolve(path), { recursive: true });
  }
}

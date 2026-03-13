import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FileSystem } from './fileSystem';

export class NodeFileSystem implements FileSystem {
  private rootPath: string;

  constructor(root: string) {
    this.rootPath = resolve(root);
  }

  private resolvePath(path: string): string {
    return resolve(this.rootPath, path);
  }

  async readFile(path: string): Promise<string> {
    return readFile(this.resolvePath(path), 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(path);
    const dir = resolve(fullPath, '..');
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  async listFiles(path: string): Promise<string[]> {
    const fullPath = this.resolvePath(path);
    const entries = await readdir(fullPath, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(this.resolvePath(path));
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(this.resolvePath(path), { recursive: true });
  }
}

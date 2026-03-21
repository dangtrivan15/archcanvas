import { readFile, writeFile, readdir, stat, mkdir, unlink } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import type { FileSystem } from './fileSystem';

export class NodeFileSystem implements FileSystem {
  private rootPath: string;

  constructor(root: string) {
    this.rootPath = resolve(root);
  }

  getName(): string {
    return basename(this.rootPath);
  }

  getPath(): string {
    return this.rootPath;
  }

  private resolvePath(path: string): string {
    const full = resolve(this.rootPath, path);
    if (!full.startsWith(this.rootPath + '/') && full !== this.rootPath) {
      throw new Error(`Path traversal detected: '${path}' escapes root '${this.rootPath}'`);
    }
    return full;
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

  async deleteFile(path: string): Promise<void> {
    await unlink(this.resolvePath(path));
  }

  async listEntries(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]> {
    const full = this.resolvePath(path === '.' ? '' : path);
    const entries = await readdir(full, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' as const : 'file' as const,
    }));
  }

  async listFilesRecursive(path: string, ignore: string[] = []): Promise<string[]> {
    const full = this.resolvePath(path === '.' ? '' : path);
    const ignoreSet = new Set(ignore);
    const results: string[] = [];

    async function walk(dir: string, rel: string) {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (ignoreSet.has(e.name)) continue;
        const entryRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          await walk(`${dir}/${e.name}`, entryRel);
        } else if (e.isFile()) {
          results.push(entryRel);
        }
      }
    }

    await walk(full, path === '.' || path === '' ? '' : path);
    return results.sort();
  }
}

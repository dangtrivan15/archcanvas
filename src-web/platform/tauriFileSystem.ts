import type { FileSystem } from './fileSystem';
import { resolveTauriPath } from './tauriPath';
import {
  readTextFile,
  writeTextFile,
  readFile as tauriReadFile,
  stat as tauriStat,
  exists as tauriExists,
  mkdir as tauriMkdir,
  readDir,
  remove as tauriRemove,
} from '@tauri-apps/plugin-fs';

function enoent(path: string): Error {
  const err = new Error(`ENOENT: no such file or directory, '${path}'`) as Error & { code: string };
  err.code = 'ENOENT';
  return err;
}

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
    return resolveTauriPath(this.rootPath, path);
  }

  async readFile(path: string): Promise<string> {
    return readTextFile(this.resolve(path));
  }

  async readFileBytes(path: string): Promise<Uint8Array> {
    return tauriReadFile(this.resolve(path));
  }

  async stat(path: string): Promise<{ type: 'file' | 'directory'; size: number; mtimeMs: number }> {
    const full = this.resolve(path);
    // Check existence first: @tauri-apps/plugin-fs serializes its errors as plain
    // strings with no `.code`, so forwarding tauriStat's rejection would never
    // satisfy the `.code === 'ENOENT'` contract other backends guarantee.
    if (!(await tauriExists(full))) {
      throw enoent(path);
    }
    const s = await tauriStat(full);
    return {
      type: s.isDirectory ? 'directory' : 'file',
      size: s.size,
      mtimeMs: s.mtime ? s.mtime.getTime() : 0,
    };
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

  async deleteFile(path: string): Promise<void> {
    await tauriRemove(this.resolve(path));
  }

  async listEntries(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]> {
    const entries = await readDir(this.resolve(path));
    return entries
      .filter((e) => e.name != null)
      .map((e) => ({
        name: e.name!,
        type: e.isDirectory ? 'directory' as const : 'file' as const,
      }));
  }

  async listFilesRecursive(path: string, ignore: string[] = []): Promise<string[]> {
    const ignoreSet = new Set(ignore);
    const results: string[] = [];

    const walk = async (dir: string, rel: string) => {
      const entries = await readDir(dir);
      for (const e of entries) {
        if (!e.name || ignoreSet.has(e.name)) continue;
        const entryRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory) {
          await walk(`${dir}/${e.name}`, entryRel);
        } else if (e.isFile) {
          results.push(entryRel);
        }
      }
    };

    await walk(this.resolve(path), path === '.' || path === '' ? '' : path);
    return results.sort();
  }
}

import type { FileSystem } from './fileSystem';

export class WebFileSystem implements FileSystem {
  constructor(private rootHandle: FileSystemDirectoryHandle) {}

  getName(): string {
    return this.rootHandle.name;
  }

  getPath(): string | null {
    return null;
  }

  async readFile(path: string): Promise<string> {
    const { dir, fileName } = await this.resolve(path);
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { dir, fileName } = await this.resolve(path, true);
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async listFiles(path: string): Promise<string[]> {
    const dir = await this.resolveDir(path);
    const entries: string[] = [];
    // TypeScript's DOM lib does not fully type the async iterable protocol
    // on FileSystemDirectoryHandle, but it is supported in modern browsers.
    const iterable = dir as unknown as AsyncIterable<
      [string, FileSystemHandle]
    >;
    for await (const [name, handle] of iterable) {
      if (handle.kind === 'file') {
        entries.push(name);
      }
    }
    return entries;
  }

  async exists(path: string): Promise<boolean> {
    try {
      const { dir, fileName } = await this.resolve(path);
      try {
        await dir.getFileHandle(fileName);
        return true;
      } catch {
        try {
          await dir.getDirectoryHandle(fileName);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await this.resolveDir(path, true);
  }

  async listEntries(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]> {
    const dir = await this.resolveDir(path);
    const entries: { name: string; type: 'file' | 'directory' }[] = [];
    const iterable = dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
    for await (const [name, handle] of iterable) {
      entries.push({ name, type: handle.kind === 'directory' ? 'directory' : 'file' });
    }
    return entries;
  }

  async listFilesRecursive(path: string, ignore: string[] = []): Promise<string[]> {
    const ignoreSet = new Set(ignore);
    const results: string[] = [];

    const walk = async (dirHandle: FileSystemDirectoryHandle, rel: string) => {
      const iterable = dirHandle as unknown as AsyncIterable<[string, FileSystemHandle]>;
      for await (const [name, handle] of iterable) {
        if (ignoreSet.has(name)) continue;
        const entryRel = rel ? `${rel}/${name}` : name;
        if (handle.kind === 'directory') {
          await walk(handle as FileSystemDirectoryHandle, entryRel);
        } else {
          results.push(entryRel);
        }
      }
    };

    const dir = await this.resolveDir(path);
    await walk(dir, path === '.' || path === '' ? '' : path);
    return results.sort();
  }

  async deleteFile(path: string): Promise<void> {
    const { dir, fileName } = await this.resolve(path);
    await dir.removeEntry(fileName);
  }

  private async resolve(
    path: string,
    createDirs = false,
  ): Promise<{ dir: FileSystemDirectoryHandle; fileName: string }> {
    const parts = path.split('/').filter((p) => p && p !== '.');
    const fileName = parts.pop()!;
    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: createDirs });
    }
    return { dir, fileName };
  }

  private async resolveDir(
    path: string,
    create = false,
  ): Promise<FileSystemDirectoryHandle> {
    const parts = path.split('/').filter((p) => p && p !== '.');
    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
  }
}

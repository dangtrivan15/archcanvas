import type { FileSystem } from './fileSystem';

export class InMemoryFileSystem implements FileSystem {
  private files = new Map<string, string>();
  private _failPaths = new Set<string>();

  constructor(private name: string = 'untitled') {}

  getName(): string {
    return this.name;
  }

  getPath(): string | null {
    return null;
  }

  /** Make writeFile throw for the given path (for testing partial-failure scenarios). */
  failOnWrite(path: string): void {
    this._failPaths.add(path);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(this.normalize(path));
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (this._failPaths.has(this.normalize(path))) {
      throw new Error(`Simulated write failure: ${path}`);
    }
    this.files.set(this.normalize(path), content);
  }

  async listFiles(path: string): Promise<string[]> {
    const dir = this.normalize(path);
    const prefix = dir === '' ? '' : dir + '/';
    const results: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        if (!rest.includes('/')) {
          results.push(rest);
        }
      }
    }
    return results;
  }

  async exists(path: string): Promise<boolean> {
    const norm = this.normalize(path);
    if (this.files.has(norm)) return true;
    const prefix = norm + '/';
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  async mkdir(_path: string): Promise<void> {
    // No-op — directories are implicit in the file map
  }

  async listEntries(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]> {
    const prefix = path === '.' || path === '' ? '' : this.normalize(path) + '/';
    const entries = new Map<string, 'file' | 'directory'>();

    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx === -1) {
        entries.set(rest, 'file');
      } else {
        const dirName = rest.slice(0, slashIdx);
        if (!entries.has(dirName)) {
          entries.set(dirName, 'directory');
        }
      }
    }

    return [...entries.entries()].map(([name, type]) => ({ name, type }));
  }

  async listFilesRecursive(path: string, ignore: string[] = []): Promise<string[]> {
    const prefix = path === '.' || path === '' ? '' : this.normalize(path) + '/';
    const ignoreSet = new Set(ignore);
    const results: string[] = [];

    for (const key of this.files.keys()) {
      if (prefix === '' || key.startsWith(prefix)) {
        const segments = key.split('/');
        if (segments.some((s) => ignoreSet.has(s))) continue;
        results.push(key);
      }
    }

    return results.sort();
  }

  /** Populate multiple files at once (test helper) */
  seed(files: Record<string, string>): void {
    for (const [path, content] of Object.entries(files)) {
      this.files.set(this.normalize(path), content);
    }
  }

  /** Return all files as a plain object (test helper) */
  getAll(): Record<string, string> {
    return Object.fromEntries(this.files);
  }

  private normalize(path: string): string {
    return path.replace(/^\/+/, '').replace(/\/+$/, '');
  }
}

import type { FileSystem } from './fileSystem';

export class InMemoryFileSystem implements FileSystem {
  private files = new Map<string, string>();
  private _failPaths = new Set<string>();

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

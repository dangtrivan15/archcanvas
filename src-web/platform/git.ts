import type { FileSystem } from './fileSystem';

/**
 * Read-only git access, platform-agnostic. Backed by isomorphic-git reading
 * the .git directory through the FileSystem abstraction — no git binary.
 */
export interface GitProvider {
  /** True when a `.git` directory is exposed by the FileSystem. */
  isRepository(): Promise<boolean>;
  /** File contents at `ref`, or null if the path does not exist in that ref. */
  readFileAtRef(ref: string, filepath: string): Promise<string | null>;
}

/** Strip isomorphic-git's leading "./" so paths match FileSystem's relative form. */
function norm(path: string): string {
  return path.replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Build an isomorphic-git FsClient backed by a FileSystem (read-only paths only).
 *
 * isomorphic-git's internal `bindFs` unconditionally binds all ten of
 * readFile/writeFile/mkdir/rmdir/unlink/stat/lstat/readdir/readlink/symlink
 * on `fs.promises` — even for read-only operations like resolveRef/readBlob —
 * so every command must exist or the FileSystem constructor throws
 * (`Cannot read properties of undefined (reading 'bind')`). The mutating
 * commands are stubbed to reject since this provider never needs to write.
 */
function createFsClient(fs: FileSystem) {
  const readOnly = (op: string) => async () => {
    throw new Error(`IsomorphicGitProvider is read-only: '${op}' is not supported`);
  };

  return {
    promises: {
      async readFile(path: string, opts?: string | { encoding?: string }) {
        const encoding = typeof opts === 'string' ? opts : opts?.encoding;
        const p = norm(path);
        if (encoding === 'utf8' || encoding === 'utf-8') {
          return fs.readFile(p);
        }
        return fs.readFileBytes(p);
      },
      async readdir(path: string) {
        const entries = await fs.listEntries(norm(path));
        return entries.map((e) => e.name);
      },
      async stat(path: string) {
        const s = await fs.stat(norm(path));
        return toStats(s);
      },
      async lstat(path: string) {
        const s = await fs.stat(norm(path));
        return toStats(s);
      },
      writeFile: readOnly('writeFile'),
      mkdir: readOnly('mkdir'),
      rmdir: readOnly('rmdir'),
      unlink: readOnly('unlink'),
      readlink: readOnly('readlink'),
      symlink: readOnly('symlink'),
    },
  };
}

function toStats(s: { type: 'file' | 'directory'; size: number; mtimeMs: number }) {
  const isDir = s.type === 'directory';
  return {
    type: isDir ? 'dir' : 'file',
    mode: isDir ? 0o040000 : 0o100644,
    size: s.size,
    ino: 0,
    mtimeMs: s.mtimeMs,
    ctimeMs: s.mtimeMs,
    uid: 0,
    gid: 0,
    dev: 0,
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isSymbolicLink: () => false,
  };
}

class IsomorphicGitProvider implements GitProvider {
  private cache: Record<string, unknown> = {};

  constructor(private fs: FileSystem) {}

  async isRepository(): Promise<boolean> {
    try {
      const s = await this.fs.stat('.git');
      return s.type === 'directory';
    } catch {
      return false;
    }
  }

  async readFileAtRef(ref: string, filepath: string): Promise<string | null> {
    const git = await import('isomorphic-git');
    const fsClient = createFsClient(this.fs);
    // Deliberately NOT wrapped in the try/catch below: resolveRef throws the
    // same NotFoundError code/name for an unresolvable ref as readBlob does
    // for a missing filepath. A bad ref is a genuine error and must propagate;
    // only "filepath absent in this ref" should become null.
    const oid = await git.resolveRef({ fs: fsClient, dir: '.', ref });
    try {
      const { blob } = await git.readBlob({
        fs: fsClient,
        dir: '.',
        oid,
        filepath,
        cache: this.cache,
      });
      return new TextDecoder().decode(blob);
    } catch (err) {
      // Path not present in the ref → treat as "no baseline for this file"
      if (err && typeof err === 'object' && 'code' in err &&
          (err as { code: string }).code === 'NotFoundError') {
        return null;
      }
      throw err;
    }
  }
}

export function createGitProvider(fs: FileSystem): GitProvider {
  return new IsomorphicGitProvider(fs);
}

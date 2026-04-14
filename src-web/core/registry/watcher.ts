import type { FileSystem } from '@/platform/fileSystem';

const NODEDEFS_DIR = '.archcanvas/nodedefs';
const POLL_INTERVAL = 3000;
const DEBOUNCE_MS = 500;

export interface NodeDefWatcher {
  /** Stop watching and clean up resources. */
  stop(): void;
}

function debounce(fn: () => void, ms: number): { trigger: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    trigger: () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, ms);
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/**
 * Simple hash of a string for content comparison (not cryptographic).
 * djb2 algorithm -- fast and sufficient for change detection.
 */
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Watch .archcanvas/nodedefs/ for changes and trigger registry reload.
 * Uses native fs events on Tauri, content-aware polling on Web.
 */
export function createNodeDefWatcher(
  fs: FileSystem,
  projectRoot: string,
  onReload: () => Promise<void>,
): NodeDefWatcher {
  const dir = projectRoot ? `${projectRoot}/${NODEDEFS_DIR}` : NODEDEFS_DIR;
  const debouncedReload = debounce(() => { onReload(); }, DEBOUNCE_MS);
  let stopped = false;

  // Try Tauri native watcher
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    let unwatch: (() => void) | null = null;

    import('@tauri-apps/plugin-fs').then(({ watchImmediate }) => {
      if (stopped) return;
      watchImmediate(dir, () => {
        debouncedReload.trigger();
      }, { recursive: false }).then(unwatchFn => {
        if (stopped) { unwatchFn(); return; }
        unwatch = unwatchFn;
      }).catch(() => {
        // Directory may not exist yet -- fall through silently
      });
    }).catch(() => {
      // Plugin not available -- ignore
    });

    return {
      stop() {
        stopped = true;
        debouncedReload.cancel();
        unwatch?.();
      },
    };
  }

  // Polling fallback: read file contents and compare hashes
  let prevSnapshot = new Map<string, number>(); // filename -> content hash

  async function buildSnapshot(): Promise<Map<string, number>> {
    const snapshot = new Map<string, number>();
    try {
      const exists = await fs.exists(dir);
      if (!exists) return snapshot;

      const files = await fs.listFiles(dir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of yamlFiles) {
        try {
          const content = await fs.readFile(`${dir}/${file}`);
          snapshot.set(file, simpleHash(content));
        } catch {
          // File may have been deleted between list and read
          snapshot.set(file, -1);
        }
      }
    } catch {
      // Directory doesn't exist or is inaccessible
    }
    return snapshot;
  }

  function snapshotsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
    if (a.size !== b.size) return false;
    for (const [key, val] of a) {
      if (b.get(key) !== val) return false;
    }
    return true;
  }

  // Initialize previous snapshot
  buildSnapshot().then(snap => { prevSnapshot = snap; });

  const intervalId = setInterval(async () => {
    const currentSnapshot = await buildSnapshot();
    if (!snapshotsEqual(prevSnapshot, currentSnapshot)) {
      prevSnapshot = currentSnapshot;
      debouncedReload.trigger();
    }
  }, POLL_INTERVAL);

  return {
    stop() {
      stopped = true;
      clearInterval(intervalId);
      debouncedReload.cancel();
    },
  };
}

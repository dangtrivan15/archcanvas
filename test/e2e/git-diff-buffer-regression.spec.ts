import { test, expect } from '@playwright/test';
import { readFile, readdir, stat as nodeStat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Regression guard for the git-diff "Diff failed" bug (browser-only).
 *
 * isomorphic-git's internal `FileSystem.read` wraps every *binary* read in
 * `Buffer.from()` and swallows any throw into `return null`. The Vite browser
 * build (web + the Tauri webview) has no global `Buffer`, so every git object /
 * packfile read silently became null: the loose-object lookup failed, the
 * packfile fallback ran, and `GitPackIndex.fromIdx(null)` threw "Cannot read
 * properties of null (reading 'slice')". Ref reads are strings and skip
 * `Buffer.from`, so `resolveRef` succeeded while all object reads failed. The
 * fix is a lazy `globalThis.Buffer` polyfill in `platform/git.ts`.
 *
 * This *must* run against the production `vite preview` build — that is the only
 * environment where `Buffer` is genuinely absent. Node-based unit tests always
 * have a global `Buffer` and therefore cannot reproduce the bug.
 *
 * The sibling `git-diff-availability.spec.ts` notes that standing up a real
 * `.git` inside the web preview's virtual filesystem is "impractical". It is not:
 * we inject a duck-typed FileSystem into the exposed `__archcanvas_fileStore__`
 * and bridge its reads (via `page.exposeFunction`) to Node reading this repo's
 * OWN `.git`. That drives the real orchestrator → GitProvider → isomorphic-git
 * path end to end through the bundled production app.
 */

// Repo root, resolved from this file's location so it is independent of cwd.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const isMac = process.platform === 'darwin';

/**
 * Node-side FileSystem bridge that mirrors WebFileSystem's error semantics
 * (a DOMException-style `NotFoundError`, not an `ENOENT` code) so we exercise
 * the exact browser behaviour, while serving the bytes of the real `.git`.
 */
async function nodeBridge(op: string, path: string) {
  const abs = resolve(REPO_ROOT, path === '.' ? '' : path);
  try {
    switch (op) {
      case 'readFile':
        return { ok: true, text: await readFile(abs, 'utf-8') };
      case 'readFileBytes':
        return { ok: true, b64: (await readFile(abs)).toString('base64') };
      case 'stat': {
        const s = await nodeStat(abs);
        return { ok: true, stat: { type: s.isDirectory() ? 'directory' : 'file', size: s.size, mtimeMs: s.mtimeMs } };
      }
      case 'listEntries': {
        const es = await readdir(abs, { withFileTypes: true });
        return { ok: true, entries: es.map((e) => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' })) };
      }
      case 'listFiles': {
        const es = await readdir(abs, { withFileTypes: true });
        return { ok: true, files: es.filter((e) => e.isFile()).map((e) => e.name) };
      }
      default:
        return { ok: false, kind: 'other' as const, message: `unknown op ${op}` };
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { ok: false, kind: code === 'ENOENT' ? ('ENOENT' as const) : ('other' as const), message: String((e as Error)?.message ?? e) };
  }
}

test.describe('git diff — browser binary reads (Buffer polyfill)', () => {
  test('runs a real git diff through isomorphic-git in the production browser build', async ({ page }) => {
    await page.exposeFunction('__nodeBridge', nodeBridge);
    await page.goto('/');

    // Bypass the ProjectGate and install a FileSystem backed by the real .git.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileStore = (window as any).__archcanvas_fileStore__;
      if (!fileStore) throw new Error('fileStore not exposed on window');
      fileStore.getState().initializeEmptyProject();

      // WebFileSystem throws a DOMException NotFoundError (no ENOENT code) for
      // missing paths; stat() alone tags ENOENT. Mirror that here.
      const notFound = (p: string) => { const err = new Error(`NotFoundError: ${p}`); err.name = 'NotFoundError'; return err; };
      const enoent = (p: string) => { const err = new Error(`ENOENT: '${p}'`) as Error & { code: string }; err.code = 'ENOENT'; return err; };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bridge = (window as any).__nodeBridge;

      const fs = {
        getName: () => 'archcanvas',
        getPath: () => null,
        async readFile(p: string) { const r = await bridge('readFile', p); if (!r.ok) throw notFound(p); return r.text; },
        async readFileBytes(p: string) {
          const r = await bridge('readFileBytes', p);
          if (!r.ok) throw notFound(p);
          const bin = atob(r.b64);
          const u = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          return u;
        },
        async stat(p: string) { const r = await bridge('stat', p); if (!r.ok) throw (r.kind === 'ENOENT' ? enoent(p) : notFound(p)); return r.stat; },
        async listEntries(p: string) { const r = await bridge('listEntries', p); if (!r.ok) throw notFound(p); return r.entries; },
        async listFiles(p: string) { const r = await bridge('listFiles', p); if (!r.ok) throw notFound(p); return r.files; },
        async writeFile() {}, async exists() { return false; }, async mkdir() {},
      };
      fileStore.setState({ fs });
    });

    // Wait for the app to render past the gate.
    await expect(page.locator('.react-flow')).toBeVisible();

    // Enable the diff control (mirrors refreshDiffAvailability resolving true for
    // a real repo) and trigger the diff via the global ⇧⌘D shortcut.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__archcanvas_diffStore__.getState().setAvailable(true);
    });
    await page.keyboard.press(isMac ? 'Meta+Shift+d' : 'Control+Shift+d');

    // Wait for the async git read to settle.
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = (window as any).__archcanvas_diffStore__.getState();
      return s.loading === false && (s.enabled || s.error);
    }, null, { timeout: 15_000 });

    const state = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = (window as any).__archcanvas_diffStore__.getState();
      return { error: s.error, enabled: s.enabled, canvasDiffs: s.canvasDiffs?.size ?? 0 };
    });

    // The core regression assertions: no Buffer/slice crash, and baseline
    // canvases were actually read from git (binary object reads succeeded).
    expect(state.error).toBeNull();
    expect(state.enabled).toBe(true);
    expect(state.canvasDiffs).toBeGreaterThan(0);

    // And the status bar shows the success indicator, not the "Diff failed" chip.
    await expect(page.getByTestId('diff-error')).toHaveCount(0);
    await expect(page.getByTestId('diff-indicator')).toBeVisible();
  });
});

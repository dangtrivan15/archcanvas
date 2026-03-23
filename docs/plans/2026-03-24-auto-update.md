# Auto Update for Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app auto-update to the ArchCanvas Tauri desktop app so users are notified of new versions and can download + install without leaving the app.

**Architecture:** `tauri-plugin-updater` checks GitHub Releases for a `latest.json` manifest on launch. If a newer version exists, a Zustand `updaterStore` drives a status bar indicator through: idle → checking → update-available → downloading → ready-to-restart. A single `scripts/release.sh` replaces the CI matrix build, producing DMGs + signed `.app.tar.gz` bundles for both architectures.

**Tech Stack:** Tauri 2 (`tauri-plugin-updater`, `tauri-plugin-process`), Zustand, `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`, shell script + `gh` CLI

**Spec:** `docs/specs/2026-03-24-auto-update-design.md`

---

### File Map

| File | Role |
|------|------|
| `src-tauri/Cargo.toml` | Add updater + process plugin deps |
| `src-tauri/src/lib.rs` | Register both plugins in Tauri builder |
| `src-tauri/tauri.conf.json` | Updater endpoint + pubkey, `createUpdaterArtifacts`, CSP |
| `src-tauri/capabilities/default.json` | Add updater + process permissions |
| `package.json` | Add `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` |
| `src-web/store/updaterStore.ts` | **New** — Zustand store for update state machine |
| `src-web/core/updater.ts` | **New** — Tauri guard, check/download/relaunch functions |
| `src-web/components/layout/StatusBar.tsx` | Add update indicator segment |
| `scripts/release.sh` | **New** — full release pipeline (both archs) |
| `.github/workflows/release.yml` | Simplify to thin wrapper |
| `test/unit/store/updaterStore.test.ts` | **New** — store state transition tests |
| `test/unit/core/updater.test.ts` | **New** — Tauri guard, function behavior tests |
| `test/unit/components/layout/StatusBar.test.tsx` | **New or modify** — update indicator rendering |

---

### Task 1: Tauri Plugin Setup (Rust + Config)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs:85-88`
- Modify: `src-tauri/tauri.conf.json:23,26-45,46-50`
- Modify: `src-tauri/capabilities/default.json:6-22`

**Context (read but don't modify):**
- `docs/specs/2026-03-24-auto-update-design.md` — Section 1 and 2

**Prerequisites:** Before starting, generate the Ed25519 signing key pair. Run:
```bash
npx tauri signer generate -w ~/.archcanvas/updater-private-key
```
When prompted for a password, leave it empty (press Enter). Save the displayed public key — you'll need it for `tauri.conf.json`.

- [ ] **Step 1: Add Rust dependencies**

In `src-tauri/Cargo.toml`, add two dependencies after the existing plugin lines:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
ctrlc = { version = "3", features = ["termination"] }
```

- [ ] **Step 2: Register plugins in lib.rs**

In `src-tauri/src/lib.rs`, add `tauri_plugin_process` to the builder chain (after line 88, the existing `.plugin(tauri_plugin_fs::init())` line):

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(sidecar_state)
```

Then register the updater plugin **inside** the existing `.setup()` closure (at the top, before sidecar spawning). The updater must be registered via `app.handle()` so it has access to the app context:

```rust
        .setup(move |app| {
            // Register updater plugin (desktop only)
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            let shell_path = resolve_shell_path();
            // ... rest of existing setup unchanged
```

- [ ] **Step 3: Configure updater in tauri.conf.json**

Add `createUpdaterArtifacts` to the `bundle` section and `updater` to the `plugins` section. Also add GitHub domains to the CSP `connect-src`:

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src ipc: http://ipc.localhost ws://127.0.0.1:* http://127.0.0.1:* https://api.anthropic.com https://github.com https://objects.githubusercontent.com; img-src 'self' asset: https://asset.localhost data:"
    }
  },
  "bundle": {
    "createUpdaterArtifacts": true,
    "macOS": { ... }
  },
  "plugins": {
    "fs": {
      "requireLiteralLeadingDot": false
    },
    "updater": {
      "endpoints": [
        "https://github.com/dangtrivan15/archcanvas/releases/latest/download/latest.json"
      ],
      "pubkey": "<PASTE_YOUR_GENERATED_PUBLIC_KEY_HERE>"
    }
  }
}
```

Replace `<PASTE_YOUR_GENERATED_PUBLIC_KEY_HERE>` with the public key from the `npx tauri signer generate` output.

- [ ] **Step 4: Add capabilities**

In `src-tauri/capabilities/default.json`, add `"updater:default"` and `"process:allow-restart"` to the permissions array:

```json
{
  "identifier": "default",
  "description": "Default capabilities for ArchCanvas",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "shell:allow-execute",
    "shell:allow-spawn",
    "shell:allow-kill",
    "dialog:default",
    "fs:read-all",
    "fs:write-all",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$HOME" },
        { "path": "$HOME/**" }
      ]
    },
    "updater:default",
    "process:allow-restart"
  ]
}
```

- [ ] **Step 5: Verify Rust compilation**

Run:
```bash
cd src-tauri && cargo check
```
Expected: compilation succeeds with no errors. Warnings about unused imports are OK at this stage.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json
git commit -m "feat: add tauri-plugin-updater and tauri-plugin-process for auto-update"
```

---

### Task 2: Frontend Dependencies + Updater Store

**Files:**
- Modify: `package.json`
- Create: `src-web/store/updaterStore.ts`
- Create: `test/unit/store/updaterStore.test.ts`

**Context (read but don't modify):**
- `src-web/store/themeStore.ts` — example of a simple Zustand store in this project
- `src-web/platform/index.ts:44-47` — how Tauri detection works (`__TAURI_INTERNALS__`)

- [ ] **Step 1: Install npm dependencies**

Run:
```bash
npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

- [ ] **Step 2: Write failing test for updaterStore**

Create `test/unit/store/updaterStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useUpdaterStore } from '@/store/updaterStore';

describe('updaterStore', () => {
  beforeEach(() => {
    useUpdaterStore.setState({
      status: 'idle',
      version: null,
      error: null,
    });
  });

  it('starts in idle state', () => {
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('idle');
    expect(state.version).toBeNull();
    expect(state.error).toBeNull();
  });

  it('transitions to checking', () => {
    useUpdaterStore.getState().setStatus('checking');
    expect(useUpdaterStore.getState().status).toBe('checking');
  });

  it('transitions to update-available with version', () => {
    useUpdaterStore.getState().setUpdateAvailable('1.2.3');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('update-available');
    expect(state.version).toBe('1.2.3');
  });

  it('transitions to downloading', () => {
    useUpdaterStore.getState().setStatus('downloading');
    expect(useUpdaterStore.getState().status).toBe('downloading');
  });

  it('transitions to ready-to-restart', () => {
    useUpdaterStore.getState().setStatus('ready-to-restart');
    expect(useUpdaterStore.getState().status).toBe('ready-to-restart');
  });

  it('transitions to error with message', () => {
    useUpdaterStore.getState().setError('Network failed');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Network failed');
  });

  it('resets to idle', () => {
    useUpdaterStore.getState().setUpdateAvailable('1.0.0');
    useUpdaterStore.getState().reset();
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('idle');
    expect(state.version).toBeNull();
    expect(state.error).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
npx vitest run test/unit/store/updaterStore.test.ts
```
Expected: FAIL — module `@/store/updaterStore` not found.

- [ ] **Step 4: Implement updaterStore**

Create `src-web/store/updaterStore.ts`:

```typescript
import { create } from 'zustand';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'update-available'
  | 'downloading'
  | 'ready-to-restart'
  | 'up-to-date'
  | 'error';

interface UpdaterState {
  status: UpdateStatus;
  version: string | null;
  error: string | null;
  setStatus: (status: UpdateStatus) => void;
  setUpdateAvailable: (version: string) => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  status: 'idle',
  version: null,
  error: null,
  setStatus: (status) => set({ status }),
  setUpdateAvailable: (version) => set({ status: 'update-available', version }),
  setError: (message) => set({ status: 'error', error: message }),
  reset: () => set({ status: 'idle', version: null, error: null }),
}));
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
npx vitest run test/unit/store/updaterStore.test.ts
```
Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src-web/store/updaterStore.ts test/unit/store/updaterStore.test.ts
git commit -m "feat: add updaterStore for update state machine"
```

---

### Task 3: Updater Module (`src-web/core/updater.ts`)

**Files:**
- Create: `src-web/core/updater.ts`
- Create: `test/unit/core/updater.test.ts`

**Context (read but don't modify):**
- `src-web/store/updaterStore.ts` — the store this module drives
- `src-web/platform/index.ts:44-47` — Tauri detection via `__TAURI_INTERNALS__`
- `@tauri-apps/plugin-updater` API: `check()` returns `Update | null`, `Update` has `.version`, `.downloadAndInstall()`, `.date`, `.body`
- `@tauri-apps/plugin-process` API: `relaunch()` restarts the app

- [ ] **Step 1: Write failing tests for updater module**

Create `test/unit/core/updater.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUpdaterStore } from '@/store/updaterStore';
import { checkForUpdate } from '@/core/updater';

// Mock the Tauri plugins — they're not available in test environment
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

describe('updater', () => {
  beforeEach(() => {
    useUpdaterStore.getState().reset();
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Clean up Tauri detection
    delete (window as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  describe('when not in Tauri environment', () => {
    it('checkForUpdate is a no-op', async () => {
      await checkForUpdate();
      expect(useUpdaterStore.getState().status).toBe('idle');
    });
  });

  describe('when in Tauri environment', () => {
    beforeEach(() => {
      (window as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    });

    it('sets status to update-available when update exists', async () => {
      const { check } = await import('@tauri-apps/plugin-updater');
      vi.mocked(check).mockResolvedValue({
        version: '1.0.0',
        date: '2026-03-24',
        body: 'Release notes',
        downloadAndInstall: vi.fn(),
      } as never);

      await checkForUpdate();

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('update-available');
      expect(state.version).toBe('1.0.0');
    });

    it('sets status to up-to-date when no update', async () => {
      const { check } = await import('@tauri-apps/plugin-updater');
      vi.mocked(check).mockResolvedValue(null as never);

      await checkForUpdate();

      expect(useUpdaterStore.getState().status).toBe('up-to-date');
    });

    it('sets error on check failure', async () => {
      const { check } = await import('@tauri-apps/plugin-updater');
      vi.mocked(check).mockRejectedValue(new Error('Network error'));

      await checkForUpdate();

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Network error');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run test/unit/core/updater.test.ts
```
Expected: FAIL — module `@/core/updater` not found.

- [ ] **Step 3: Implement updater module**

Create `src-web/core/updater.ts`:

```typescript
import { useUpdaterStore } from '@/store/updaterStore';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Cached reference to the pending update, used by downloadAndInstall. */
let pendingUpdate: { version: string; downloadAndInstall: () => Promise<void> } | null = null;

/**
 * Check GitHub Releases for a newer version.
 * No-op outside the Tauri desktop environment.
 */
export async function checkForUpdate(): Promise<void> {
  if (!isTauri()) return;

  const store = useUpdaterStore.getState();
  store.setStatus('checking');

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();

    if (update) {
      pendingUpdate = update;
      store.setUpdateAvailable(update.version);
    } else {
      pendingUpdate = null;
      store.setStatus('up-to-date');
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Download and install the pending update.
 * Call only after checkForUpdate() found an update.
 */
export async function downloadAndInstall(): Promise<void> {
  if (!pendingUpdate) return;

  const store = useUpdaterStore.getState();
  store.setStatus('downloading');

  try {
    await pendingUpdate.downloadAndInstall();
    store.setStatus('ready-to-restart');
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Restart the app to apply the downloaded update.
 */
export async function relaunch(): Promise<void> {
  if (!isTauri()) return;
  const { relaunch: tauriRelaunch } = await import('@tauri-apps/plugin-process');
  await tauriRelaunch();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run test/unit/core/updater.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-web/core/updater.ts test/unit/core/updater.test.ts
git commit -m "feat: add updater module with Tauri guard and state management"
```

---

### Task 4: Status Bar Update Indicator

**Files:**
- Modify: `src-web/components/layout/StatusBar.tsx`
- Create: `test/unit/components/layout/StatusBar.test.tsx`

**Context (read but don't modify):**
- `src-web/store/updaterStore.ts` — the store driving the indicator
- `src-web/core/updater.ts` — the functions the indicator calls

- [ ] **Step 1: Write failing test for update indicator**

Create `test/unit/components/layout/StatusBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBar } from '@/components/layout/StatusBar';
import { useUpdaterStore } from '@/store/updaterStore';

// Mock motion/react — required for happy-dom test environment
vi.mock('motion/react', () => ({
  motion: {
    span: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: Record<string, unknown>) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock('@/components/ui/sliding-number', () => ({
  SlidingNumber: ({ number }: { number: number }) => <span>{number}</span>,
}));

// Mock the updater module
vi.mock('@/core/updater', () => ({
  downloadAndInstall: vi.fn(),
  relaunch: vi.fn(),
}));

// Mock stores that StatusBar depends on
vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector) =>
    selector({
      dirtyCanvases: new Set(),
      getCanvas: () => ({ data: { nodes: [], edges: [] } }),
      project: { root: { filePath: 'test.yml' } },
    }),
  ),
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: vi.fn((selector) =>
    selector({
      currentCanvasId: 'root',
      breadcrumb: [{ displayName: 'Root' }],
    }),
  ),
}));

describe('StatusBar update indicator', () => {
  beforeEach(() => {
    useUpdaterStore.getState().reset();
  });

  it('shows nothing when idle', () => {
    render(<StatusBar />);
    expect(screen.queryByTestId('update-indicator')).toBeNull();
  });

  it('shows version available when update-available', () => {
    useUpdaterStore.getState().setUpdateAvailable('1.2.0');
    render(<StatusBar />);
    const indicator = screen.getByTestId('update-indicator');
    expect(indicator.textContent).toContain('v1.2.0 available');
  });

  it('calls downloadAndInstall when update-available indicator is clicked', async () => {
    const { downloadAndInstall } = await import('@/core/updater');
    useUpdaterStore.getState().setUpdateAvailable('1.2.0');
    render(<StatusBar />);
    fireEvent.click(screen.getByTestId('update-indicator'));
    expect(downloadAndInstall).toHaveBeenCalled();
  });

  it('shows downloading state', () => {
    useUpdaterStore.getState().setStatus('downloading');
    render(<StatusBar />);
    const indicator = screen.getByTestId('update-indicator');
    expect(indicator.textContent).toContain('Downloading');
  });

  it('shows restart prompt when ready-to-restart', () => {
    useUpdaterStore.getState().setStatus('ready-to-restart');
    render(<StatusBar />);
    const indicator = screen.getByTestId('update-indicator');
    expect(indicator.textContent).toContain('Restart to update');
  });

  it('calls relaunch when restart indicator is clicked', async () => {
    const { relaunch } = await import('@/core/updater');
    useUpdaterStore.getState().setStatus('ready-to-restart');
    render(<StatusBar />);
    fireEvent.click(screen.getByTestId('update-indicator'));
    expect(relaunch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run test/unit/components/layout/StatusBar.test.tsx
```
Expected: FAIL — no element with `data-testid="update-indicator"` found (tests for update-available, downloading, ready-to-restart will fail).

- [ ] **Step 3: Add update indicator to StatusBar**

Modify `src-web/components/layout/StatusBar.tsx`. Add the updater store import and render the indicator in the right section of the status bar:

```tsx
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFileStore } from "@/store/fileStore";
import { useNavigationStore } from "@/store/navigationStore";
import { useUpdaterStore } from "@/store/updaterStore";
import { downloadAndInstall, relaunch } from "@/core/updater";
import { SlidingNumber } from "@/components/ui/sliding-number";

export function StatusBar() {
  const currentCanvasId = useNavigationStore((s) => s.currentCanvasId);
  const breadcrumb = useNavigationStore((s) => s.breadcrumb);
  const dirtyCanvases = useFileStore((s) => s.dirtyCanvases);
  const getCanvas = useFileStore((s) => s.getCanvas);
  const projectFilePath = useFileStore((s) => s.project?.root.filePath ?? null);
  const fileName = projectFilePath ? projectFilePath.split('/').pop() : null;
  const prefersReduced = useReducedMotion();

  const updateStatus = useUpdaterStore((s) => s.status);
  const updateVersion = useUpdaterStore((s) => s.version);

  const loaded = getCanvas(currentCanvasId);
  const nodeCount = loaded?.data.nodes?.length ?? 0;
  const edgeCount = loaded?.data.edges?.length ?? 0;

  const scopeName = breadcrumb[breadcrumb.length - 1]?.displayName ?? 'Root';
  const isDirty = dirtyCanvases.size > 0;

  function handleUpdateClick() {
    if (updateStatus === 'update-available') {
      downloadAndInstall();
    } else if (updateStatus === 'ready-to-restart') {
      relaunch();
    }
  }

  const showUpdateIndicator =
    updateStatus === 'update-available' ||
    updateStatus === 'downloading' ||
    updateStatus === 'ready-to-restart';

  return (
    <div className="flex h-6 items-center justify-between border-t border-border bg-background px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>ArchCanvas v0.1.0</span>
        {fileName && (
          <span className="text-muted-foreground/60">{fileName}</span>
        )}
        <AnimatePresence>
          {isDirty && (
            <motion.span
              initial={prefersReduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-500 font-medium"
            >
              Modified
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-3">
        <AnimatePresence>
          {showUpdateIndicator && (
            <motion.button
              data-testid="update-indicator"
              initial={prefersReduced ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0, x: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={handleUpdateClick}
              disabled={updateStatus === 'downloading'}
              className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                updateStatus === 'downloading'
                  ? 'text-muted-foreground cursor-default'
                  : 'text-sky-500 hover:bg-sky-500/15 cursor-pointer'
              }`}
            >
              {updateStatus === 'update-available' && `v${updateVersion} available`}
              {updateStatus === 'downloading' && 'Downloading update…'}
              {updateStatus === 'ready-to-restart' && 'Restart to update'}
            </motion.button>
          )}
        </AnimatePresence>
        {loaded ? (
          <>
            <span>{scopeName}</span>
            <span data-testid="node-count" data-count={nodeCount}><SlidingNumber number={nodeCount} /> {nodeCount === 1 ? 'node' : 'nodes'}</span>
            <span data-testid="edge-count" data-count={edgeCount}><SlidingNumber number={edgeCount} /> {edgeCount === 1 ? 'edge' : 'edges'}</span>
          </>
        ) : (
          <span>No project open</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run test/unit/components/layout/StatusBar.test.tsx
```
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-web/components/layout/StatusBar.tsx test/unit/components/layout/StatusBar.test.tsx
git commit -m "feat: add update indicator to status bar"
```

---

### Task 5: Trigger Update Check on App Launch

**Files:**
- Modify: `src-web/App.tsx:19,36`

**Context (read but don't modify):**
- `src-web/core/updater.ts` — the `checkForUpdate` function

- [ ] **Step 1: Add update check on mount**

In `src-web/App.tsx`, import `checkForUpdate` and call it in a `useEffect` at the top of the `App` component, alongside the existing mount effects:

```typescript
import { checkForUpdate } from '@/core/updater';
```

Add after the existing `useRegistryStore.getState().initialize()` effect (around line 74):

```typescript
  useEffect(() => {
    checkForUpdate();
  }, []);
```

This fires once on mount. Since `checkForUpdate` is a no-op outside Tauri, it's safe to call unconditionally.

- [ ] **Step 2: Verify existing tests still pass**

Run:
```bash
npx vitest run --project unit
```
Expected: all existing unit tests pass. The `checkForUpdate` call is a no-op in the test environment (no `__TAURI_INTERNALS__`).

- [ ] **Step 3: Commit**

```bash
git add src-web/App.tsx
git commit -m "feat: check for updates on app launch"
```

---

### Task 6: Release Script

**Files:**
- Create: `scripts/release.sh`

**Context (read but don't modify):**
- `.github/workflows/release.yml` — current CI logic to replicate
- `docs/specs/2026-03-24-auto-update-design.md` — Section 3 (release script design)

- [ ] **Step 1: Create the release script**

Create `scripts/release.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# ─── ArchCanvas Release Script ─────────────────────────────────────────
# Builds both architectures, signs updater bundles, and publishes to
# GitHub Releases. Usable both locally and from CI.
#
# Usage: ./scripts/release.sh [--dry-run] <patch|minor|major>
# ────────────────────────────────────────────────────────────────────────

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  shift
fi

BUMP_TYPE="${1:?Usage: ./scripts/release.sh [--dry-run] <patch|minor|major>}"

# ─── Validate bump type ────────────────────────────────────────────────
case "$BUMP_TYPE" in
  patch|minor|major) ;;
  *) echo "Error: bump type must be patch, minor, or major"; exit 1 ;;
esac

# ─── Validate prerequisites ────────────────────────────────────────────
SIGNING_KEY_PATH="$HOME/.archcanvas/updater-private-key"
REQUIRED_CMDS=(rustc bun node npm gh npx)

for cmd in "${REQUIRED_CMDS[@]}"; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd not found on PATH"
    exit 1
  fi
done

if [[ ! -f "$SIGNING_KEY_PATH" ]]; then
  echo "Error: signing key not found at $SIGNING_KEY_PATH"
  echo "Generate one with: npx tauri signer generate -w $SIGNING_KEY_PATH"
  exit 1
fi

for target in aarch64-apple-darwin x86_64-apple-darwin; do
  if ! rustup target list --installed | grep -q "$target"; then
    echo "Error: Rust target $target not installed. Run: rustup target add $target"
    exit 1
  fi
done

# ─── Calculate version ─────────────────────────────────────────────────
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
CURRENT="${LATEST_TAG#v}"
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

VERSION="${MAJOR}.${MINOR}.${PATCH}"
TAG="v${VERSION}"
echo "Bumping $BUMP_TYPE: $CURRENT → $VERSION"

# ─── Sync versions in config files ─────────────────────────────────────
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
node -e "
  const fs = require('fs');
  const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  conf.version = '$VERSION';
  fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"
echo "Synced version to $VERSION in package.json and tauri.conf.json"

# ─── Commit version bump ───────────────────────────────────────────────
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: bump version to $VERSION"

# ─── Build frontend (shared) ───────────────────────────────────────────
echo "Building frontend..."
npm run build

# ─── Build per-architecture ─────────────────────────────────────────────
export TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY=$(cat "$SIGNING_KEY_PATH")

TARGETS=(aarch64-apple-darwin x86_64-apple-darwin)
BUN_TARGETS=(bun-darwin-arm64 bun-darwin-x64)
ARTIFACT_PREFIXES=(ArchCanvas-aarch64 ArchCanvas-x64)

RELEASE_DIR="release"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

for i in 0 1; do
  RUST_TARGET="${TARGETS[$i]}"
  BUN_TARGET="${BUN_TARGETS[$i]}"
  PREFIX="${ARTIFACT_PREFIXES[$i]}"

  echo ""
  echo "═══ Building for $RUST_TARGET ═══"

  # Build sidecar
  echo "Building sidecar ($BUN_TARGET)..."
  bun build --compile --target="$BUN_TARGET" src-web/bridge/index.ts \
    --outfile "src-tauri/binaries/archcanvas-bridge-${RUST_TARGET}"

  # Build Tauri app (frontend already built — disable beforeBuildCommand)
  echo "Building Tauri app..."
  npx tauri build --target "$RUST_TARGET" --bundles dmg \
    --config '{"build":{"beforeBuildCommand":""}}'

  # Collect artifacts
  DMG_DIR="src-tauri/target/${RUST_TARGET}/release/bundle/dmg"
  MACOS_DIR="src-tauri/target/${RUST_TARGET}/release/bundle/macos"

  cp "$DMG_DIR"/*.dmg "$RELEASE_DIR/${PREFIX}.dmg"
  cp "$MACOS_DIR"/*.app.tar.gz "$RELEASE_DIR/${PREFIX}.app.tar.gz"
  cp "$MACOS_DIR"/*.app.tar.gz.sig "$RELEASE_DIR/${PREFIX}.app.tar.gz.sig"

  echo "Artifacts collected: ${PREFIX}.dmg, ${PREFIX}.app.tar.gz, ${PREFIX}.app.tar.gz.sig"
done

# ─── Generate latest.json ──────────────────────────────────────────────
echo ""
echo "Generating latest.json..."

SIG_AARCH64=$(cat "$RELEASE_DIR/ArchCanvas-aarch64.app.tar.gz.sig")
SIG_X64=$(cat "$RELEASE_DIR/ArchCanvas-x64.app.tar.gz.sig")
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$RELEASE_DIR/latest.json" <<MANIFEST
{
  "version": "${VERSION}",
  "notes": "ArchCanvas v${VERSION}",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "darwin-aarch64": {
      "url": "https://github.com/dangtrivan15/archcanvas/releases/download/${TAG}/${ARTIFACT_PREFIXES[0]}.app.tar.gz",
      "signature": "${SIG_AARCH64}"
    },
    "darwin-x86_64": {
      "url": "https://github.com/dangtrivan15/archcanvas/releases/download/${TAG}/${ARTIFACT_PREFIXES[1]}.app.tar.gz",
      "signature": "${SIG_X64}"
    }
  }
}
MANIFEST

echo "latest.json generated"

# ─── Publish ────────────────────────────────────────────────────────────
if $DRY_RUN; then
  echo ""
  echo "═══ DRY RUN — skipping publish ═══"
  echo "Would create tag: $TAG"
  echo "Would upload:"
  ls -lh "$RELEASE_DIR"
  echo ""
  echo "latest.json contents:"
  cat "$RELEASE_DIR/latest.json"
  exit 0
fi

echo ""
echo "═══ Publishing $TAG ═══"

git push origin HEAD
git tag "$TAG"
git push origin "$TAG"

gh release create "$TAG" \
  --title "ArchCanvas $VERSION" \
  --generate-notes \
  "$RELEASE_DIR/ArchCanvas-aarch64.dmg" \
  "$RELEASE_DIR/ArchCanvas-x64.dmg" \
  "$RELEASE_DIR/ArchCanvas-aarch64.app.tar.gz" \
  "$RELEASE_DIR/ArchCanvas-x64.app.tar.gz" \
  "$RELEASE_DIR/ArchCanvas-aarch64.app.tar.gz.sig" \
  "$RELEASE_DIR/ArchCanvas-x64.app.tar.gz.sig" \
  "$RELEASE_DIR/latest.json"

echo ""
echo "Release $TAG published successfully!"
echo "https://github.com/dangtrivan15/archcanvas/releases/tag/$TAG"
```

- [ ] **Step 2: Make the script executable**

Run:
```bash
chmod +x scripts/release.sh
```

- [ ] **Step 3: Validate the script (syntax only)**

Run:
```bash
bash -n scripts/release.sh
```
Expected: no output (no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add scripts/release.sh
git commit -m "feat: add release script for dual-arch builds with updater signing"
```

---

### Task 7: Simplify CI Workflow

**Files:**
- Modify: `.github/workflows/release.yml`

**Context (read but don't modify):**
- `scripts/release.sh` — the script CI will call

- [ ] **Step 1: Replace release.yml with thin wrapper**

Replace the entire contents of `.github/workflows/release.yml` with:

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      bump:
        description: 'Version bump type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    if: github.repository == 'dangtrivan15/archcanvas'
    runs-on: arc-runner-archcanvas
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - uses: oven-sh/setup-bun@v2

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin

      - name: Cache Rust build artifacts
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri -> target

      - name: Install npm dependencies
        run: npm ci

      - name: Run release script
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: ./scripts/release.sh ${{ inputs.bump }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "refactor: simplify release workflow to call scripts/release.sh"
```

---

### Task 8: Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run all unit tests**

Run:
```bash
npx vitest run --project unit
```
Expected: all tests pass, including the new updaterStore, updater, and StatusBar tests.

- [ ] **Step 2: Run E2E tests (no bridge)**

Run:
```bash
npm run test:e2e-no-bridge
```
Expected: all existing E2E tests pass. The updater is a no-op in the browser environment.

- [ ] **Step 3: Verify Rust compilation with updater plugins**

Run:
```bash
cd src-tauri && cargo check && cd ..
```
Expected: compilation succeeds.

- [ ] **Step 4: Commit any test fixes if needed**

If any tests needed adjustment, commit those fixes:
```bash
git add -A
git commit -m "fix: adjust tests for auto-update integration"
```

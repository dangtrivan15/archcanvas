# Auto Update for Desktop App — Design Spec

> **Date**: 2026-03-24 | **Status**: Draft
> **Scope**: Tauri updater plugin integration, Ed25519 signing, release script, CI wrapper, status bar update UI

---

## Problem

ArchCanvas desktop users must manually download new DMG files from GitHub Releases and reinstall the app to update. There is no in-app update mechanism — users may not even know a new version is available.

## Goals

1. Check for updates on app launch and notify the user via the status bar
2. Download and install updates in-app (no manual DMG/reinstall)
3. Consolidate the release pipeline into a single shell script usable both locally and in CI
4. Sign update bundles with Ed25519 for integrity verification

## Non-Goals

- Update settings UI (check frequency, skip version, pre-release channels)
- Windows/Linux support (macOS only for now)
- Staged rollouts or update channels
- Delta/incremental updates

## Decisions

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Update mechanism | `tauri-plugin-updater` | Custom GitHub API polling, Sparkle | Native Tauri integration, Ed25519 signing built-in, well-documented, cross-platform ready |
| Update source | GitHub Releases + `latest.json` manifest | Custom update server, S3 bucket | Zero infrastructure cost, builds on existing release workflow |
| Signing key storage | `~/.archcanvas/updater-private-key` on build machine | GitHub Actions secret, macOS Keychain | Local builds are the current release method (GitHub Actions quota exhausted), conventional path |
| Update UX | Status bar indicator (non-intrusive) | Modal dialog, toast notification, silent auto-install | Fits existing UI patterns, non-disruptive, user controls when to restart |
| Update settings | None — always check on launch | Toggle, frequency control | Keep it simple; add settings later if users request |
| Bundle format | DMG (first install) + `.app.tar.gz` (updates) | DMG only | Tauri updater requires `.app.tar.gz` format for in-place replacement |
| Release script | Single `scripts/release.sh` called by both local builds and CI | Separate local/CI scripts | Single source of truth, easier maintenance |
| Architecture builds | Both aarch64 and x86_64 required | Single-arch | Full user coverage for macOS |

---

## Design

### 1. Ed25519 Signing Infrastructure

One-time key generation via `npx tauri signer generate -w ~/.archcanvas/updater-private-key`:

- **Private key**: Saved to `~/.archcanvas/updater-private-key` on the build machine. Generated **without a password** (empty password when prompted) to allow non-interactive use in scripts.
- **Public key**: Committed to `src-tauri/tauri.conf.json` in the `plugins.updater.pubkey` field
- **CI (future)**: When GitHub Actions quota returns, `arc-runner-archcanvas` reads the key from the same filesystem path

The build script sets `TAURI_SIGNING_PRIVATE_KEY` from the key file before invoking `tauri build`. Tauri reads this environment variable automatically to sign the `.app.tar.gz` bundle.

### 2. Tauri Plugin Setup

**Rust side** (`src-tauri/Cargo.toml`):

Add two dependencies:
- `tauri-plugin-updater = "2"` — update check, download, and installation
- `tauri-plugin-process = "2"` — `relaunch()` after update (the updater plugin does not provide relaunch itself)

**Plugin registration** (`src-tauri/src/lib.rs`):

Add both plugins to the Tauri builder chain:
- `.plugin(tauri_plugin_updater::Builder::new().build())`
- `.plugin(tauri_plugin_process::init())`

**Configuration** (`src-tauri/tauri.conf.json`):

Add updater plugin config:
```json
"plugins": {
  "updater": {
    "endpoints": [
      "https://github.com/dangtrivan15/archcanvas/releases/latest/download/latest.json"
    ],
    "pubkey": "<generated-public-key>"
  }
}
```

Enable updater artifact generation in the `bundle` section:
```json
"bundle": {
  "createUpdaterArtifacts": true
}
```

This is what triggers `.app.tar.gz` + `.sig` generation during `tauri build`. The `--bundles` CLI flag only controls which installer formats to produce (e.g., `dmg`).

**CSP update**: The updater makes HTTP requests from the Rust side, not the webview, so no CSP changes are needed for the download. However, if the check is initiated from the JS side, add `https://github.com https://objects.githubusercontent.com` to `connect-src` as a safety measure.

**Capabilities** (`src-tauri/capabilities/default.json`):

Add both permissions:
- `"updater:default"` — allows update check and installation
- `"process:allow-restart"` — allows app relaunch after update

**Frontend** (`package.json`):

Add two npm dependencies:
- `@tauri-apps/plugin-updater` — update check and download API
- `@tauri-apps/plugin-process` — `relaunch()` API

### 3. Release Script (`scripts/release.sh`)

A single script that handles the full build-and-release pipeline for both architectures.

**Usage**: `./scripts/release.sh patch|minor|major`

**Steps**:

1. **Validate prerequisites** — Check that `rustc`, `bun`, `node`, `npm`, `gh`, `npx` are available. Verify signing key exists at `~/.archcanvas/updater-private-key`. Verify Rust targets `aarch64-apple-darwin` and `x86_64-apple-darwin` are installed.
2. **Accept bump type** — Positional argument: `patch`, `minor`, or `major`.
3. **Calculate new version** — Derive from latest git tag (e.g., `v0.2.0` + `patch` → `0.2.1`).
4. **Sync versions** — Update `version` field in `package.json` and `src-tauri/tauri.conf.json`. (`src-tauri/Cargo.toml` version is not synced — Tauri reads the version from `tauri.conf.json`, not `Cargo.toml`.)
5. **Build frontend** — `npm run build` (shared across both architectures).
6. **For each architecture** (`aarch64-apple-darwin`, `x86_64-apple-darwin`):
   a. Build sidecar: `bun build --compile --target=bun-darwin-arm64|x64 src-web/bridge/index.ts --outfile src-tauri/binaries/archcanvas-bridge-<target>`
   b. Set `TAURI_SIGNING_PRIVATE_KEY` from key file
   c. Build Tauri app: `npx tauri build --target <target> --bundles dmg` (with `beforeBuildCommand` disabled since frontend is already built). The `createUpdaterArtifacts: true` config automatically generates `.app.tar.gz` + `.sig` alongside the DMG.
   d. Collect artifacts: DMG from `target/<target>/release/bundle/dmg/`, updater artifacts (`.app.tar.gz`, `.app.tar.gz.sig`) from `target/<target>/release/bundle/macos/`
7. **Generate `latest.json`** — Assemble the update manifest:
   ```json
   {
     "version": "<new-version>",
     "notes": "ArchCanvas v<new-version>",
     "pub_date": "<ISO-8601 timestamp>",
     "platforms": {
       "darwin-aarch64": {
         "url": "https://github.com/dangtrivan15/archcanvas/releases/download/v<version>/ArchCanvas-aarch64.app.tar.gz",
         "signature": "<contents of aarch64 .sig file>"
       },
       "darwin-x86_64": {
         "url": "https://github.com/dangtrivan15/archcanvas/releases/download/v<version>/ArchCanvas-x64.app.tar.gz",
         "signature": "<contents of x64 .sig file>"
       }
     }
   }
   ```
8. **Create git tag + GitHub Release** — `gh release create v<version> --title "v<version>" --generate-notes`
9. **Upload all assets** — 2 DMGs, 2 `.app.tar.gz`, 2 `.sig` files, 1 `latest.json`

**Dry-run mode**: `./scripts/release.sh --dry-run patch` — runs all build steps but skips `gh release create` and upload. Validates the full pipeline without publishing.

**Artifact naming**:
| File | Name |
|------|------|
| DMG (aarch64) | `ArchCanvas-aarch64.dmg` |
| DMG (x86_64) | `ArchCanvas-x64.dmg` |
| Update bundle (aarch64) | `ArchCanvas-aarch64.app.tar.gz` |
| Update bundle (x86_64) | `ArchCanvas-x64.app.tar.gz` |
| Signature (aarch64) | `ArchCanvas-aarch64.app.tar.gz.sig` |
| Signature (x86_64) | `ArchCanvas-x64.app.tar.gz.sig` |
| Update manifest | `latest.json` |

### 4. CI Workflow Changes (`release.yml`)

The existing `release.yml` becomes a thin wrapper:

1. **Checkout** code
2. **Setup toolchain** (Node, Bun, Rust)
3. **Run** `./scripts/release.sh ${{ inputs.bump }}`

The matrix build is removed — the script handles both architectures sequentially. The `resolve-version` job is removed — the script calculates the version internally.

The `arc-runner-archcanvas` runner must have the signing key at `~/.archcanvas/updater-private-key`.

### 5. Frontend Update UI

#### Update module (`src/core/updater.ts`)

A module that wraps `@tauri-apps/plugin-updater` and exposes update state to the UI.

**Tauri guard**: Only runs when `window.__TAURI__` is defined. In the web environment, the module exports no-op functions.

**State machine**:

```
idle → checking → update-available → downloading → ready-to-restart
                → up-to-date (hidden)
                → error (hidden, logged)
```

**State store** (`src/store/updaterStore.ts`):

A Zustand store consistent with the project's existing store pattern. Fields:
- `status`: `'idle' | 'checking' | 'update-available' | 'downloading' | 'ready-to-restart' | 'up-to-date' | 'error'`
- `version`: `string | null` — the available update version
- `error`: `string | null` — error message if check/download failed

**Exports** from `src/core/updater.ts`:
- `checkForUpdate(): Promise<void>` — calls `check()` from the updater plugin, updates `updaterStore`
- `downloadAndInstall(): Promise<void>` — downloads the update bundle, updates store to `downloading` then `ready-to-restart`
- `relaunch(): Promise<void>` — calls `relaunch()` from `@tauri-apps/plugin-process` to restart the app

**Launch behavior**: `checkForUpdate()` is called once on app startup. No periodic polling.

#### Status bar integration

The existing status bar component gains a conditional update segment:

| State | Display | Action on click |
|-------|---------|-----------------|
| `idle` / `checking` / `up-to-date` / `error` | Nothing shown | — |
| `update-available` | "v{version} available" | Starts download |
| `downloading` | "Downloading update..." | — (non-interactive) |
| `ready-to-restart` | "Restart to update" | Calls `relaunch()` |

The update indicator appears at the right end of the status bar, styled subtly (muted text, no background) until hovered.

### 6. Testing Strategy

**Unit tests**:
- `updater.ts` — state transitions: idle → checking → update-available → downloading → ready-to-restart
- `updater.ts` — Tauri guard: no-op when `window.__TAURI__` is undefined
- `updater.ts` — error handling: network failure during check, download failure
- Status bar component — renders update indicator when update state is `update-available`, `downloading`, `ready-to-restart`

**Script testing**:
- `./scripts/release.sh --dry-run patch` — validates full build pipeline and `latest.json` generation without publishing

**Manual verification**:
- Build and install an older version (e.g., v0.0.1)
- Release a newer version (e.g., v0.0.2)
- Launch the old app, confirm status bar shows "v0.0.2 available"
- Click to download, confirm progress indication
- Click "Restart to update", confirm app restarts with new version

**E2E**: Not applicable — the update flow requires two real published versions and cannot be simulated in Playwright.

---

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add `tauri-plugin-updater = "2"` and `tauri-plugin-process = "2"` dependencies |
| `src-tauri/src/lib.rs` | Register updater and process plugins in Tauri builder |
| `src-tauri/tauri.conf.json` | Add `plugins.updater` config (endpoint + pubkey), `bundle.createUpdaterArtifacts: true`, CSP `connect-src` additions |
| `src-tauri/capabilities/default.json` | Add `"updater:default"` and `"process:allow-restart"` permissions |
| `package.json` | Add `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` dependencies |
| `scripts/release.sh` | **New** — full release pipeline script |
| `.github/workflows/release.yml` | Simplify to thin wrapper calling `scripts/release.sh` |
| `src/core/updater.ts` | **New** — update check, download, relaunch logic with Tauri guard |
| `src/store/updaterStore.ts` | **New** — Zustand store for update state machine |
| Status bar component | Add conditional update indicator segment |

## Files Not Changed

| File | Reason |
|------|--------|
| `src-tauri/src/main.rs` | No changes needed — `lib.rs` handles plugin registration |
| `src-web/bridge/index.ts` | Sidecar is unrelated to the updater |
| Landing page | Download links remain the same (DMGs for first install) |

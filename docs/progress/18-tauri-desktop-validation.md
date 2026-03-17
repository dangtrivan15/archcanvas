# 18: Tauri Desktop Build Validation

> **Date**: 2026-03-17 | **Status**: Partial — build validated, E2E mock bridge deferred
> **Scope**: Desktop .app bundle validation, orphan sidecar fix, E2E mock bridge design

## What Was Done

### Desktop Build Pipeline — Validated

Every stage of the Tauri desktop build compiles and produces a working `.app` bundle:

| Stage | Command | Result |
|-------|---------|--------|
| Frontend | `npm run build` | Pass — `dist/` produced (2.4MB JS, 67KB CSS) |
| Sidecar | `bun build --compile` | Pass — 59MB binary at `src-tauri/binaries/` |
| Rust | `cargo check` / `cargo build --release` | Pass |
| Bundle | `npx tauri build --bundles app` | Pass — 76MB `.app` at `target/release/bundle/macos/` |

### Runtime Validation — Verified

Launched the `.app` and confirmed the full sidecar lifecycle:

1. Tauri spawns `archcanvas-bridge --port 0`
2. OS assigns a free port (observed: 50769)
3. Rust parses `BRIDGE_PORT=50769` from sidecar stdout
4. Frontend polls `get_bridge_port` IPC → gets port
5. WebSocket connection established (verified via `lsof`)
6. Health check `GET /__archcanvas_ai/health` returns `{"ok":true}`
7. Graceful close (Cmd+Q) properly kills the sidecar

### Bug Fixed: Orphan Sidecar Processes

**Root cause**: When the Tauri app is killed externally (SIGTERM, SIGKILL, crash), `RunEvent::Exit` doesn't fire because the Rust process terminates before the event loop can dispatch the event. The sidecar becomes orphaned.

**Fix — two complementary approaches:**

| Layer | Approach | Covers |
|-------|----------|--------|
| **Rust signal handler** (`lib.rs`) | `ctrlc` crate catches SIGTERM/SIGINT, kills sidecar before `process::exit(0)` | `kill`, system shutdown, logout, Ctrl+C |
| **Sidecar idle timeout** (`bridgeServer.ts`) | When all WebSocket clients disconnect and none reconnect within 15s, sidecar exits | SIGKILL, crash, force quit — any case where parent dies without signaling |

The idle timeout only fires after at least one client has connected (not on cold start), and resets when a new client connects.

### Bundle Fixes

- **Identifier**: Changed `com.archcanvas.app` → `com.archcanvas.desktop` (`.app` suffix conflicts with macOS app extension)
- **Icons**: Generated full icon set via `npx tauri icon` (was missing `.icns`, PNGs at required sizes). Added `bundle.icon` array to `tauri.conf.json`. The `.app` bundle now includes `Contents/Resources/icon.icns`.

### Known Issue: `bun` Not on PATH

`npm run build:sidecar` fails when invoked by Tauri's `beforeBuildCommand` because `bun` is at `~/.bun/bin/bun` but not on the shell PATH in non-interactive contexts. Workaround: build the sidecar manually before running `npx tauri build`. User will fix independently.

## What Was NOT Done

### E2E Mock Bridge Test — Deferred

**Goal**: Send a chat message through the UI, have a mock provider add nodes via the WebSocket relay pipeline, verify nodes appear on the canvas. Tests the full path: chat UI → WebSocket → bridge → relay → WebSocket → browser → storeActionDispatcher → Zustand → canvas.

**Infrastructure built**:
- `sessionFactory` option on `BridgeServerOptions` — legitimate DI point that replaces `createBridgeSession` with a custom factory. The factory receives the per-connection `RelayStoreActionFn` so it can dispatch store actions to the browser.
- `RelayStoreActionFn` type exported from `bridgeServer.ts` (was previously local to `mcpTools.ts`).
- Unit tests for `sessionFactory` passing (2 tests in `bridgeServer.test.ts`).

**What's needed to complete**:
1. A mock session factory (test file) that, on `sendMessage`, calls `relay('addNode', ...)` and yields ChatEvents.
2. A way to get the mock into the Vite preview server for E2E. Two viable approaches:
   - **Separate `vite.config.e2e.ts`** with its own minimal bridge plugin using `createBridgeServer({ sessionFactory })` directly, plus a `playwright.e2e-bridge.config.ts` pointing to it.
   - **Standalone mock bridge server** started in Playwright's `globalSetup`, with the browser connecting to it via injected URL.
3. A Playwright spec (`ai-bridge.spec.ts`) that opens the app, sends a chat message, and asserts nodes/edges appear on the canvas.

**Why deferred**: The approach for injecting the mock into the E2E pipeline needs more thought. The `sessionFactory` DI point and unit tests are in place — the remaining work is purely test infrastructure wiring.

## Files Changed

| File | Change |
|------|--------|
| `src/core/ai/bridgeServer.ts` | `idleTimeoutMs`, `onIdleTimeout`, `sessionFactory` options; `RelayStoreActionFn` export; idle timer logic |
| `src/core/ai/mcpTools.ts` | Re-export `RelayStoreActionFn` from `bridgeServer` (removed local definition) |
| `src/bridge/index.ts` | Wire idle timeout → `process.exit(0)` after 15s with no clients |
| `src-tauri/src/lib.rs` | `ctrlc` signal handler kills sidecar on SIGTERM/SIGINT |
| `src-tauri/Cargo.toml` | Added `ctrlc = "3"` with `termination` feature |
| `src-tauri/tauri.conf.json` | Identifier fix, `bundle.icon` array added |
| `src-tauri/icons/` | Full icon set generated from `icon.png` (icns, ico, PNGs, iOS, Android) |
| `test/ai/bridgeServer.test.ts` | 6 new tests (4 idle timeout, 2 sessionFactory) |

### Test counts

- **1376 unit tests** (up from 1370), 57 test files — all passing
- Rust `cargo check` clean

# Task 3: Tauri Multi-Window + Minimal Native macOS Menu

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Replace `window.open()` with Tauri window creation API and configure minimal native macOS menu
**Parent feature:** [./2026-03-24-menubar-ux-index.md](./2026-03-24-menubar-ux-index.md)

## Write Set

- Modify: `src-tauri/src/lib.rs` (~40 lines) — add minimal native menu (App, Edit, Window) and multi-window support
- Modify: `src-web/store/fileStore.ts` (~15 lines) — detect Tauri and use `WebviewWindow` API instead of `window.open()`
- Modify: `src-tauri/tauri.conf.json` (~10 lines) — configure multi-window permissions if needed

## Read Set (context needed)

- `src-tauri/src/lib.rs` — current Tauri setup (no menu config, sidecar management)
- `src-tauri/tauri.conf.json` — current window config, plugins, CSP
- `src-web/store/fileStore.ts` — `open()` method's `window.open()` call (lines 373-378 after Task 1)
- `src-web/platform/filePicker.ts` — Tauri detection pattern (`__TAURI_INTERNALS__`)

## Dependencies

- **Blocked by:** Task 1 (Task 1 simplifies fileStore's `open()` method)
- **Blocks:** None

## Description

Two changes for the Tauri desktop experience:

### 1. Replace `window.open()` with Tauri window creation

In the Tauri webview, `window.open()` either does nothing or opens the system browser — neither is correct. Instead, use the `@tauri-apps/api/webviewWindow` module to create a new app window.

In `fileStore.ts`, the `open()` method currently does:
```ts
if (get().fs !== null) {
  window.open(`${origin}${pathname}?action=open`, '_blank');
  return;
}
```

For Tauri, replace with:
```ts
if ('__TAURI_INTERNALS__' in window) {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  new WebviewWindow(`project-${Date.now()}`, {
    url: `index.html?action=open`,
    title: 'ArchCanvas',
    width: 1280,
    height: 800,
  });
  return;
}
```

Each new window gets a unique label (`project-<timestamp>`). The new window loads the same frontend, hits `ProjectGate`, detects `?action=open`, and shows the directory picker — same flow as web tabs.

**Sidecar sharing:** All windows connect to the same bridge sidecar via the shared `get_bridge_port` command. The sidecar's WebSocket server already supports multiple clients, so no sidecar changes needed.

### 2. Minimal native macOS menu

The current Tauri app has NO explicit menu configuration, so Tauri generates a default menu that duplicates the React MenuBar's functionality. We should configure a minimal native menu that only provides macOS-expected behaviors:

**App menu (ArchCanvas):**
- About ArchCanvas
- Separator
- Hide ArchCanvas (⌘H)
- Hide Others (⌥⌘H)
- Show All
- Separator
- Quit ArchCanvas (⌘Q)

**Edit menu** (needed for clipboard shortcuts to work in native text fields):
- Cut (⌘X), Copy (⌘C), Paste (⌘V), Select All (⌘A)

**Window menu:**
- Minimize (⌘M)
- Zoom
- Separator
- Bring All to Front

This is done in Rust using Tauri's `Menu` API in the `.setup()` closure. The `tauri::menu` module provides builder methods for standard menus.

All project-specific actions (Open, Save, Undo, Redo, etc.) stay in the React MenuBar — no duplication.

### Acceptance criteria:
- "Open..." in desktop creates a new Tauri window (not a browser tab)
- New window shows ProjectGate → directory picker → loads project
- Multiple windows can coexist, each with its own project
- All windows share the same bridge sidecar
- Native macOS menu has only App, Edit, Window items
- No duplicate functionality between native menu and React MenuBar
- Clipboard shortcuts (⌘C/V/X) work in native text inputs
